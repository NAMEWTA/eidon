/**
 * M4 · CodeMirror 配置构建器（框架无关，可在 Node 单测分支）。
 *
 * 从既有 `buildExtensions()` 逐字抽出：把 vim/拼写/行号/换行/字体/主题/
 * 各 `cm-*` 扩展按设置组装成 Extension[]。Editor.tsx 仅负责创建 Compartment、
 * 挂载 EditorView、并在 props/设置变化时 dispatch/reconfigure。
 *
 * 设计：所有输入（设置切片、tab、compartments、handlers）以参数传入，绝不 import
 * React/Zustand，保证可在 Node 下纯函数式测试「设置 → 扩展集合」的分支。
 */
import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection } from '@codemirror/view';
import { Compartment, EditorState, Prec, Transaction, type Extension } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentLess, indentMore, indentWithTab, insertTab } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches, search } from '@codemirror/search';
import { syntaxHighlighting, defaultHighlightStyle, indentOnInput, bracketMatching } from '@codemirror/language';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { LanguageDescription } from '@codemirror/language';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { rust } from '@codemirror/lang-rust';
import { html as htmlLang } from '@codemirror/lang-html';
import { css as cssLang } from '@codemirror/lang-css';
import { json as jsonLang } from '@codemirror/lang-json';
import { cpp } from '@codemirror/lang-cpp';
import { java } from '@codemirror/lang-java';
import { go } from '@codemirror/lang-go';
import { yaml } from '@codemirror/lang-yaml';
import { sql } from '@codemirror/lang-sql';
import { xml } from '@codemirror/lang-xml';
import { vim } from '@replit/codemirror-vim';
import { autocompletion, completionStatus } from '@codemirror/autocomplete';
import { cmThemeFor } from '../lib/themes';
import { buildEditorFontStack } from '../lib/persistence/settings';
import type { Tab, Theme, EditorRender } from '../types';
import type { CitationEntry } from '../lib/citations';
import { richHighlightOnly } from './cm-live-preview';
import { liveEditExtension, liveEditHighlightStyle } from './cm-live-render';
import { liveBlocksExtension, liveBlocksTheme, extractImageRoot } from './cm-live-blocks';
import { dragAwareExtension } from './cm-drag-aware';
import { imagePasteExtension } from './cm-image-paste';
import { focusModeExtension, typewriterModeExtension } from './cm-focus-mode';
import { wikilinkExtension, wikilinkComplete } from './cm-wikilink';
import { tagAutocompleteExtension, tagComplete } from './cm-tag-autocomplete';
import { citationsExtension, citationCompleteSource } from './cm-citations';
import { slashCommandsExtension, isSlashPopupOpen } from './cm-slash-commands';
import { spellcheckExtension } from './cm-spellcheck';
import { spellcheckTheme } from './cm-spellcheck-theme';
import { taskListExtension } from './cm-task-list';
import { sessionRestoreExtension } from './cm-session-restore';
import { frontmatterMarkdownExtension, frontmatterDecorations } from './cm-frontmatter';
import { resolveDict, type Lang } from '../i18n/translate';

export const codeLanguages = [
  LanguageDescription.of({ name: 'javascript', alias: ['js', 'jsx'], support: javascript({ jsx: true }) }),
  LanguageDescription.of({ name: 'typescript', alias: ['ts', 'tsx'], support: javascript({ jsx: true, typescript: true }) }),
  LanguageDescription.of({ name: 'python', alias: ['py'], support: python() }),
  LanguageDescription.of({ name: 'rust', alias: ['rs'], support: rust() }),
  LanguageDescription.of({ name: 'html', support: htmlLang() }),
  LanguageDescription.of({ name: 'css', support: cssLang() }),
  LanguageDescription.of({ name: 'json', support: jsonLang() }),
  LanguageDescription.of({ name: 'cpp', alias: ['c', 'c++'], support: cpp() }),
  LanguageDescription.of({ name: 'java', support: java() }),
  LanguageDescription.of({ name: 'go', alias: ['golang'], support: go() }),
  LanguageDescription.of({ name: 'yaml', alias: ['yml'], support: yaml() }),
  LanguageDescription.of({ name: 'sql', support: sql() }),
  LanguageDescription.of({ name: 'xml', support: xml() }),
];

