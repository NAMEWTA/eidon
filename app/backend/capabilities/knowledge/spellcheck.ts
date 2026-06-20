/**
 * 拼写检查（nspell + en_US Hunspell 词典）。
 *
 * 与旧实现一致：仅 Latin（正则 `[A-Za-z][A-Za-z'-]*`），跳过 ALL-CAPS 缩写与单字母；
 * start/end 为 **UTF-8 字节偏移**（渲染层 cm-spellcheck.ts 据此 byte→char）。
 * 用户词典存 `<userConfig>/user-dict-<lang>.txt`，init 时合并、add 时落盘 + 内存即时生效。
 * 字典经 runtime-paths.dicts 解析（生产 resourcesPath/dicts，dev app/resources/dicts）。
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import nspell from "nspell";
import type { Misspelling } from "@shared/models";
import { getRuntimePaths } from "../runtime-paths";
import { charIndexToByte } from "./byte-offsets";

interface State {
  speller: ReturnType<typeof nspell> | null;
  userDictPath: string | null;
}

const state: State = { speller: null, userDictPath: null };

// `[A-Za-z][A-Za-z'-]*`（与 CM6 插件保持一致）。
const WORD_RE = /[A-Za-z][A-Za-z'-]*/g;

function normalizeLang(lang: string): string {
  const l = lang.trim();
  if (!l) return "en_US";
  switch (l.toLowerCase()) {
    case "en":
    case "en-us":
    case "en_us":
    case "english":
      return "en_US";
    default:
      return l;
  }
}

/** 加载 <lang> 词典，返回词数（取 .dic 首行，Hunspell 约定）供前端状态显示。 */
export async function spellInit(lang: string): Promise<number> {
  const langNorm = normalizeLang(lang);
  const { dicts, userConfig } = getRuntimePaths();
  const affPath = path.join(dicts, `${langNorm}.aff`);
  const dicPath = path.join(dicts, `${langNorm}.dic`);

  const [aff, dic] = await Promise.all([
    fs.readFile(affPath),
    fs.readFile(dicPath),
  ]);

  const speller = nspell({ aff, dic });

  // 合并用户词典（缺失非错）。
  const userPath = path.join(userConfig, `user-dict-${langNorm}.txt`);
  try {
    const text = await fs.readFile(userPath, "utf8");
    for (const raw of text.split("\n")) {
      const w = raw.trim();
      if (!w || w.startsWith("#")) continue;
      speller.add(w);
    }
  } catch {
    /* 无用户词典 */
  }

  // 词数 ≈ .dic 首行数字。
  const firstLine = dic.toString("utf8").split("\n")[0]?.trim() ?? "";
  const count = /^\d+$/.test(firstLine) ? parseInt(firstLine, 10) : 0;

  state.speller = speller;
  state.userDictPath = userPath;
  return count;
}

/** 返回 text 中词典拒绝的每个 Latin run（CJK/非 Latin 天然跳过）。 */
export function spellCheck(text: string): Misspelling[] {
  const speller = state.speller;
  if (!speller) return []; // 未初始化：返回空而非报错（前端去抖循环友好）。

  const out: Misspelling[] = [];
  WORD_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = WORD_RE.exec(text))) {
    const word = m[0];
    // 去掉首尾 `'`/`-`（正则允许中段）。
    const trimmed = word.replace(/^['-]+|['-]+$/g, "");
    if (!trimmed) continue;
    if (trimmed.length <= 1) continue;
    if (trimmed === trimmed.toUpperCase() && /^[A-Z]+$/.test(trimmed)) continue; // ALL-CAPS 缩写
    if (!speller.correct(trimmed)) {
      // 用原始（未 trim）span 边界，高亮用户所见整 token。
      out.push({
        word,
        start: charIndexToByte(text, m.index),
        end: charIndexToByte(text, m.index + word.length),
      });
    }
  }
  return out;
}

/** 返回最多 5 条建议。 */
export function spellSuggest(word: string): string[] {
  const speller = state.speller;
  if (!speller) return [];
  return speller.suggest(word).slice(0, 5);
}

/** 把 word 追加到用户词典文件并内存即时生效。 */
export async function spellAdd(word: string): Promise<void> {
  const trimmed = word.trim();
  if (!trimmed) throw new Error("empty word");

  if (state.speller) state.speller.add(trimmed);

  const p = state.userDictPath;
  if (!p) throw new Error("user dict path not set — call spellInit first");
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.appendFile(p, `${trimmed}\n`);
}

/** 返回当前用户词典内容（去注释/空行）。 */
export async function spellLoadUser(): Promise<string[]> {
  const p = state.userDictPath;
  if (!p) return [];
  let raw: string;
  try {
    raw = await fs.readFile(p, "utf8");
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const line of raw.split("\n")) {
    const w = line.trim();
    if (!w || w.startsWith("#")) continue;
    out.push(w);
  }
  return out;
}
