/**
 * 工作区索引。
 *
 * 扫描工作区 .md/.markdown/.mdown，提取 YAML frontmatter、wikilink(`[[X]]`)、`#tags`、headings。
 * 内存持有；按工作区写 JSON 缓存到 `<userData>/index/<sha256(folder)[:16]>.json` 供热启动加速。
 * chokidar 监听保持索引常新；去抖 200ms 后重扫受影响文件并发 `eidon:index-updated` 事件。
 *
 * 行为稳定：tags 手写扫描器（跳过围栏/行内代码/十六进制色值/表格纯数字），
 * frontmatter 切分、wikilink 三段式解析、resolve 三级回退（stem→title→子串）、backlink 三行上下文。
 */
import { promises as fs } from "node:fs";
import fsSync from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import matter from "gray-matter";
import { watch, type FSWatcher } from "chokidar";
import type {
  IndexEntry,
  WikilinkRef,
  BacklinkRef,
  TagCount,
} from "@shared/models";
import { emitEvent } from "../../ipc/emit";
import { getRuntimePaths } from "../runtime-paths";

const MD_EXTS = new Set(["md", "markdown", "mdown"]);

interface State {
  root: string | null;
  entries: Map<string, IndexEntry>; // path -> entry
  watcher: FSWatcher | null;
}

const state: State = { root: null, entries: new Map(), watcher: null };

// ── 命令 ────────────────────────────────────────────────────────────
export async function indexInit(folder: string): Promise<number> {
  const root = path.resolve(folder);
  const st = await statSafe(root);
  if (!st?.isDirectory()) throw new Error(`not a directory: ${folder}`);

  // 重置状态。
  state.entries.clear();
  state.root = root;
  await stopWatcher();

  // 先吃缓存（热启动），随后全量扫描会校正漂移。
  const cached = await loadCache(root);
  if (cached) for (const e of cached) state.entries.set(e.path, e);

  await scanInto(root);
  startWatcher(root);

  await saveCache(root);
  emitEvent("eidon:index-updated", "init");
  return state.entries.size;
}

export function indexFiles(): IndexEntry[] {
  const v = [...state.entries.values()];
  v.sort((a, b) => cmpLower(a.name, b.name));
  return v;
}

export function backlinks(target: string): BacklinkRef[] {
  const targetLc = target.toLowerCase();
  const out: BacklinkRef[] = [];
  for (const entry of state.entries.values()) {
    for (const link of entry.wikilinks) {
      if (link.target.toLowerCase() === targetLc) {
        out.push({
          fromPath: entry.path,
          fromName: entry.name,
          line: link.line,
          context: readContext(entry.path, link.line),
        });
      }
    }
  }
  out.sort((a, b) => (a.fromName < b.fromName ? -1 : a.fromName > b.fromName ? 1 : 0));
  return out;
}

export function tags(): TagCount[] {
  const byTag = new Map<string, { count: number; files: string[] }>();
  for (const entry of state.entries.values()) {
    const seen = new Set<string>();
    for (const tag of entry.tags) {
      if (!seen.has(tag)) {
        seen.add(tag);
        const e = byTag.get(tag) ?? { count: 0, files: [] };
        e.count += 1;
        e.files.push(entry.path);
        byTag.set(tag, e);
      }
    }
  }
  const out: TagCount[] = [...byTag.entries()].map(([tag, { count, files }]) => ({
    tag,
    count,
    files,
  }));
  // 计数降序，同数按 tag 升序。
  out.sort((a, b) => b.count - a.count || (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0));
  return out;
}

export function resolve(name: string): string | null {
  const needle = name.trim();
  if (!needle) return null;
  const lc = needle.toLowerCase();
  // 1) stem 精确（不分大小写）
  for (const e of state.entries.values()) if (e.stem.toLowerCase() === lc) return e.path;
  // 2) title(H1) 精确
  for (const e of state.entries.values())
    if (e.title && e.title.toLowerCase() === lc) return e.path;
  // 3) stem 子串
  for (const e of state.entries.values()) if (e.stem.toLowerCase().includes(lc)) return e.path;
  return null;
}

export async function rescan(): Promise<number> {
  const root = state.root;
  if (!root) throw new Error("workspace not initialized");
  state.entries.clear();
  await scanInto(root);
  await saveCache(root);
  emitEvent("eidon:index-updated", "rescan");
  return state.entries.size;
}

// ── 扫描 ────────────────────────────────────────────────────────────
async function scanInto(root: string): Promise<void> {
  const next = new Map<string, IndexEntry>();
  for await (const file of walkMarkdown(root)) {
    try {
      next.set(file, await scanFile(file));
    } catch {
      /* 单文件失败忽略 */
    }
  }
  state.entries = next;
}

async function* walkMarkdown(dir: string): AsyncGenerator<string> {
  let dirents;
  try {
    dirents = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const d of dirents) {
    const full = path.join(dir, d.name);
    if (d.isSymbolicLink()) continue; // follow_links(false)
    if (d.isDirectory()) {
      yield* walkMarkdown(full);
    } else if (d.isFile()) {
      const ext = path.extname(d.name).toLowerCase().replace(/^\./, "");
      if (MD_EXTS.has(ext)) yield full;
    }
  }
}