/** Editor.tsx 创建并持有这些 Compartment，传给 builder，用于后续 reconfigure。 */
export interface EditorCompartments {
  theme: Compartment;
  lang: Compartment;
  wrap: Compartment;
  lineNum: Compartment;
  fontSize: Compartment;
  rich: Compartment;
  spellCheck: Compartment;
  focus: Compartment;
  typewriter: Compartment;
  vim: Compartment;
  slash: Compartment;
  phrases: Compartment;
}

export function makeEditorCompartments(): EditorCompartments {
  return {
    theme: new Compartment(),
    lang: new Compartment(),
    wrap: new Compartment(),
    lineNum: new Compartment(),
    fontSize: new Compartment(),
    rich: new Compartment(),
    spellCheck: new Compartment(),
    focus: new Compartment(),
    typewriter: new Compartment(),
    vim: new Compartment(),
    slash: new Compartment(),
    phrases: new Compartment(),
  };
}

/** 构建器消费的设置切片（仅 data，便于测试）。 */
export interface EditorBuildSettings {
  showLineNumbers: boolean;
  wordWrap: boolean;
  theme: Theme;
  vimMode: boolean;
  fontSize: number;
  fontFamily: string;
  slashCommandsEnabled: boolean;
  spellcheckEnabled: boolean;
  editorRender: EditorRender;
  attachmentMode: 'shared' | 'per-file';
  assetsDirName: string;
  language: Lang;
}

export interface EditorHandlers {
  onDocChanged(text: string): void;
  onCursor(line: number, col: number): void;
  onSelection(text: string): void;
  getCitations(): CitationEntry[];
  slashLabelFor(id: string): string | undefined;
  slashHintFor(id: string): string | undefined;
  slashEmptyHint(query: string): string;
  /** 是否启用斜杠命令（动态 getter，供扩展内部读取最新值）。 */
  slashEnabled(): boolean;
  /** 是否启用拼写检查（动态 getter）。 */
  spellcheckEnabled(): boolean;
}

export interface EditorBuildCtx {
  tab: Tab;
  /** 读取「当前」tab 的实时 getter（live 图片块解析路径用）；缺省回退到 tab 快照。 */
  getTab?: () => Tab;
  settings: EditorBuildSettings;
  compartments: EditorCompartments;
  /** prop 驱动的瞬时开关（App 从 settings 透传：focusMode/typewriterMode/spellCheck）。 */
  flags: { focusMode: boolean; typewriterMode: boolean; spellCheck: boolean };
  handlers: EditorHandlers;
}

export function markdownExt(): Extension {
  // 以 markdownLanguage 为 base，启用 GFM（含 task list 的 TaskMarker 解析）+ frontmatter 解析。
  // frontmatterDecorations 提供顶部 frontmatter 的「独立块 + 分割线」行装饰（所有视图模式生效）。
  return [
    markdown({
      base: markdownLanguage,
      codeLanguages,
      addKeymap: true,
      extensions: [frontmatterMarkdownExtension],
    }),
    frontmatterDecorations(),
    markdownListKeymap,
  ];
}

export function spellCheckAttr(on: boolean): Extension {
  return EditorView.contentAttributes.of({ spellcheck: on ? 'true' : 'false' });
}

/** vim 扩展分支（M4 可测：on → 非空，off → 空数组）。 */
export function vimExt(on: boolean): Extension {
  return on ? vim() : [];
}

/** 行号扩展分支（M4 可测）。 */
export function lineNumberExt(on: boolean): Extension {
  return on ? lineNumbers() : [];
}

/** 自动换行扩展分支（M4 可测）。 */
export function wrapExt(on: boolean): Extension {
  return on ? EditorView.lineWrapping : [];
}

/**
 * 富文本（rich）扩展分支（与布局 viewMode 正交，只看 editorRender）：
 * `live` → 所见即所得渲染（liveEditExtension + liveBlocks）；`source` → richHighlightOnly
 * （标记符始终可见的纯源码高亮）。markdown 才有。
 */
