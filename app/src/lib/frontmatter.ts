/**
 * frontmatter.ts — Markdown YAML frontmatter 的结构化解析与回写。
 *
 * 与 `markdown.ts` 里只读渲染用的 `renderFrontMatterHtml` 不同：这里提供
 * 「拆分 → 编辑 data → 拼回全文」的双向能力，供「文件属性」面板编辑后写回 md。
 * 复用已装依赖 `js-yaml`（与 markdown.ts 同一套解析器）。
 *
 * 通用元字段 `UNIVERSAL_FIELDS`（title / tags / created / updated）所有 md 文件统一拥有，
 * 序列化时固定排在最前；其余键作为「扩展字段」按原顺序跟随。
 */
import yaml from 'js-yaml';

/** 首块 frontmatter：`---\n…\n---`（兼容 CRLF，结尾换行可有可无）。 */
const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

export type UniversalFieldType = 'text' | 'tags' | 'date';

export interface UniversalField {
  key: string;
  type: UniversalFieldType;
}

/** 所有 md 文件统一拥有的通用元字段（显示在文件属性最上方，序列化时排最前）。 */
export const UNIVERSAL_FIELDS: ReadonlyArray<UniversalField> = [
  { key: 'title', type: 'text' },
  { key: 'tags', type: 'tags' },
  { key: 'created', type: 'date' },
  { key: 'updated', type: 'date' },
];

export const UNIVERSAL_KEYS: ReadonlySet<string> = new Set(UNIVERSAL_FIELDS.map((f) => f.key));

export interface ParsedFrontMatter {
  /** 解析出的 frontmatter 键值对（无 frontmatter 或非 map 时为空对象）。 */
  data: Record<string, unknown>;
  /** frontmatter 之后的正文（无 frontmatter 时即原文）。 */
  body: string;
  /** 是否存在合法的 frontmatter 块。 */
  hasFM: boolean;
}

/**
 * 拆分 frontmatter 与正文。
 * - 无 `---` 块、YAML 非法、或顶层不是 key/value map → `{ data:{}, body: 原文, hasFM:false }`，
 *   绝不吞掉正文（避免误判损坏文件）。
 */
export function splitFrontMatter(raw: string): ParsedFrontMatter {
  const text = raw ?? '';
  const m = FM_RE.exec(text);
  if (!m) return { data: {}, body: text, hasFM: false };
  let parsed: unknown;
  try {
    parsed = yaml.load(m[1]);
  } catch {
    return { data: {}, body: text, hasFM: false };
  }
  if (parsed === null || parsed === undefined) {
    // 空 frontmatter（`---\n---`）：视为存在但无字段。
    return { data: {}, body: text.slice(m[0].length), hasFM: true };
  }
  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { data: {}, body: text, hasFM: false };
  }
  return { data: parsed as Record<string, unknown>, body: text.slice(m[0].length), hasFM: true };
}

/**
 * 把 data + 正文拼回完整 md。
 * - data 为空（无任何有效键）→ 不写 frontmatter 块，直接返回正文。
 * - 键顺序：通用字段在前，扩展字段按 data 原顺序跟随。
 * - `undefined` / 空字符串 / 空数组的键被剔除，避免写出 `title: ''` 这类噪声。
 */
export function stringifyFrontMatter(data: Record<string, unknown>, body: string): string {
  const isEmpty = (v: unknown): boolean =>
    v === undefined ||
    v === null ||
    (typeof v === 'string' && v.trim() === '') ||
    (Array.isArray(v) && v.length === 0);

  const ordered: Record<string, unknown> = {};
  for (const f of UNIVERSAL_FIELDS) {
    if (f.key in data && !isEmpty(data[f.key])) ordered[f.key] = data[f.key];
  }
  for (const k of Object.keys(data)) {
    if (UNIVERSAL_KEYS.has(k)) continue;
    if (!isEmpty(data[k])) ordered[k] = data[k];
  }

  const leadingTrimmedBody = body.replace(/^\s*\n/, '');
  if (Object.keys(ordered).length === 0) return leadingTrimmedBody;

  const yamlText = yaml.dump(ordered, { lineWidth: -1, noRefs: true }).trimEnd();
  const fmBlock = `---\n${yamlText}\n---\n`;
  return leadingTrimmedBody ? `${fmBlock}\n${leadingTrimmedBody}` : fmBlock;
}

/** 把任意 frontmatter 值规整成标签数组（支持 YAML 数组 / 逗号或空白分隔字符串）。 */
export function toTagsArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (typeof value === 'string') {
    return value
      .split(/[,，\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/** 把扩展字段的原始值渲染成可编辑文本（对象/数组转 JSON，其余转字符串）。 */
export function displayExtraValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** 补零到 2 位。 */
const pad2 = (n: number) => String(n).padStart(2, '0');

/** 当前时刻精确到秒：`YYYY-MM-DD HH:mm:ss`（用于 frontmatter created / updated）。 */
export function nowISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

/** 新建 Markdown 文件的初始内容（含 frontmatter created / updated 时间戳）。 */
export function initialMarkdownContent(): string {
  const now = nowISO();
  return `---\ncreated: ${now}\nupdated: ${now}\n---\n\n`;
}

/**
 * 保存时保证 Markdown **一律带上** `created` / `updated` 时间戳（精确到秒）。
 * - **无 frontmatter** → 在文首注入 `---\ncreated\nupdated\n---` 块，正文原样跟随（强制带上）。
 * - **有 frontmatter** → 就地：缺 `created` 则补 now（首次纳管的近似创建时刻）；
 *   `updated` 有则仅替换其值（同宽 19 字符，重复保存零位移，编辑器光标不受扰），无则插到 `created` 之后。
 * 不重排/不重格式化用户的其余 frontmatter（与属性面板的整块规范化解耦）。
 * 注：仅 md 走此路（调用方按语言判定），首存后即带 FM，后续保存只滚动 `updated`、不再重复注入。
 */
export function ensureFrontmatterTimestamps(raw: string): string {
  const text = raw ?? '';
  const now = nowISO();
  const m = FM_RE.exec(text);
  if (!m) {
    // 无 frontmatter：注入含 created/updated 的块，正文跟随（去掉正文开头多余空行避免叠加）。
    const body = text.replace(/^\s*\n/, '');
    const block = `---\ncreated: ${now}\nupdated: ${now}\n---\n`;
    return body ? `${block}\n${body}` : block;
  }
  const inner = m[1];
  const updatedRe = /^(\s*updated\s*:).*$/;
  const createdRe = /^\s*created\s*:/;
  let foundUpdated = false;
  const next = inner.split('\n').map((ln) => {
    if (!foundUpdated && updatedRe.test(ln)) {
      foundUpdated = true;
      return ln.replace(updatedRe, `$1 ${now}`);
    }
    return ln;
  });
  if (!next.some((ln) => createdRe.test(ln))) next.unshift(`created: ${now}`);
  if (!foundUpdated) {
    const createdIdx = next.findIndex((ln) => createdRe.test(ln));
    next.splice(createdIdx >= 0 ? createdIdx + 1 : next.length, 0, `updated: ${now}`);
  }
  const newInner = next.join('\n');
  // 用函数式 replace 避免 newInner 中的 `$` 被当成替换模式；m[0] 为开头整段 frontmatter。
  const rebuilt = m[0].replace(inner, () => newInner);
  return text.slice(0, m.index) + rebuilt + text.slice(m.index + m[0].length);
}
