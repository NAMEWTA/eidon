/**
 * 文本编码检测/转换。
 *
 * 行为对齐旧 read_file_inner / write_file_inner：
 *  1) 先 BOM 嗅探（UTF-8 / UTF-16LE / UTF-16BE）；命中则剥 BOM 并按该编码解码。
 *  2) 否则用 jschardet 探测（对中文 GBK/Big5 较强），iconv-lite 解码。
 *  3) 返回的 `encoding` 标签供 write 端按原编码回存（蛇形/大小写归一为稳定标签）。
 * 纯函数、无 electron 依赖，便于单测与跨进程复用。
 */
import jschardet from "jschardet";
import iconv from "iconv-lite";

export interface DecodeResult {
  content: string;
  /** 稳定存储标签（如 "UTF-8" / "GBK" / "Big5"），write 端据此回存。 */
  encoding: string;
  hadBom: boolean;
}

/** BOM 嗅探，对齐旧 sniff_bom。 */
function sniffBom(
  bytes: Buffer,
): { label: string; iconv: string; bomLen: number } | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf
  ) {
    return { label: "UTF-8", iconv: "utf8", bomLen: 3 };
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { label: "UTF-16LE", iconv: "utf16-le", bomLen: 2 };
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return { label: "UTF-16BE", iconv: "utf16-be", bomLen: 2 };
  }
  return null;
}

/** jschardet 探测名 → { 稳定存储标签, iconv 解码名 }。 */
function normalizeForDecode(detected: string | null): {
  label: string;
  iconv: string;
} {
  const name = (detected ?? "").toLowerCase().replace(/[_\s]/g, "-");
  switch (name) {
    case "utf-8":
    case "ascii":
      return { label: "UTF-8", iconv: "utf8" };
    case "utf-16le":
      return { label: "UTF-16LE", iconv: "utf16-le" };
    case "utf-16be":
      return { label: "UTF-16BE", iconv: "utf16-be" };
    case "gb2312":
    case "gb18030":
    case "gbk":
    case "hz-gb-2312":
    case "x-gbk":
      // gb18030 是 GBK/GB2312 的超集，解码最稳；标签保留 "GBK"（输出稳定）。
      return { label: "GBK", iconv: "gb18030" };
    case "big5":
      return { label: "Big5", iconv: "big5" };
    case "shift-jis":
    case "sjis":
      return { label: "Shift_JIS", iconv: "shiftjis" };
    case "euc-jp":
      return { label: "EUC-JP", iconv: "eucjp" };
    case "euc-kr":
      return { label: "EUC-KR", iconv: "euckr" };
    case "koi8-r":
      return { label: "KOI8-R", iconv: "koi8-r" };
    default:
      if (detected && iconv.encodingExists(detected)) {
        return { label: detected, iconv: detected };
      }
      return { label: "UTF-8", iconv: "utf8" };
  }
}

/** 检测并解码为 JS 字符串，返回内容 + 原编码标签 + 是否带 BOM。 */
export function detectAndDecode(bytes: Buffer): DecodeResult {
  const bom = sniffBom(bytes);
  if (bom) {
    const body = bytes.subarray(bom.bomLen);
    return {
      content: iconv.decode(Buffer.from(body), bom.iconv),
      encoding: bom.label,
      hadBom: true,
    };
  }
  if (bytes.length === 0) {
    return { content: "", encoding: "UTF-8", hadBom: false };
  }
  const detected = jschardet.detect(bytes);
  const { label, iconv: dec } = normalizeForDecode(detected?.encoding ?? null);
  return { content: iconv.decode(bytes, dec), encoding: label, hadBom: false };
}

/** 标签 → iconv 编码名（无法识别回退 UTF-8，对齐旧 for_label().unwrap_or(UTF_8)）。 */
function normalizeForEncode(encoding: string): string {
  const name = encoding.toLowerCase().replace(/[_\s]/g, "-");
  switch (name) {
    case "utf-8":
      return "utf8";
    case "utf-16le":
      return "utf16-le";
    case "utf-16be":
      return "utf16-be";
    case "gbk":
    case "gb2312":
    case "gb18030":
      return "gbk";
    case "big5":
      return "big5";
    case "shift-jis":
    case "sjis":
      return "shiftjis";
    case "euc-jp":
      return "eucjp";
    case "euc-kr":
      return "euckr";
    default:
      return iconv.encodingExists(encoding) ? encoding : "utf8";
  }
}

/** 把 UTF-8 JS 字符串编码为指定编码的字节。 */
export function encodeContent(content: string, encoding: string): Buffer {
  return iconv.encode(content, normalizeForEncode(encoding));
}