// 接收 getTab（而非 tab 快照）：live 图片块的 getImageRoot/getFilePath 须读「当前」tab——
// rich compartment 不随每次输入或 filePath 变化重建，若闭包捕获旧快照，untitled 存盘后
// filePath 仍是 undefined、相对图片永远解析不出，导致 live 模式图片不渲染（#9）。
export function richExtensionsFor(getTab: () => Tab, settings: Pick<EditorBuildSettings, 'editorRender'>): Extension {
  const tab = getTab();
  if (tab.language !== 'markdown') return [];
  if (settings.editorRender === 'live') {
    return liveEditExtension([
      liveBlocksExtension({
        getImageRoot: () => extractImageRoot(getTab().content || ''),
        getFilePath: () => getTab().filePath,
      }),
      liveBlocksTheme,
    ]);
  }
  return richHighlightOnly();
}

export function fontSizeTheme(px: number, family: string): Extension {
  return EditorView.theme({
    '&': { fontSize: `${px}px`, height: '100%' },
    '.cm-scroller': { fontFamily: buildEditorFontStack(family), lineHeight: '1.6' },
    '.cm-content': { padding: '12px 16px' },
    '.cm-gutters': {
      backgroundColor: 'transparent',
      border: 'none',
      color: 'var(--text-faint)',
    },
    '.cm-activeLine': { backgroundColor: 'transparent' },
    '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--accent)' },
    '.cm-cursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
    // 选中色加深以提高可辨识度（旧 0.25 过淡，框选 ` ` 等内联块时变化不明显）。
    '.cm-selectionBackground, ::selection': { backgroundColor: 'rgba(255,159,64,0.42) !important' },
    '&.cm-focused .cm-selectionBackground': { backgroundColor: 'rgba(255,159,64,0.42) !important' },
    '.cm-searchMatch': { backgroundColor: 'rgba(255,159,64,0.22)', borderRadius: '2px' },
    '.cm-searchMatch.cm-searchMatch-selected': {
      backgroundColor: 'var(--accent, #ff9f40)',
      color: 'var(--accent-fg, #fff)',
      outline: '1px solid var(--accent, #ff9f40)',
    },
  });
}

/** 从 i18n 字典构建 CodeMirror EditorState.phrases 对象，用于翻译搜索面板等 UI。 */
export function buildPhrases(lang: Lang): Record<string, string> {
  const dict = resolveDict(lang);
  const cmFind = (dict as Record<string, unknown>).cmFind as Record<string, string> | undefined;
  if (!cmFind) return {};
  // @codemirror/search 用英文原文作 phrase key（state.phrase("Find") 等）。
  return {
    Find: cmFind.find,
    Replace: cmFind.replace,
    next: cmFind.next,
    previous: cmFind.previous,
    all: cmFind.all,
    'match case': cmFind.matchCase,
    regexp: cmFind.regexp,
    'by word': cmFind.byWord,
    replace: cmFind.replaceOne,
    'replace all': cmFind.replaceAll,
    close: cmFind.close,
    'Go to line': cmFind.goToLine,
    go: cmFind.go,
    'current match': cmFind.currentMatch,
    'on line': cmFind.onLine,
    'replaced match on line $': cmFind.replacedMatch,
    'replaced $ matches': cmFind.replacedAll,
  };
}

/** @codemirror/merge 折叠未改动行的占位文案（默认 "$ unchanged lines"，$ 为行数）的 i18n 覆盖。 */
export function buildMergePhrases(lang: Lang): Record<string, string> {
  const dict = resolveDict(lang) as Record<string, unknown>;
  const diff = dict.diff as Record<string, string> | undefined;
  return diff?.unchangedLines ? { '$ unchanged lines': diff.unchangedLines } : {};
}

