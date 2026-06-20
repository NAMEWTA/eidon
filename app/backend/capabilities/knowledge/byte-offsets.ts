/**
 * UTF-8 字节偏移工具。
 *
 * spellcheck / cjk-proofread 的 start/end/col_* 是 **UTF-8 字节偏移**，
 * 渲染层（cm-spellcheck.ts / CjkProofread.tsx）据此做 byte→char 转换并用 TextEncoder 字节切片。
 * 为保持线协议零改动，这里的端口同样产出字节偏移：用 Buffer 做字节级切片/检索，
 * 用带字节计数的码点迭代产出 [字节偏移, 码点]。
 */

/** 单个码点的 UTF-8 字节长度。 */
export function utf8Len(ch: string): number {
  return Buffer.byteLength(ch, "utf8");
}

/** 带字节计数的码点迭代：产出 [字节偏移, 码点] 序列。 */
export function* charIndices(text: string): Generator<[number, string]> {
  let b = 0;
  for (const ch of text) {
    yield [b, ch];
    b += utf8Len(ch);
  }
}

/** UTF-16 索引（regex match.index）→ UTF-8 字节偏移。 */
export function charIndexToByte(text: string, charIndex: number): number {
  return Buffer.byteLength(text.slice(0, charIndex), "utf8");
}

/** 字节偏移 → 1-based 行号。 */
export class LineIndex {
  private starts: number[];
  constructor(text: string) {
    const buf = Buffer.from(text, "utf8");
    const starts = [0];
    for (let i = 0; i < buf.length; i++) {
      if (buf[i] === 0x0a) starts.push(i + 1);
    }
    this.starts = starts;
  }
  /** 给定字节偏移返回 1-based 行号。 */
  lineOf(byte: number): number {
    // 找到 <= byte 的最大 line start。二分。
    let lo = 0;
    let hi = this.starts.length - 1;
    let ans = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (this.starts[mid] <= byte) {
        ans = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return ans + 1;
  }
}