async function scanFile(file: string): Promise<IndexEntry> {
  const raw = await fs.readFile(file, "utf8");
  const st = await fs.stat(file);
  const mtime = Math.floor(st.mtimeMs / 1000);
  const name = path.basename(file);
  const stem = path.basename(file, path.extname(file));

  const { frontmatter, body } = splitFrontMatter(raw);
  let frontmatterJson: unknown = null;
  if (frontmatter !== null) {
    try {
      // gray-matter 复用项目已有 yaml 引擎；空 frontmatter → {}。
      const parsed = matter(`---\n${frontmatter}\n---\n`);
      frontmatterJson = Object.keys(parsed.data).length ? parsed.data : null;
    } catch {
      frontmatterJson = null;
    }
  }

  const wikilinks = extractWikilinks(body);
  const tagSet = extractBodyTags(body);
  if (frontmatterJson && typeof frontmatterJson === "object") {
    const t = (frontmatterJson as Record<string, unknown>).tags;
    if (t !== undefined) collectYamlTags(t, tagSet);
  }
  const tagsArr = [...new Set(tagSet)].sort();

  const headings = extractHeadings(body);
  const title = extractTitle(frontmatterJson, headings);
  const summary = extractSummary(body);

  return {
    path: file,
    name,
    stem,
    mtime,
    size: st.size,
    frontmatter: frontmatterJson,
    wikilinks,
    tags: tagsArr,
    headings,
    summary,
    title,
  };
}

/** 切分 frontmatter：返回 yaml 文本（无则 null）+ 正文。 */
function splitFrontMatter(raw: string): { frontmatter: string | null; body: string } {
  const trimmed = raw.replace(/^﻿/, "");
  if (!trimmed.startsWith("---")) return { frontmatter: null, body: raw };
  const nl = trimmed.indexOf("\n");
  if (nl === -1) return { frontmatter: null, body: raw };
  const afterFirst = trimmed.slice(nl + 1);
  const end = afterFirst.indexOf("\n---");
  if (end === -1) return { frontmatter: null, body: raw };
  const yaml = afterFirst.slice(0, end);
  let rest = afterFirst.slice(end + "\n---".length);
  if (rest.startsWith("\n")) rest = rest.slice(1);
  return { frontmatter: yaml, body: rest };
}

const WIKILINK_RE = /\[\[([^[\]\n]+?)\]\]/g;

function extractWikilinks(body: string): WikilinkRef[] {
  const out: WikilinkRef[] = [];
  const lines = body.split("\n");
  for (let i = 0; i < lines.length; i++) {
    WIKILINK_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = WIKILINK_RE.exec(lines[i]))) {
      const inner = m[1] ?? "";
      const pipe = inner.indexOf("|");
      let targetRaw: string;
      let alias: string | null;
      if (pipe !== -1) {
        targetRaw = inner.slice(0, pipe).trim();
        alias = inner.slice(pipe + 1).trim();
      } else {
        targetRaw = inner.trim();
        alias = null;
      }
      const hash = targetRaw.indexOf("#");
      let target: string;
      let heading: string | null;
      if (hash !== -1) {
        target = targetRaw.slice(0, hash).trim();
        heading = targetRaw.slice(hash + 1).trim();
      } else {
        target = targetRaw;
        heading = null;
      }
      if (!target) continue;
      out.push({ target, heading, alias, line: i + 1 });
    }
  }
  return out;
}