interface ParsedListLine {
  /** 行首空白长度（列）。 */
  indent: number;
  /** 是否有序列表（`1.` / `1)`）。 */
  ordered: boolean;
  /** 有序列表的当前序号（无序为 0）。 */
  number: number;
  /** 有序列表分隔符（`.` 或 `)`）。 */
  sep: string;
  /** 无序列表的 bullet 字符（`-`/`*`/`+`），有序为 ''。 */
  bullet: string;
  /** 是否任务项（`- [ ]` / `- [x]`）。 */
  task: boolean;
  /** marker 结束列（indent + 数字 + 分隔符），相对行首。无序为 indent+1。 */
  markerEnd: number;
  /** marker 内容起始列 = indent + marker + 其后空白；子项缩进对齐到此列才视为嵌套。
   *  注意：任务项的 `[ ]` 属于内容，contentCol 仍只到 bullet 之后（如 `- ` → 2）。 */
  contentCol: number;
  /** 实际文本起始列：有序/普通无序 == contentCol；任务项跳过 `[ ] ` 复选框。 */
  textCol: number;
}

/**
 * 解析一行的列表 marker。content 列对齐是 CommonMark 嵌套的关键：markdown-it
 * （预览）与 lezer-markdown（编辑器）都要求子项缩进到父项内容起始列才视为嵌套，
 * 否则会被解析成同级，导致序号「拍平」（预览 1./2.）且 Enter 续编层级错乱。
 * 注意：任务列表 `- [ ] x` 的 marker 仅 `- `，`[ ]` 属于内容，故对齐到 col 2。
 */
function parseListLine(text: string): ParsedListLine | null {
  let m = /^(\s*)(\d+)([.)])(\s+)/.exec(text);
  if (m) {
    const indent = m[1].length;
    const contentCol = m[0].length;
    return {
      indent,
      ordered: true,
      number: parseInt(m[2], 10),
      sep: m[3],
      bullet: '',
      task: false,
      markerEnd: indent + m[2].length + 1,
      contentCol,
      textCol: contentCol,
    };
  }
  m = /^(\s*)([-*+])(\s+)/.exec(text);
  if (m) {
    const indent = m[1].length;
    const contentCol = m[0].length;
    const taskM = /^(\[[ xX]\])(\s+)/.exec(text.slice(contentCol));
    return {
      indent,
      ordered: false,
      number: 0,
      sep: '',
      bullet: m[2],
      task: taskM != null,
      markerEnd: indent + 1,
      contentCol,
      textCol: taskM ? contentCol + taskM[0].length : contentCol,
    };
  }
  return null;
}

/**
 * markdown 列表 Enter：在列表项上回车时接管换行逻辑——
 *  - 非空项：另起一行生成同级 marker（有序续编 +1，任务项重置为 `- [ ] `）。
 *  - 空项：缩进 > 0 则「升一级」并续编为父级的下一序号（一次回车出一层）；
 *    顶层空项则清空当前行退出列表。
 * 当存在自动补全弹窗或斜杠命令弹窗时让出 Enter（返回 false 由它们处理）。
 */
