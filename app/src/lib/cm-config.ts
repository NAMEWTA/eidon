/**
 * M4 · CodeMirror 配置构建器（框架无关，可在 Node 单测分支）。
 *
 * 从 Editor.vue 的 `buildExtensions()` 逐字抽出：把 vim/拼写/行号/换行/字体/主题/
 * 各 `cm-*` 扩展按设置组装成 Extension[]。Editor.tsx 仅负责创建 Compartment、
 * 挂载 EditorView、并在 props/设置变化时 dispatch/reconfigure。
 *
 * 设计：所有输入（设置切片、tab、compartments、handlers）以参数传入，绝不 import
 * React/Zustand，保证可在 Node 下纯函数式测试「设置 → 扩展集合」的分支。
 */
import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection } from '@codemirror/view';
import { Compartment, type Extension } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
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
import { autocompletion } from '@codemirror/autocomplete';
import { cmThemeFor } from './themes';
import { buildEditorFontStack } from './persistence/settings';
import type { Tab, Theme, EditorRender } from '../types';
import type { CitationEntry } from './citations';
import { richHighlightOnly } from './cm-live-preview';
import { liveEditExtension } from './cm-live-render';
import { liveBlocksExtension, liveBlocksTheme, extractImageRoot } from './cm-live-blocks';
import { dragAwareExtension } from './cm-drag-aware';
import { imagePasteExtension } from './cm-image-paste';
import { focusModeExtension, typewriterModeExtension } from './cm-focus-mode';
import { wikilinkExtension, wikilinkComplete } from './cm-wikilink';
import { tagAutocompleteExtension, tagComplete } from './cm-tag-autocomplete';
import { citationsExtension, citationCompleteSource } from './cm-citations';
import { slashCommandsExtension } from './cm-slash-commands';
import { spellcheckExtension } from './cm-spellcheck';
import { spellcheckTheme } from './cm-spellcheck-theme';
import { taskListExtension } from './cm-task-list';
import { sessionRestoreExtension } from './cm-session-restore';
import { frontmatterMarkdownExtension, frontmatterDecorations } from './cm-frontmatter';

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
    '.cm-selectionBackground, ::selection': { backgroundColor: 'rgba(255,159,64,0.25) !important' },
    '.cm-searchMatch': { backgroundColor: 'rgba(255,159,64,0.22)', borderRadius: '2px' },
    '.cm-searchMatch.cm-searchMatch-selected': {
      backgroundColor: 'var(--accent, #ff9f40)',
      color: 'var(--accent-fg, #fff)',
      outline: '1px solid var(--accent, #ff9f40)',
    },
  });
}

export function slashExt(handlers: EditorHandlers): Extension {
  if (!handlers.slashEnabled()) return [];
  return slashCommandsExtension({
    enabled: () => handlers.slashEnabled(),
    labelFor: (id) => handlers.slashLabelFor(id),
    hintFor: (id) => handlers.slashHintFor(id),
    emptyHint: (q) => handlers.slashEmptyHint(q),
  });
}

/**
 * 组装完整扩展数组（逐字对应 Editor.vue::buildExtensions）。
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
