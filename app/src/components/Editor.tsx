/**
 * Editor.tsx — CodeMirror 6 命令式包装器（从 Editor.vue 迁移）。
 *
 * React 只负责：在 layout effect 中挂载/销毁 EditorView、在设置/props 变化时
 * 通过 Compartment.reconfigure 热切换、用 useImperativeHandle 暴露命令式方法
 * （替代 Vue defineExpose）。所有「设置 → 扩展集合」组装在框架无关的 M4
 * （lib/cm-config.ts），渲染面像素与 Vue 版保持一致。
 *
 * StrictMode 双挂载：mount effect 的 cleanup 会 destroy view，再次 mount 重建——
 * CM 与 React 生命周期由此协调（计划风险区 ②）。
 */
import { forwardRef, useImperativeHandle, useLayoutEffect, useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { cmThemeFor } from '../lib/themes';
import { vim } from '@replit/codemirror-vim';
import { lineNumbers } from '@codemirror/view';
import { focusModeExtension, typewriterModeExtension } from '../lib/cm-focus-mode';
import { useTabsStore } from '../stores/tabs';
import { useSettingsStore } from '../stores/settings';
import { useI18n } from '../i18n';
import type { Tab } from '../types';
import type { CitationEntry } from '../lib/citations';
import { loadCitations } from '../lib/load-citations';
import { insertImageFromPath as cmInsertImageFromPath } from '../lib/cm-image-paste';
import { readSession, clearSession } from '../lib/cm-session-restore';
import {
  makeEditorCompartments,
  buildEditorExtensions,
  buildPhrases,
  markdownExt,
  spellCheckAttr,
  richExtensionsFor,
  fontSizeTheme,
  slashExt,
  type EditorBuildSettings,
  type EditorHandlers,
} from '../lib/cm-config';

export interface EditorHandle {
  gotoLine(line: number): void;
  insertImageFromPath(srcPath: string): Promise<void>;
  getViewLine(): number | null;
  scrollToLine(line: number): void;
  insertMarkdown(snippet: string): void;
  focus(): void;
}

export interface EditorProps {
  tab: Tab;
  focusMode?: boolean;
  typewriterMode?: boolean;
  spellCheck?: boolean;
  onCursor?: (line: number, col: number) => void;
  onSelection?: (text: string) => void;
}

/** 从 settings store 快照出 M4 需要的切片。 */
function snapshotSettings(): EditorBuildSettings {
  const s = useSettingsStore.getState();
  return {
    showLineNumbers: s.showLineNumbers,
    wordWrap: s.wordWrap,
    theme: s.theme,
    vimMode: s.vimMode,
    fontSize: s.fontSize,
    fontFamily: s.fontFamily,
    slashCommandsEnabled: s.slashCommandsEnabled,
    spellcheckEnabled: s.spellcheckEnabled,
    editorRender: s.editorRender,
    attachmentMode: s.attachmentMode,
    assetsDirName: s.assetsDirName,
    language: s.language,
  };
}

export const Editor = forwardRef<EditorHandle, EditorProps>(function Editor(props, ref) {
  const { tab } = props;
  const focusMode = props.focusMode ?? false;
  const typewriterMode = props.typewriterMode ?? false;
  const spellCheck = props.spellCheck ?? true;

  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  // Compartment 每个 Editor 实例稳定一份。
  const compsRef = useRef(makeEditorCompartments());
  const citationsRef = useRef<CitationEntry[]>([]);
  const { t } = useI18n();
  // 用 ref 持有最新 props 回调，避免重建扩展。
  const onCursorRef = useRef(props.onCursor);
  const onSelectionRef = useRef(props.onSelection);
  onCursorRef.current = props.onCursor;
  onSelectionRef.current = props.onSelection;
  // 当前 tab/flags 的 ref，供 handler 闭包读取最新值。
  const tabRef = useRef(tab);
  tabRef.current = tab;

  function makeHandlers(): EditorHandlers {
    return {
      onDocChanged: (text) => useTabsStore.getState().setContent(tabRef.current.id, text),
      onCursor: (line, col) => onCursorRef.current?.(line, col),
      onSelection: (text) => onSelectionRef.current?.(text),
      getCitations: () => citationsRef.current,
      slashLabelFor: (id) => {
        const v = t(`slashCommands.labels.${id}`);
        return v.startsWith('slashCommands.') ? undefined : v;
      },
      slashHintFor: (id) => {
        const v = t(`slashCommands.hints.${id}`);
        return v.startsWith('slashCommands.') ? undefined : v;
      },
      slashEmptyHint: (q) => t('slashCommands.empty', { query: q }),
      slashEnabled: () => useSettingsStore.getState().slashCommandsEnabled,
      spellcheckEnabled: () => useSettingsStore.getState().spellcheckEnabled,
    };
  }

  function buildExtensions() {
    return buildEditorExtensions({
      tab: tabRef.current,
      getTab: () => tabRef.current,
      settings: snapshotSettings(),
      compartments: compsRef.current,
      flags: { focusMode, typewriterMode, spellCheck },
      handlers: makeHandlers(),
    });
  }

  function maybeRestoreSession() {
    const view = viewRef.current;
    if (!view) return;
    const saved = readSession(tabRef.current.id);
    if (
      saved &&
      saved !== '' &&
      tabRef.current.content === '' &&
      view.state.doc.length === 0 &&
      saved !== view.state.doc.toString()
    ) {
      view.dispatch({ changes: { from: 0, to: 0, insert: saved } });
    }
  }

  // 挂载 / 卸载（一次）。StrictMode 下会 mount→cleanup→mount，cleanup 销毁干净。
  useLayoutEffect(() => {
    if (!hostRef.current) return;
    const view = new EditorView({
      state: EditorState.create({ doc: tabRef.current.content, extensions: buildExtensions() }),
      parent: hostRef.current,
    });
    viewRef.current = view;
    maybeRestoreSession();
    if (import.meta.env.DEV) {
      (window as unknown as { __eidonActiveView?: EditorView }).__eidonActiveView = view;
    }
    const onRelayout = () => view.requestMeasure();
    window.addEventListener('eidon:relayout', onRelayout);
    return () => {
      window.removeEventListener('eidon:relayout', onRelayout);
      if (import.meta.env.DEV) {
        const w = window as unknown as { __eidonActiveView?: EditorView };
        if (w.__eidonActiveView === view) delete w.__eidonActiveView;
      }
      view.destroy();
      viewRef.current = null;
    };
    // 仅挂载一次；切 tab/设置走下面的 reconfigure effect。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 切 tab：替换 doc + 重建扩展（session-restore 插件按新 tab.id 重建）。
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return; // 首次由 mount effect 负责
    }
    const view = viewRef.current;
    if (!view) return;
    view.setState(EditorState.create({ doc: tabRef.current.content, extensions: buildExtensions() }));
    maybeRestoreSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab.id]);

  // clean-save：buffer == savedContent 时丢弃陈旧 session 快照。
  useEffect(() => {
    if (tab.content === tab.savedContent) clearSession(tab.id);
  }, [tab.content, tab.savedContent, tab.id]);

  // 外部内容更新（保存只改 savedContent 时 content 不变；其它路径如保存时 frontmatter
  // updated 刷新会改 content）。用最小 diff（公共前/后缀）只替换变化区段，而非整文重写：
  // 局部改动时 CodeMirror 自动映射选区，光标不被甩到文首（保存即写 updated 时尤其关键）。
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const cur = view.state.doc.toString();
    const next = tab.content;
    if (cur === next) return;
    let start = 0;
    const maxPrefix = Math.min(cur.length, next.length);
    while (start < maxPrefix && cur.charCodeAt(start) === next.charCodeAt(start)) start++;
    let endCur = cur.length;
    let endNext = next.length;
    while (endCur > start && endNext > start && cur.charCodeAt(endCur - 1) === next.charCodeAt(endNext - 1)) {
      endCur--;
      endNext--;
    }
    view.dispatch({ changes: { from: start, to: endCur, insert: next.slice(start, endNext) } });
  }, [tab.content]);

  // ---- 设置/props 驱动的 reconfigure ----
  const theme = useSettingsStore((s) => s.theme);
  const vimMode = useSettingsStore((s) => s.vimMode);
  const wordWrap = useSettingsStore((s) => s.wordWrap);
  const showLineNumbers = useSettingsStore((s) => s.showLineNumbers);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const fontFamily = useSettingsStore((s) => s.fontFamily);
  const editorRender = useSettingsStore((s) => s.editorRender);
  const slashCommandsEnabled = useSettingsStore((s) => s.slashCommandsEnabled);
  const language = useSettingsStore((s) => s.language);

  const reconfigure = (build: () => Parameters<EditorView['dispatch']>[0]['effects']) => {
    const view = viewRef.current;
    if (view) view.dispatch({ effects: build() });
  };

  useEffect(() => reconfigure(() => compsRef.current.theme.reconfigure(cmThemeFor(theme))), [theme]);
  useEffect(() => reconfigure(() => compsRef.current.vim.reconfigure(vimMode ? vim() : [])), [vimMode]);
  useEffect(() => reconfigure(() => compsRef.current.wrap.reconfigure(wordWrap ? EditorView.lineWrapping : [])), [wordWrap]);
  useEffect(() => reconfigure(() => compsRef.current.lineNum.reconfigure(showLineNumbers ? lineNumbers() : [])), [showLineNumbers]);
  useEffect(
    () => reconfigure(() => compsRef.current.fontSize.reconfigure(fontSizeTheme(fontSize, fontFamily))),
    [fontSize, fontFamily],
  );
  useEffect(() => reconfigure(() => compsRef.current.spellCheck.reconfigure(spellCheckAttr(spellCheck))), [spellCheck]);
  useEffect(() => reconfigure(() => compsRef.current.focus.reconfigure(focusMode ? focusModeExtension() : [])), [focusMode]);
  useEffect(
    () => reconfigure(() => compsRef.current.typewriter.reconfigure(typewriterMode ? typewriterModeExtension() : [])),
    [typewriterMode],
  );
  // language / editorRender 影响 rich 包；language 还影响 lang 包。
  useEffect(() => {
    reconfigure(() => [
      compsRef.current.lang.reconfigure(tab.language === 'markdown' ? [markdownExt()] : []),
      compsRef.current.rich.reconfigure(richExtensionsFor(() => tabRef.current, { editorRender })),
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab.language]);
  useEffect(() => {
    reconfigure(() => compsRef.current.rich.reconfigure(richExtensionsFor(() => tabRef.current, { editorRender })));
  }, [editorRender]);
  // 文件路径变化（如 untitled 首次存盘）→ 重建 rich，让 live 图片块按新路径重新解析渲染（#9）。
  useEffect(() => {
    reconfigure(() => compsRef.current.rich.reconfigure(richExtensionsFor(() => tabRef.current, { editorRender })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab.filePath]);
  useEffect(() => {
    const view = viewRef.current;
    if (!view || tabRef.current.language !== 'markdown') return;
    view.dispatch({ effects: compsRef.current.slash.reconfigure(slashExt(makeHandlers())) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slashCommandsEnabled]);
  // 语言切换 → 重新配置 CodeMirror phrases（搜索面板 i18n）。
  useEffect(() => {
    reconfigure(() =>
      compsRef.current.phrases.reconfigure(EditorState.phrases.of(buildPhrases(language))),
    );
  }, [language]);

  // 引用库加载（随 workspaceBibliography 变化）。
  const workspaceBibliography = useSettingsStore((s) => s.workspaceBibliography);
  useEffect(() => {
    let alive = true;
    loadCitations(workspaceBibliography)
      .then((c) => {
        if (alive) citationsRef.current = c;
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [workspaceBibliography]);

  // 命令式方法（替代 Vue defineExpose）。
  useImperativeHandle(ref, (): EditorHandle => ({
    gotoLine(line) {
      const view = viewRef.current;
      if (!view) return;
      const safe = Math.max(1, Math.min(line, view.state.doc.lines));
      const lineObj = view.state.doc.line(safe);
      view.dispatch({
        selection: { anchor: lineObj.from },
        effects: EditorView.scrollIntoView(lineObj.from, { y: 'start', yMargin: 40 }),
      });
      view.focus();
    },
    async insertImageFromPath(srcPath) {
      const view = viewRef.current;
      if (!view) return;
      await cmInsertImageFromPath(view, srcPath, {
        getFilePath: () => tabRef.current.filePath,
        getDocContent: () => tabRef.current.content,
        getAttachmentMode: () => useSettingsStore.getState().attachmentMode,
        getAssetsDirName: () => useSettingsStore.getState().assetsDirName,
      });
    },
    getViewLine() {
      const view = viewRef.current;
      if (!view) return null;
      const top = view.scrollDOM.scrollTop;
      const block = view.lineBlockAtHeight(top);
      return view.state.doc.lineAt(block.from).number;
    },
    scrollToLine(line) {
      const view = viewRef.current;
      if (!view) return;
      const safe = Math.max(1, Math.min(line, view.state.doc.lines));
      const lineObj = view.state.doc.line(safe);
      view.dispatch({ effects: EditorView.scrollIntoView(lineObj.from, { y: 'start', yMargin: 8 }) });
    },
    insertMarkdown(snippet) {
      const view = viewRef.current;
      if (!view) return;
      const CURSOR = '$|$';
      const cursorIdx = snippet.indexOf(CURSOR);
      const finalText = cursorIdx >= 0 ? snippet.replace(CURSOR, '') : snippet;
      const sel = view.state.selection.main;
      const needsLeadingBreak =
        snippet.startsWith('\n') && sel.from > 0 && view.state.doc.sliceString(sel.from - 1, sel.from) !== '\n';
      const insertText = needsLeadingBreak ? '\n' + finalText : finalText;
      const adjust = needsLeadingBreak ? 1 : 0;
      view.dispatch({
        changes: { from: sel.from, to: sel.to, insert: insertText },
        selection: { anchor: cursorIdx >= 0 ? sel.from + cursorIdx + adjust : sel.from + insertText.length },
      });
      view.focus();
    },
    focus() {
      viewRef.current?.focus();
    },
  }));

  return <div className={`cm-host${theme === 'dark' ? ' cm-host--dark' : ''}`} ref={hostRef} />;
});