function listEnter(view: EditorView): boolean {
  const { state } = view;
  if (completionStatus(state) === 'active') return false;
  if (isSlashPopupOpen(state)) return false;

  const sel = state.selection.main;
  if (!sel.empty) return false;

  const line = state.doc.lineAt(sel.head);
  const cur = parseListLine(line.text);
  if (!cur) return false;

  const text = state.doc.sliceString(line.from + cur.textCol, line.to);
  const isEmpty = text.trim() === '';

  if (isEmpty) {
    if (cur.indent > 0) {
      // 升一级：以最近的「上一级」列表行为父，续编为其下一序号 / 沿用其 bullet。
      let parent: ParsedListLine | null = null;
      for (let n = line.number - 1; n >= 1; n--) {
        const pl = state.doc.line(n);
        if (pl.text.trim() === '') break;
        const pm = parseListLine(pl.text);
        if (!pm) break;
        if (pm.indent < cur.indent) {
          parent = pm;
          break;
        }
      }
      const newIndent = parent ? parent.indent : Math.max(0, cur.indent - 2);
      let marker: string;
      if (parent) {
        marker = parent.ordered ? `${parent.number + 1}${parent.sep} ` : `${parent.bullet} `;
      } else {
        marker = cur.ordered ? `1${cur.sep} ` : `${cur.bullet} `;
      }
      const insert = ' '.repeat(newIndent) + marker;
      view.dispatch(state.update({
        changes: { from: line.from, to: line.to, insert },
        selection: { anchor: line.from + insert.length },
        scrollIntoView: true,
        userEvent: 'input',
      }));
      return true;
    }
    // 顶层空项：清空当前行，退出列表。
    view.dispatch(state.update({
      changes: { from: line.from, to: line.to, insert: '' },
      selection: { anchor: line.from },
      scrollIntoView: true,
      userEvent: 'input',
    }));
    return true;
  }

  // 非空项：另起一行生成同级 marker。
  let marker: string;
  if (cur.ordered) {
    marker = `${cur.number + 1}${cur.sep} `;
  } else if (cur.task) {
    marker = `${cur.bullet} [ ] `;
  } else {
    marker = `${cur.bullet} `;
  }
  const insert = '\n' + ' '.repeat(cur.indent) + marker;
  view.dispatch(state.update({
    changes: { from: sel.head, insert },
    selection: { anchor: sel.head + insert.length },
    scrollIntoView: true,
    userEvent: 'input',
  }));
  return true;
}

/**
 * Tab 缩进 markdown 列表行：把当前项变为「上一个同级项」的子项——缩进对齐到该
 * 父项的内容起始列（保证 CommonMark 嵌套），有序列表则续编为目标层级的正确序号。
 * 若当前行不是列表项、或前面没有可作为父项的同级项，则返回 false（交还兜底处理）。
 */
function tabIndentListLine(state: EditorState, dispatch: (tr: Transaction) => void): boolean {
  const line = state.doc.lineAt(state.selection.main.head);
  const cur = parseListLine(line.text);
  if (!cur) return false;

  // 向上找最近的「父项」：第一条 indent <= 当前缩进的非空列表行。
  let parent: ParsedListLine | null = null;
  for (let n = line.number - 1; n >= 1; n--) {
    const pl = state.doc.line(n);
    if (pl.text.trim() === '') break;
    const pm = parseListLine(pl.text);
    if (!pm) break;
    if (pm.indent <= cur.indent) {
      parent = pm;
      break;
    }
  }
  // 仅当存在同级的上一项时才允许缩进（嵌套需要一个父项承接）。
  if (!parent || parent.indent !== cur.indent) return false;

  const targetIndent = parent.contentCol;
  const addIndent = targetIndent - cur.indent;
  if (addIndent <= 0) return false;

  if (cur.ordered) {
    // 计算目标层级下应有的序号：扫描父项与当前行之间、缩进恰为 targetIndent 的
    // 已有同级有序项，取其序号 +1；若无则为 1（首个子项）。
    let newNumber = 1;
    for (let n = line.number - 1; n >= 1; n--) {
      const pl = state.doc.line(n);
      if (pl.text.trim() === '') break;
      const pm = parseListLine(pl.text);
      if (!pm) break;
      if (pm.indent <= cur.indent) break;
      if (pm.indent === targetIndent && pm.ordered) {
        newNumber = pm.number + 1;
        break;
      }
    }
    // 单次 change：用「新缩进 + 新序号 + 原分隔符」替换原「缩进 + marker」。
    dispatch(state.update({
      changes: {
        from: line.from,
        to: line.from + cur.markerEnd,
        insert: ' '.repeat(targetIndent) + newNumber + cur.sep,
      },
      scrollIntoView: true,
      userEvent: 'input',
    }));
    return true;
  }

  dispatch(state.update({
    changes: { from: line.from, insert: ' '.repeat(addIndent) },
    scrollIntoView: true,
    userEvent: 'input',
  }));
  return true;
}

/**
 * Markdown 列表按键：高优先级。
 *  - Enter：列表项内接管换行（续编/升级/退出，见 listEnter）。
 *  - Tab：列表项缩进对齐到父项内容列；兜底 insertTab，防止焦点跳出编辑器。
 */
