/**
 * 多格式 → Markdown 导入。
 *
 * 内建转换：docx(mammoth+turndown) / html / csv / xlsx / json / xml / pptx / pdf。
 * 兜底：epub / 图片 / 音频 走 markitdown CLI（装了才行，缺失给安装提示）。
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { promises as fs } from "node:fs";
import path from "node:path";
import mammoth from "mammoth";
import TurndownService from "turndown";
import * as XLSX from "xlsx";
import { parse as parseCsv } from "csv-parse/sync";
import { detectAndDecode } from "./encoding";

const execFileP = promisify(execFile);
const isWindows = process.platform === "win32";

export async function convertFileToMarkdown(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase().replace(/^\./, "");
  switch (ext) {
    case "docx":
      return convertDocx(filePath);
    case "html":
    case "htm":
      return convertHtml(filePath);
    case "csv":
      return convertCsv(filePath);
    case "xlsx":
    case "xls":
      return convertXlsx(filePath);
    case "json":
      return convertJson(filePath);
    case "xml":
      return convertXml(filePath);
    case "pptx":
      return convertPptx(filePath);
    case "pdf":
      return convertPdf(filePath);
    case "epub":
    case "jpg":
    case "jpeg":
    case "png":
    case "gif":
    case "webp":
    case "bmp":
    case "mp3":
    case "wav":
    case "m4a":
    case "ogg":
    case "flac":
      return convertViaMarkitdown(filePath, ext);
    default:
      throw new Error(`Unsupported file type: .${ext}`);
  }
}

const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });

async function readWithEncoding(filePath: string): Promise<string> {
  const bytes = await fs.readFile(filePath);
  return detectAndDecode(bytes).content;
}

async function convertDocx(filePath: string): Promise<string> {
  // mammoth 官方推荐：docx → 干净 HTML → turndown → markdown（自带 md 输出已弃用）。
  const { value: html } = await mammoth.convertToHtml({ path: filePath });
  return turndown.turndown(html).trim();
}

async function convertHtml(filePath: string): Promise<string> {
  const raw = await readWithEncoding(filePath);
  return turndown.turndown(stripHtmlNoise(raw)).trim();
}

function stripHtmlNoise(html: string): string {
  let s = html;
  for (const tag of ["style", "script", "head", "nav", "footer", "noscript"]) {
    s = s.replace(new RegExp(`<${tag}[\\s>][\\s\\S]*?</${tag}\\s*>`, "gi"), "");
  }
  return s.replace(/<!--[\s\S]*?-->/g, "");
}

function toMarkdownTable(rows: string[][]): string {
  if (rows.length === 0) return "";
  const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
  const width = Math.max(...rows.map((r) => r.length));
  const norm = rows.map((r) => Array.from({ length: width }, (_, i) => esc(r[i] ?? "")));
  const head = `| ${norm[0].join(" | ")} |`;
  const sep = `| ${norm[0].map(() => "---").join(" | ")} |`;
  const body = norm.slice(1).map((r) => `| ${r.join(" | ")} |`);
  return [head, sep, ...body].join("\n");
}

async function convertCsv(filePath: string): Promise<string> {
  // CSV 在中文环境常为 GBK：先按编码探测读为字符串再解析。
  const text = await readWithEncoding(filePath);
  const rows = parseCsv(text, {
    relax_column_count: true,
    skip_empty_lines: false,
  }) as string[][];
  return toMarkdownTable(rows).trim();
}

async function convertXlsx(filePath: string): Promise<string> {
  const wb = XLSX.readFile(filePath, { cellDates: false });
  const parts: string[] = [];
  const multi = wb.SheetNames.length > 1;
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json<string[]>(ws, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false,
    });
    if (rows.length === 0) continue;
    if (multi) parts.push(`## ${name}`);
    parts.push(toMarkdownTable(rows.map((r) => r.map((c) => String(c ?? "")))));
  }
  return parts.join("\n\n").trim();
}

async function convertJson(filePath: string): Promise<string> {
  const raw = await readWithEncoding(filePath);
  let pretty = raw;
  try {
    pretty = JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    /* 非法 JSON：原样 fence */
  }
  return `\`\`\`json\n${pretty}\n\`\`\``;
}

