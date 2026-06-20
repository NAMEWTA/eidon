/**
 * shared/models/search —— knowledge（索引/backlink/标签/搜索/拼写/CJK）wire 形状（camelCase）。
 * 迁移自旧 shared/ipc/types.ts，蛇形字段已统一为 camelCase（见 ADR-0025 / D7）。
 */

export interface WikilinkRef {
  /** wikilink 目标（`[[target#heading|alias]]` 的 target 部分）。 */
  target: string;
  /** `#heading` 部分（无则 null）。 */
  heading: string | null;
  /** `|alias` 部分（无则 null）。 */
  alias: string | null;
  /** 链接所在 1-based 行号。 */
  line: number;
}

export interface IndexEntry {
  path: string;
  name: string;
  stem: string;
  mtime: number;
  size: number;
  frontmatter: unknown;
  wikilinks: WikilinkRef[];
  tags: string[];
  headings: string[];
  summary: string;
  title: string | null;
}

export interface BacklinkRef {
  fromPath: string;
  fromName: string;
  line: number;
  context: string[];
}

export interface TagCount {
  tag: string;
  count: number;
  files: string[];
}

export interface SearchHit {
  file: string;
  line: number;
  snippet: string;
}

export interface Misspelling {
  word: string;
  start: number;
  end: number;
}

export interface CjkIssue {
  line: number;
  colStart: number;
  colEnd: number;
  severity: string;
  category: string;
  original: string;
  suggestion: string;
  explanation: string;
}