const markdownListKeymap = Prec.highest(
  keymap.of([
    {
      key: 'Enter',
      run: (view) => listEnter(view),
    },
    {
      key: 'Tab',
      run: (view) => {
        if (tabIndentListLine(view.state, view.dispatch)) {
          view.focus();
          return true;
        }
        if (indentMore({ state: view.state, dispatch: view.dispatch })) {
          view.focus();
          return true;
        }
        if (insertTab({ state: view.state, dispatch: view.dispatch })) {
          view.focus();
          return true;
        }
        return false;
      },
      shift: (view) => {
        const ok = indentLess({ state: view.state, dispatch: view.dispatch });
        if (ok) view.focus();
        return ok;
      },
      preventDefault: true,
    },
  ]),
);

export function slashExt(handlers: EditorHandlers): Extension {
  if (!handlers.slashEnabled()) return [];
  return slashCommandsExtension({
    enabled: () => handlers.slashEnabled(),
    labelFor: (id) => handlers.slashLabelFor(id),
    hintFor: (id) => handlers.slashHintFor(id),
    emptyHint: (q) => handlers.slashEmptyHint(q),
  });
}

/* 搜索/替换面板样式（⌘F / Ctrl+F），匹配 EIDON 主题。面板文字经 EditorState.phrases
   facet 实现 i18n（翻译在 i18n 字典 cmFind 段）。抽成模块级常量，供主编辑器与历史对比视图复用。 */
export const searchPanelTheme = EditorView.theme({
  '.cm-panels': {
    backgroundColor: 'var(--bg-chrome)',
    borderBottom: '1px solid var(--border)',
    padding: '4px 8px',
    color: 'var(--text)',
  },
  '.cm-panels.cm-panels-top': {
    borderBottom: '1px solid var(--border)',
    borderTop: 'none',
  },
  '.cm-panel.cm-search': {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '6px',
    padding: '2px 0',
  },
  '.cm-panels input': {
    backgroundColor: 'var(--bg-elev)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-sm)',
    padding: '3px 8px',
    fontFamily: 'var(--font-ui)',
    fontSize: '13px',
    outline: 'none',
  },
  '.cm-panels input:focus': {
    borderColor: 'var(--accent)',
  },
  '.cm-panels button': {
    backgroundColor: 'var(--bg-elev)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-sm)',
    padding: '2px 10px',
    cursor: 'pointer',
    fontFamily: 'var(--font-ui)',
    fontSize: '12px',
    lineHeight: '1.6',
  },
  '.cm-panels button:hover': {
    backgroundColor: 'var(--bg-hover)',
  },
  '.cm-panels button:active': {
    backgroundColor: 'var(--bg-active)',
  },
  '.cm-panels button[name="close"]': {
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '14px',
    padding: '0 4px',
  },
  '.cm-panels label': {
    color: 'var(--text-muted)',
    fontSize: '12px',
    marginRight: '4px',
  },
  '.cm-panels input[type="checkbox"]': {
    accentColor: 'var(--accent)',
    marginRight: '2px',
  },
});

/** buildDiffEditorExtensions 消费的设置切片（仅视觉/编辑相关）。 */
export type DiffEditorSettings = Pick<
  EditorBuildSettings,
  'showLineNumbers' | 'wordWrap' | 'theme' | 'fontSize' | 'fontFamily' | 'language'
>;

/**
 * 历史对比视图（DiffView，@codemirror/merge）单侧编辑器的扩展集。
 * 刻意复用主编辑器的视觉与编辑核心——主题(cmThemeFor)/字号(fontSizeTheme)/行号/换行/
 * markdown 高亮/搜索面板/撤销/默认快捷键——保证与主编辑器观感一致（防割裂）；
 * 但不含 live 预览、斜杠命令、会话恢复、图片粘贴等有状态重插件：对比是源码态、瞬态。
 * `editable=false` → 只读（split 左侧历史版本）；`onDocChanged` → 把可编辑侧改动回灌 tab。
 */