async function convertXml(filePath: string): Promise<string> {
  const raw = await readWithEncoding(filePath);
  return `\`\`\`xml\n${raw}\n\`\`\``;
}

// ── PDF ─────────────────────────────────────────────────────────────
function isPdfGarbage(line: string): boolean {
  if (line.length > 20 && !line.includes(" ")) {
    const alnum = (line.match(/[\p{L}\p{N}\-_~]/gu) ?? []).length;
    if (alnum / line.length > 0.85) return true;
  }
  return line.endsWith("~~") && line.length > 10;
}

function cleanPdfLine(line: string): string {
  return line
    .split(/\s+/)
    .filter((w) => !isPdfGarbage(w))
    .join(" ");
}

async function convertPdf(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  let text = "";
  try {
    const mod = (await import("pdf-parse")) as unknown as Record<string, unknown>;
    const fn = (mod.default ?? (mod as { pdf?: unknown }).pdf ?? mod) as (
      b: Buffer,
    ) => Promise<{ text: string }>;
    const result = await fn(buffer);
    text = result?.text ?? "";
  } catch (e) {
    throw new Error(`PDF extraction failed: ${(e as Error).message}`);
  }
  if (!text.trim()) {
    throw new Error(
      "No text found in PDF (scanned/image PDF). For OCR, install markitdown: pip install 'markitdown[all]'",
    );
  }
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      out.push("");
      continue;
    }
    if (isPdfGarbage(trimmed)) continue;
    const cleaned = cleanPdfLine(trimmed).trim();
    if (cleaned) out.push(cleaned);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// ── PPTX ────────────────────────────────────────────────────────────
function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, "&");
}

function extractPptxTexts(xml: string): string[] {
  const paragraphs: string[] = [];
  const blocks = xml.match(/<a:p\b[\s\S]*?<\/a:p>/g) ?? [];
  const tRegex = /<a:t\b[^>]*>([\s\S]*?)<\/a:t>/g;
  for (const block of blocks) {
    let cur = "";
    let m: RegExpExecArray | null;
    tRegex.lastIndex = 0;
    while ((m = tRegex.exec(block))) cur += decodeXmlEntities(m[1]);
    const t = cur.trim();
    if (t) paragraphs.push(t);
  }
  return paragraphs;
}

async function convertPptx(filePath: string): Promise<string> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(await fs.readFile(filePath));
  const slideNames = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
      const nb = Number(b.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
      return na - nb;
    });
  const parts: string[] = [];
  for (let i = 0; i < slideNames.length; i++) {
    const xml = await zip.files[slideNames[i]].async("string");
    const texts = extractPptxTexts(xml);
    if (texts.length) {
      parts.push(`## Slide ${i + 1}`, ...texts);
    }
  }
  if (parts.length === 0) throw new Error("No text content found in PPTX");
  return parts.join("\n\n").trim();
}

// ── markitdown 兜底 ─────────────────────────────────────────────────
async function convertViaMarkitdown(filePath: string, ext: string): Promise<string> {
  try {
    await execFileP(isWindows ? "where" : "which", ["markitdown"]);
  } catch {
    throw new Error(
      `Converting .${ext} files requires markitdown. Install with:\npip install 'markitdown[all]'`,
    );
  }
  try {
    const { stdout } = await execFileP("markitdown", [filePath], {
      maxBuffer: 64 * 1024 * 1024,
    });
    return stdout.trim();
  } catch (e) {
    const err = e as { stderr?: string; message?: string };
    throw new Error(`markitdown failed: ${err.stderr?.trim() || err.message}`);
  }
}
