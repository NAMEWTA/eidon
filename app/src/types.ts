export type Language = 'markdown' | 'plaintext';
export type TabKind = 'text' | 'image' | 'pdf' | 'unsupported';
// 视图被拆成两个**正交**维度（勿再把渲染塞回 ViewMode）：
//   1. `ViewMode` = 布局：`edit` 单栏编辑器 / `split` 双栏（编辑器+预览） /
//      `preview` 仅预览 / `reading` 全屏阅读。
//   2. `EditorRender` = 编辑器渲染：`source` 纯 Markdown 源码（标记符始终可见）/
//      `live` 边输入边渲染、所见即所得（Typora / Obsidian Live Preview 风格）。
//      只在有编辑器的布局（edit / split）下生效，由顶栏「源码 ⇄ 实时编辑」开关控制。
//
// `reading` is a full-bleed serif preview without any editor chrome: no toolbar,
// no file tree, no status bar — just centered prose. Toggled via Cmd+Shift+R,
// auto-applies on iOS when the `readingByDefaultOnMobile` setting is on.
export type ViewMode = 'edit' | 'split' | 'preview' | 'reading';
export type EditorRender = 'source' | 'live';
export type Theme = 'light' | 'dark';

export interface Tab {
  id: string;
  kind?: TabKind;
  filePath?: string;
  fileName: string;
  content: string;
  savedContent: string;
  encoding: string;
  language: Language;
  hadBom: boolean;
  // Line-ending of the file on disk. CodeMirror normalizes everything to
  // LF internally, so we track the original here and re-apply on save —
  // otherwise a Windows file (CRLF) would silently become LF the moment
  // the user touches the editor (and the dirty flag would lock in even
  // without edits because content drifts from savedContent).
  lineEnding?: 'lf' | 'crlf';
  showOutline?: boolean;
}

export interface FileReadResult {
  content: string;
  encoding: string;
  language: Language;
  had_bom: boolean;
}

// ---- Tile layout (split editor) ----

export type SplitDirection = 'horizontal' | 'vertical';

export interface TileLeaf {
  type: 'leaf';
  id: string;
  activeTabId: string;
}

export interface TileBranch {
  type: 'branch';
  id: string;
  direction: SplitDirection;
  sizes: [number, number]; // percentages summing to 100
  children: [TileNode, TileNode];
}

export type TileNode = TileLeaf | TileBranch;