export function buildDiffEditorExtensions(opts: {
  settings: DiffEditorSettings;
  isMarkdown: boolean;
  editable: boolean;
  onDocChanged?: (text: string) => void;
}): Extension[] {
  const { settings: s, isMarkdown, editable, onDocChanged } = opts;
  return [
    history(),
    drawSelection(),
    indentOnInput(),
    bracketMatching(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    search({ top: true }),
    EditorState.phrases.of(buildPhrases(s.language)),
    EditorState.phrases.of(buildMergePhrases(s.language)),
    searchPanelTheme,
    // 先用 EIDON markdown 配色（--md-*/--syn-*），未覆盖的 tag 回退默认高亮（fallback）。
    syntaxHighlighting(liveEditHighlightStyle),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
    lineNumberExt(s.showLineNumbers),
    wrapExt(s.wordWrap),
    isMarkdown ? markdownExt() : [],
    cmThemeFor(s.theme),
    fontSizeTheme(s.fontSize, s.fontFamily),
    EditorView.editable.of(editable),
    EditorState.readOnly.of(!editable),
    onDocChanged
      ? EditorView.updateListener.of((u) => {
          if (u.docChanged) onDocChanged(u.state.doc.toString());
        })
      : [],
  ];
}

/**
 * 组装完整扩展数组（对应 buildExtensions）。
 * Compartment 的初值就是当前设置；后续 Editor.tsx 通过 compartment.reconfigure 热切换。
 */
export function buildEditorExtensions(ctx: EditorBuildCtx): Extension[] {
  const { tab, settings, compartments: c, flags, handlers } = ctx;
  const getTab = ctx.getTab ?? (() => ctx.tab);
  return [
    dragAwareExtension(),
    history(),
    drawSelection(),
    indentOnInput(),
    bracketMatching(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    search({ top: true }),
    c.phrases.of(EditorState.phrases.of(buildPhrases(settings.language))),
    searchPanelTheme,
    // 先用 EIDON markdown 配色（--md-*/--syn-*），未覆盖的 tag 回退默认高亮（fallback）。
    syntaxHighlighting(liveEditHighlightStyle),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
    c.lineNum.of(lineNumberExt(settings.showLineNumbers)),
    c.wrap.of(wrapExt(settings.wordWrap)),
    c.lang.of(tab.language === 'markdown' ? [markdownExt()] : []),
    c.rich.of(richExtensionsFor(getTab, settings)),
    c.theme.of(cmThemeFor(settings.theme)),
    c.vim.of(vimExt(settings.vimMode)),
    c.fontSize.of(fontSizeTheme(settings.fontSize, settings.fontFamily)),
    c.spellCheck.of(spellCheckAttr(flags.spellCheck)),
    c.focus.of(flags.focusMode ? focusModeExtension() : []),
    c.typewriter.of(flags.typewriterMode ? typewriterModeExtension() : []),
    imagePasteExtension({
      getFilePath: () => tab.filePath,
      getDocContent: () => tab.content,
      getAttachmentMode: () => settings.attachmentMode,
      getAssetsDirName: () => settings.assetsDirName,
    }),
    ...(tab.language === 'markdown'
      ? [
          wikilinkExtension(),
          tagAutocompleteExtension(),
          citationsExtension(() => handlers.getCitations()),
          autocompletion({
            override: [wikilinkComplete, tagComplete, citationCompleteSource(() => handlers.getCitations())],
            defaultKeymap: true,
            activateOnTyping: true,
          }),
          spellcheckExtension({ enabled: () => handlers.spellcheckEnabled() }),
          spellcheckTheme,
          c.slash.of(slashExt(handlers)),
        ]
      : []),
    taskListExtension(),
    sessionRestoreExtension(tab.id),
    EditorView.updateListener.of((u) => {
      if (u.docChanged) {
        handlers.onDocChanged(u.state.doc.toString());
      }
      if (u.selectionSet || u.docChanged) {
        const head = u.state.selection.main.head;
        const line = u.state.doc.lineAt(head);
        handlers.onCursor(line.number, head - line.from + 1);
        const sel = u.state.selection.main;
        handlers.onSelection(sel.empty ? '' : u.state.sliceDoc(sel.from, sel.to));
      }
    }),
  ];
}
