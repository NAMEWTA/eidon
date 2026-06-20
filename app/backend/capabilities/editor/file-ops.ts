/**
 * 文件 I/O 能力。
 *
 * 纯 node:fs（+ 编码/自写抑制），无 electron 依赖，保持可单测、可被 domain 层直接复用。
 * 行为与命名稳定：拒绝覆盖已存在、删除幂等、rename 跟随 `<stem>.assets/` 并改写正文引用、
 * list_dir 用 Dirent 类型免逐项 stat（Windows 性能教训）+ 隐藏项过滤 + 10k 截断哨兵 + 目录优先排序。
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import type { FileReadResult, FsDirEntry } from "@shared/models";
import { detectAndDecode, encodeContent } from "./encoding";
import { markSelfWrite } from "./watcher";

// ── 读写 ────────────────────────────────────────────────────────────
export async function readFile(filePath: string): Promise<FileReadResult> {
  const bytes = await fs.readFile(filePath);
  const { content, encoding, hadBom } = detectAndDecode(bytes);
  return {
    content,
    encoding,
    language: detectLanguage(filePath),
    hadBom: hadBom,
  };
}

export async function writeFile(
  filePath: string,
  content: string,
  encoding: string,
): Promise<void> {
  const buf = encodeContent(content, encoding);
  await fs.writeFile(filePath, buf);
  // 标记自写：传入实际写入的字节，供 watcher 按内容哈希抑制随之而来的回声事件
  // （取代旧的时间窗口方案，杜绝「保存即误报外部修改」）。
  markSelfWrite(filePath, buf);
}

export async function readBinaryFile(filePath: string): Promise<Uint8Array> {
  return await fs.readFile(filePath);
}

export async function writeBinaryFile(
  filePath: string,
  data: Uint8Array | number[],
): Promise<void> {
  const parent = path.dirname(filePath);
  if (parent) await fs.mkdir(parent, { recursive: true });
  // 渲染层经 IPC 可能传 number[]（渲染层旧习惯）；Buffer.from 同时接受两者。
  await fs.writeFile(filePath, Buffer.from(data));
}

export async function copyFile(src: string, dst: string): Promise<void> {
  const parent = path.dirname(dst);
  if (parent) await fs.mkdir(parent, { recursive: true });
  await fs.copyFile(src, dst);
}

// ── 文件树编辑：拒绝覆盖 / 幂等删除 / rename 跟随 assets ─────────────
export async function createFile(
  filePath: string,
  content: string | null,
): Promise<void> {
  if (await pathExists(filePath)) throw new Error(`already exists: ${filePath}`);
  const parent = path.dirname(filePath);
  if (parent) await fs.mkdir(parent, { recursive: true });
  await fs.writeFile(filePath, content ?? "");
}

export async function createDir(dirPath: string): Promise<void> {
  if (await pathExists(dirPath)) throw new Error(`already exists: ${dirPath}`);
  await fs.mkdir(dirPath, { recursive: true });
}

export async function deletePath(targetPath: string): Promise<void> {
  // 幂等：已不存在也算成功。
  await fs.rm(targetPath, { recursive: true, force: true });
}

export async function rename(from: string, to: string): Promise<void> {
  if (!(await pathExists(from))) throw new Error(`source missing: ${from}`);
  if (await pathExists(to)) throw new Error(`target already exists: ${to}`);

  // 每文件 `<stem>.assets/` 跟随（v4.3.5 行为）：主 rename 优先成功，assets 与正文改写均为尽力而为。
  const fromAssets = siblingAssetsDir(from);
  const toAssets = siblingAssetsDir(to);
  const stemsDiffer =
    fromAssets && toAssets
      ? path.basename(fromAssets) !== path.basename(toAssets)
      : false;

  await fs.rename(from, to);

  if (fromAssets && toAssets) {
    try {
      const st = await statSafe(fromAssets);
      if (st?.isDirectory() && !(await pathExists(toAssets))) {
        await fs.rename(fromAssets, toAssets);
        if (stemsDiffer && isMarkdownPath(to)) {
          await rewriteAssetsRefs(to, fromAssets, toAssets).catch((e) =>
            console.error("[rename] body rewrite failed:", e),
          );
        }
      }
    } catch (e) {
      console.error("[rename] assets folder rename failed:", e);
    }
  }
}

// ── 列目录 ──────────────────────────────────────────────────────────
const LIST_DIR_HARD_CAP = 10_000;

export async function listDir(
  dirPath: string,
  includeHidden: boolean,
): Promise<FsDirEntry[]> {
  let dirents;
  try {
    dirents = await fs.readdir(dirPath, { withFileTypes: true });
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    throw Object.assign(new Error(`read_dir failed: ${err.message}`), { code: err.code });
  }

  const entries: FsDirEntry[] = [];
  let truncated = false;
  for (const d of dirents) {
    if (entries.length >= LIST_DIR_HARD_CAP) {
      truncated = true;
      break;
    }
    if (!includeHidden && d.name.startsWith(".")) continue;
    // Dirent.isDirectory() 来自一次性目录扫描的缓存类型，免逐项 stat（Windows 性能）。
    entries.push({
      name: d.name,
      path: path.join(dirPath, d.name),
      isDir: d.isDirectory(),
    });
  }

  // 目录优先，其次按小写名码点序。
  entries.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    const al = a.name.toLowerCase();
    const bl = b.name.toLowerCase();
    return al < bl ? -1 : al > bl ? 1 : 0;
  });

  if (truncated) {
    // 截断哨兵：UI 据此名 + isDir=false 过滤并提示「+N more」，免二次 IPC。
    entries.push({ name: "__eidon_truncated__", path: "", isDir: false });
  }
  return entries;
}

// ── 内部工具 ────────────────────────────────────────────────────────
export function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase().replace(/^\./, "");
  return ext === "md" || ext === "markdown" || ext === "mdown" || ext === "mkd"
    ? "markdown"
    : "plaintext";
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function statSafe(p: string): Promise<import("node:fs").Stats | null> {
  try {
    return await fs.stat(p);
  } catch {
    return null;
  }
}

/** `/a/b/foo.md` → `/a/b/foo.assets`（无 stem 返回 null）。 */
function siblingAssetsDir(filePath: string): string | null {
  const stem = path.basename(filePath, path.extname(filePath));
  if (!stem) return null;
  return path.join(path.dirname(filePath), `${stem}.assets`);
}

function isMarkdownPath(p: string): boolean {
  const ext = path.extname(p).toLowerCase();
  return ext === ".md" || ext === ".markdown" || ext === ".mdown" || ext === ".mkd";
}

/** 把正文中 `<old>.assets/` 引用改写为 `<new>.assets/`；非 UTF-8 正文跳过。 */
async function rewriteAssetsRefs(
  file: string,
  oldAssets: string,
  newAssets: string,
): Promise<void> {
  const oldName = path.basename(oldAssets);
  const newName = path.basename(newAssets);
  const bytes = await fs.readFile(file);
  const body = bytes.toString("utf8");
  // 校验 UTF-8 有效性：往返不等说明含非法字节，跳过改写（非法字节即跳过）。
  if (Buffer.compare(Buffer.from(body, "utf8"), bytes) !== 0) return;
  const oldPat = `${oldName}/`;
  if (!body.includes(oldPat)) return;
  const rewritten = body.split(oldPat).join(`${newName}/`);
  await fs.writeFile(file, rewritten);
}