// ── tags 手写扫描──────────────────────────
function extractBodyTags(body: string): string[] {
  const out: string[] = [];
  let inFence = false;
  for (const line of body.split("\n")) {
    if (line.trimStart().startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    scanTagsInLine(stripInlineCode(line), out);
  }
  return out;
}

function isAlphanumeric(ch: string): boolean {
  // Unicode 感知。
  return /\p{L}|\p{N}/u.test(ch);
}

function scanTagsInLine(line: string, out: string[]): void {
  const chars = [...line];
  const trimmedStartsWithPipe = line.trimStart().startsWith("|");
  for (let i = 0; i < chars.length; i++) {
    if (chars[i] !== "#") continue;
    // `#` 必须在行首或前面是空白。
    if (i > 0 && !/\s/.test(chars[i - 1])) continue;
    // tag 首字符须为 Unicode 字母数字。
    const first = chars[i + 1];
    if (first === undefined || !isAlphanumeric(first)) continue;
    let tag = first;
    let j = i + 2;
    while (j < chars.length) {
      const ch = chars[j];
      if (isAlphanumeric(ch) || ch === "_" || ch === "/" || ch === "-") {
        tag += ch;
        j++;
      } else break;
    }
    if (!tag) continue;
    // a) tag 后须为空白或行尾（否则可能是 CSS 值 `#488878;`）。
    const after = chars[j];
    if (after !== undefined && !/\s/.test(after)) continue;
    // b) 6 位纯 hex → 颜色码。
    if (tag.length === 6 && /^[0-9a-fA-F]{6}$/.test(tag)) continue;
    // c) 表格行内纯数字「tag」是排名/编号，非真 tag。
    if (/^\d+$/.test(tag) && trimmedStartsWithPipe) continue;
    out.push(tag);
  }
}

function stripInlineCode(s: string): string {
  let out = "";
  let inCode = false;
  for (const ch of s) {
    if (ch === "`") {
      inCode = !inCode;
      out += " ";
    } else if (inCode) {
      out += " ";
    } else {
      out += ch;
    }
  }
  return out;
}

function collectYamlTags(value: unknown, out: string[]): void {
  if (typeof value === "string") {
    for (const piece of value.split(/[,\s]+/)) {
      const t = piece.trim().replace(/^#+/, "");
      if (t) out.push(t);
    }
  } else if (Array.isArray(value)) {
    for (const v of value) collectYamlTags(v, out);
  }
}

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*$/;

function extractHeadings(body: string): string[] {
  const out: string[] = [];
  let inFence = false;
  for (const line of body.split("\n")) {
    if (line.trimStart().startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = HEADING_RE.exec(line);
    if (m) out.push(m[2].trim());
  }
  return out;
}

function extractTitle(fm: unknown, headings: string[]): string | null {
  if (fm && typeof fm === "object") {
    const t = (fm as Record<string, unknown>).title;
    if (typeof t === "string") {
      const trimmed = t.trim();
      if (trimmed) return trimmed;
    }
  }
  return headings[0] ?? null;
}

function extractSummary(body: string): string {
  let inFence = false;
  for (const line of body.split("\n")) {
    if (line.trimStart().startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    return [...trimmed].slice(0, 200).join("");
  }
  return "";
}

// ── 监听（chokidar）──────────────────────────────────────────────────
const pending = new Map<string, number>();

function startWatcher(root: string): void {
  const w = watch(root, {
    ignoreInitial: true,
    followSymlinks: false,
    persistent: true,
  });
  const onEvent = (changed: string, removed: boolean): void => {
    const ext = path.extname(changed).toLowerCase().replace(/^\./, "");
    if (!MD_EXTS.has(ext)) return;
    pending.set(changed, Date.now());
    // 去抖：200ms 安静后重扫。
    setTimeout(() => {
      void debouncedRescanOne(changed, removed);
    }, 200);
  };
  w.on("add", (p) => onEvent(p, false));
  w.on("change", (p) => onEvent(p, false));
  w.on("unlink", (p) => onEvent(p, true));
  state.watcher = w;
}

async function debouncedRescanOne(file: string, removed: boolean): Promise<void> {
  const at = pending.get(file);
  if (at === undefined || Date.now() - at < 180) return;
  pending.delete(file);
  let changed = false;
  if (!removed && (await statSafe(file))?.isFile()) {
    try {
      state.entries.set(file, await scanFile(file));
      changed = true;
    } catch {
      /* ignore */
    }
  } else {
    if (state.entries.delete(file)) changed = true;
  }
  if (changed) {
    if (state.root) await saveCache(state.root);
    emitEvent("eidon:index-updated", "watch");
  }
}

async function stopWatcher(): Promise<void> {
  if (state.watcher) {
    await state.watcher.close();
    state.watcher = null;
  }
}

// ── 缓存 ────────────────────────────────────────────────────────────
function cachePath(root: string): string | null {
  const { userData } = getRuntimePaths();
  if (!userData) return null;
  const hash = crypto.createHash("sha256").update(root).digest("hex");
  const dir = path.join(userData, "index");
  try {
    fsSync.mkdirSync(dir, { recursive: true });
  } catch {
    /* ignore */
  }
  return path.join(dir, `${hash.slice(0, 16)}.json`);
}

async function saveCache(root: string): Promise<void> {
  const p = cachePath(root);
  if (!p) return;
  const entries = [...state.entries.values()];
  try {
    await fs.writeFile(p, JSON.stringify(entries, null, 2));
  } catch {
    /* best-effort */
  }
}

async function loadCache(root: string): Promise<IndexEntry[] | null> {
  const p = cachePath(root);
  if (!p) return null;
  try {
    const raw = await fs.readFile(p, "utf8");
    return JSON.parse(raw) as IndexEntry[];
  } catch {
    return null;
  }
}

function readContext(file: string, lineNo: number): string[] {
  let raw: string;
  try {
    raw = fsSync.readFileSync(file, "utf8");
  } catch {
    return [];
  }
  const lines = raw.split("\n");
  const i = Math.max(0, lineNo - 1);
  const out: string[] = [];
  if (i > 0 && lines[i - 1] !== undefined) out.push(lines[i - 1]);
  if (lines[i] !== undefined) out.push(lines[i]);
  if (lines[i + 1] !== undefined) out.push(lines[i + 1]);
  return out;
}

// ── 工具 ────────────────────────────────────────────────────────────
function cmpLower(a: string, b: string): number {
  const al = a.toLowerCase();
  const bl = b.toLowerCase();
  return al < bl ? -1 : al > bl ? 1 : 0;
}

async function statSafe(p: string): Promise<import("node:fs").Stats | null> {
  try {
    return await fs.stat(p);
  } catch {
    return null;
  }
}
