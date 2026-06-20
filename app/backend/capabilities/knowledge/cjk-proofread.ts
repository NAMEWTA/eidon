/**
 * 中文排版校对。
 *
 * 纯字符/正则规则、零网络、确定性，简繁同处理。输出扁平 Issue[]，位置为 **UTF-8 字节偏移**
 * （colStart/colEnd，1-based line），渲染层 CjkProofread.tsx 用 TextEncoder 字节切片消费。
 * 六类检测：半角标点、Latin 引号包汉字、的/地误用、叠字、中西文间距、数字单位间距。
 */
import type { CjkIssue } from "@shared/models";
import { charIndices, utf8Len, LineIndex } from "./byte-offsets";

export function cjkProofread(text: string): CjkIssue[] {
  if (!text) return [];
  const out: CjkIssue[] = [];
  const idx = new LineIndex(text);
  const buf = Buffer.from(text, "utf8");

  detectHalfwidthPunct(text, idx, out);
  detectLatinQuotes(buf, idx, out);
  detectDeMisuse(buf, idx, out);
  detectRepeatChars(text, buf, idx, out);
  detectCjkLatinSpace(text, buf, idx, out);
  detectDigitUnitSpace(buf, idx, out);

  out.sort((a, b) => a.colStart - b.colStart || a.colEnd - b.colEnd);
  return out;
}

// ── 工具 ────────────────────────────────────────────────────────────
function isHan(c: string): boolean {
  const cp = c.codePointAt(0) ?? 0;
  return (
    (cp >= 0x3400 && cp <= 0x4dbf) ||
    (cp >= 0x4e00 && cp <= 0x9fff) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0x20000 && cp <= 0x2a6df) ||
    (cp >= 0x2a700 && cp <= 0x2b73f) ||
    (cp >= 0x2b740 && cp <= 0x2b81f) ||
    (cp >= 0x2b820 && cp <= 0x2ceaf)
  );
}

function isLatinOrDigit(c: string): boolean {
  return /^[A-Za-z0-9]$/.test(c);
}

function halfwidthToFullwidth(c: string): string | null {
  switch (c) {
    case ",":
      return "，";
    case ".":
      return "。";
    case "?":
      return "？";
    case "!":
      return "！";
    case ":":
      return "：";
    case ";":
      return "；";
    default:
      return null;
  }
}

/** 从字节偏移 i 解码一个 UTF-8 码点。 */
function decodeCharAt(buf: Buffer, i: number): { char: string; len: number } | null {
  if (i >= buf.length) return null;
  const b0 = buf[i];
  let len = 1;
  if (b0 >= 0xf0) len = 4;
  else if (b0 >= 0xe0) len = 3;
  else if (b0 >= 0xc0) len = 2;
  const s = buf.subarray(i, i + len).toString("utf8");
  return { char: [...s][0] ?? s, len };
}

function slice(buf: Buffer, a: number, b: number): string {
  return buf.subarray(a, b).toString("utf8");
}

// ── 检测器 ──────────────────────────────────────────────────────────
function detectHalfwidthPunct(text: string, idx: LineIndex, out: CjkIssue[]): void {
  let prev: string | null = null;
  for (const [byteOff, c] of charIndices(text)) {
    const replacement = halfwidthToFullwidth(c);
    if (replacement !== null && prev !== null && isHan(prev)) {
      const len = utf8Len(c);
      out.push({
        line: idx.lineOf(byteOff),
        colStart: byteOff,
        colEnd: byteOff + len,
        severity: "high",
        category: "punct_halfwidth",
        original: c,
        suggestion: replacement,
        explanation: `汉字之后应使用全角标点 ${replacement} 而非半角 ${c}`,
      });
    }
    prev = c;
  }
}

function detectLatinQuotes(buf: Buffer, idx: LineIndex, out: CjkIssue[]): void {
  detectQuotePair(buf, idx, 0x22, "“", "”", out); // "
  detectQuotePair(buf, idx, 0x27, "‘", "’", out); // '
}

function detectQuotePair(
  buf: Buffer,
  idx: LineIndex,
  qByte: number,
  open: string,
  close: string,
  out: CjkIssue[],
): void {
  let i = 0;
  while (i < buf.length) {
    if (buf[i] !== qByte) {
      i += 1;
      continue;
    }
    let j = i + 1;
    while (j < buf.length) {
      if (buf[j] === 0x0a) break; // newline
      if (buf[j] === qByte) break;
      j += 1;
    }
    if (j >= buf.length || buf[j] !== qByte) {
      i += 1;
      continue;
    }
    const inner = slice(buf, i + 1, j);
    if (!inner) {
      i = j + 1;
      continue;
    }
    let sawHan = false;
    for (const c of inner) {
      if (isHan(c)) {
        sawHan = true;
        break;
      }
    }
    if (sawHan) {
      out.push({
        line: idx.lineOf(i),
        colStart: i,
        colEnd: j + 1,
        severity: "high",
        category: "latin_quotes",
        original: slice(buf, i, j + 1),
        suggestion: `${open}${inner}${close}`,
        explanation: `中文文本应使用全角引号 ${open}…${close}`,
      });
    }
    i = j + 1;
  }
}

const ADVERB_STEMS = [
  "非常", "突然", "仔细", "认真", "慢慢", "渐渐", "悄悄", "默默",
  "轻轻", "重重", "深深", "静静", "缓缓", "匆匆", "急急", "渐次",
  "迅速", "迅猛", "猛烈", "剧烈", "热烈", "强烈", "顺利", "完美",
  "高兴", "愉快", "愤怒", "兴奋", "激动", "勇敢", "亲切",
];

function detectDeMisuse(buf: Buffer, idx: LineIndex, out: CjkIssue[]): void {
  const deLen = utf8Len("的");
  for (const stem of ADVERB_STEMS) {
    const needle = Buffer.from(`${stem}的`, "utf8");
    const stemLen = utf8Len(stem);
    let start = 0;
    let abs: number;
    while ((abs = buf.indexOf(needle, start)) !== -1) {
      const deStart = abs + stemLen;
      const deEnd = deStart + deLen;
      const next = decodeCharAt(buf, deEnd);
      if (next && isHan(next.char)) {
        out.push({
          line: idx.lineOf(deStart),
          colStart: deStart,
          colEnd: deEnd,
          severity: "medium",
          category: "de_misuse",
          original: "的",
          suggestion: "地",
          explanation: `副词 “${stem}” 修饰动词时应用 “地” 而非 “的”`,
        });
      }
      start = abs + needle.length;
    }
  }
}

const REPEAT_CANDIDATES = new Set(["的", "了", "是", "在", "和", "与", "及"]);

function detectRepeatChars(text: string, buf: Buffer, idx: LineIndex, out: CjkIssue[]): void {
  const chars: Array<[number, string]> = [...charIndices(text)];
  let i = 0;
  while (i < chars.length) {
    const [off, c] = chars[i];
    if (!REPEAT_CANDIDATES.has(c)) {
      i += 1;
      continue;
    }
    let runEnd = i + 1;
    while (runEnd < chars.length && chars[runEnd][1] === c) runEnd += 1;
    if (runEnd - i >= 2) {
      const [lastOff, lastChar] = chars[runEnd - 1];
      const endByte = lastOff + utf8Len(lastChar);
      out.push({
        line: idx.lineOf(off),
        colStart: off,
        colEnd: endByte,
        severity: "low",
        category: "repeat",
        original: slice(buf, off, endByte),
        suggestion: c,
        explanation: `疑似重复的 “${c}”，请确认是否为笔误`,
      });
    }
    i = runEnd;
  }
}

function detectCjkLatinSpace(text: string, buf: Buffer, idx: LineIndex, out: CjkIssue[]): void {
  let prev: [number, string] | null = null;
  for (const [byteOff, c] of charIndices(text)) {
    if (prev !== null) {
      const [pOff, p] = prev;
      const hanThenLatin = isHan(p) && isLatinOrDigit(c);
      const latinThenHan = isLatinOrDigit(p) && isHan(c);
      if (hanThenLatin || latinThenHan) {
        const end = byteOff + utf8Len(c);
        out.push({
          line: idx.lineOf(pOff),
          colStart: pOff,
          colEnd: end,
          severity: "low",
          category: "cjk_latin_space",
          original: slice(buf, pOff, end),
          suggestion: `${p}\u202F${c}`, // U+202F NARROW NO-BREAK SPACE
          explanation: "汉字与西文/数字之间建议加窄空格",
        });
      }
    }
    prev = [byteOff, c];
  }
}

// 多字符单位须排在其子串前（min 在 m 前），最长匹配优先。
const UNITS = [
  "GHz", "MHz", "kHz", "GB", "MB", "KB", "TB", "PB", "kg", "mg", "cm",
  "mm", "km", "min", "sec", "ms", "us", "ns", "Hz", "h", "s", "m",
];

function detectDigitUnitSpace(buf: Buffer, idx: LineIndex, out: CjkIssue[]): void {
  let i = 0;
  const isDigit = (b: number): boolean => b >= 0x30 && b <= 0x39;
  const isAsciiAlpha = (c: string): boolean => /^[A-Za-z]$/.test(c);
  while (i < buf.length) {
    if (!isDigit(buf[i])) {
      i += 1;
      continue;
    }
    const digitStart = i;
    while (i < buf.length && isDigit(buf[i])) i += 1;
    const afterDigits = i;
    const rest = slice(buf, afterDigits, buf.length);
    let matchedUnit: string | null = null;
    for (const u of UNITS) {
      if (rest.startsWith(u)) {
        const afterUnit = afterDigits + Buffer.byteLength(u, "utf8");
        const afterChar = decodeCharAt(buf, afterUnit);
        const nextIsAlpha = afterChar !== null && isAsciiAlpha(afterChar.char);
        if (!nextIsAlpha) {
          matchedUnit = u;
          break;
        }
      }
    }
    if (matchedUnit === null) continue;
    const afterUnit = afterDigits + Buffer.byteLength(matchedUnit, "utf8");
    const nextChar = decodeCharAt(buf, afterUnit);
    if (!nextChar || !isHan(nextChar.char)) continue;
    const end = afterUnit + nextChar.len;
    const digits = slice(buf, digitStart, afterDigits);
    out.push({
      line: idx.lineOf(digitStart),
      colStart: digitStart,
      colEnd: end,
      severity: "low",
      category: "digit_unit_space",
      original: slice(buf, digitStart, end),
      suggestion: `${digits} ${matchedUnit} ${nextChar.char}`,
      explanation: "数字与单位之间、单位与汉字之间建议加空格",
    });
  }
}
