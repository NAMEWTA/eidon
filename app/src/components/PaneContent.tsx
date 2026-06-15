/**
 * PaneContent.tsx — 单窗格内容（从 PaneContent.vue 迁移）。
 * 按视图模式挂 Editor / Preview；分屏滚动同步、视图切换时保留滚动位置、
 * 响应 pane 作用域的 window 事件（outline-goto / insert-markdown / insert-image / preview-search）。
 *
 * 关键时序：Vue watch（pre-flush）在旧 DOM 仍在时快照 top line；React 用对 settings store 的
 * subscribe 复刻（store 更新 → subscribe 同步触发，此刻 React 尚未重渲染，旧 DOM 仍在）。
 */
import { useEffect, useRef } from 'react';
import { Editor, type EditorHandle } from './Editor';
import { Preview, type PreviewHandle } from './Preview';
import { useSettingsStore } from '../stores/settings';
import { useTilesStore } from '../stores/tiles';
import { openPath } from '../composables/useFiles';
import type { Tab } from '../types';
import { convertFileSrc } from '../../core/bridge/tauri';
import { openPathExternal } from '../../core/bridge/opener';
import { useToastsStore } from '../stores/toasts';
import { useI18n } from '../i18n';

export interface PaneContentProps {
  paneId: string;
  tab: Tab | undefined;
  onCursor: (line: number, col: number) => void;
  onSelection: (text: string) => void;
}

function getPreviewElementsByLine(preview: HTMLElement): Array<{ line: number; el: HTMLElement }> {
  const nodes = preview.querySelectorAll<HTMLElement>('[data-source-line]');
  const list: Array<{ line: number; el: HTMLElement }> = [];
  for (const el of Array.from(nodes)) {
    const n = Number(el.getAttribute('data-source-line') || '0');
    if (n > 0) list.push({ line: n, el });
  }
  list.sort((a, b) => a.line - b.line);
  return list;
}

function findNearestEntry<T extends { line: number }>(list: T[], line: number): T | null {
  if (!list.length) return null;
  let lo = 0,
    hi = list.length - 1,
    best = list[0];
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid].line <= line) {
      best = list[mid];
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return best;
}

function AssetPane({ tab }: { tab: Tab }) {
  const { t } = useI18n();
  const src = tab.filePath ? convertFileSrc(tab.filePath) : '';
  const kind = tab.kind ?? 'text';

  if (kind === 'image') {
    return (
      <div className="asset-preview asset-preview--image">
        <img src={src} alt={tab.fileName} />
      </div>
    );
  }

  if (kind === 'pdf') {
    return (
      <div className="asset-preview asset-preview--pdf">
        <iframe title={tab.fileName} src={src} />
      </div>
    );
  }

  const openExternal = async () => {
    if (!tab.filePath) return;
    try {
      await openPathExternal(tab.filePath);
    } catch (error) {
      useToastsStore.getState().error(`Open failed: ${error}`);
    }
  };

  return (
    <div className="asset-preview asset-preview--unsupported">
      <div className="asset-preview__panel">
        <div className="asset-preview__title">{t('filePreview.unsupportedTitle')}</div>
        <div className="asset-preview__name" title={tab.filePath}>{tab.fileName}</div>
        <button className="asset-preview__button" onClick={openExternal}>
          {t('filePreview.openExternal')}
        </button>
      </div>
    </div>
  );
}

export function PaneContent({ paneId, tab, onCursor, onSelection }: PaneContentProps) {
  const viewMode = useSettingsStore((s) => s.viewMode);
  const focusMode = useSettingsStore((s) => s.focusMode);
  const typewriterMode = useSettingsStore((s) => s.typewriterMode);
  const spellCheck = useSettingsStore((s) => s.spellCheck);
  const editorRef = useRef<EditorHandle | null>(null);
  const previewRef = useRef<PreviewHandle | null>(null);
  const bindRef = useRef<(() => void) | null>(null);

  const tabKind = tab?.kind ?? 'text';
  const showAsset = !!tab && tabKind !== 'text';
  const showEditor = tabKind === 'text' && (tab?.language !== 'markdown' || viewMode !== 'preview');
  // 预览列只在带预览的布局（split / preview）出现；edit 单栏编辑无预览（reading 由 App 层整屏渲染）。
  const showPreview = tabKind === 'text' && tab?.language === 'markdown' && (viewMode === 'split' || viewMode === 'preview');

  function isFocused() {
    return useTilesStore.getState().focusedPaneId === paneId;
  }

  // 挂载：定义滚动同步 + 视图保留 + window 事件；订阅 viewMode 变化。
  useEffect(() => {
    let syncEditorScroll: (() => void) | null = null;
    let syncPreviewScroll: (() => void) | null = null;
    let syncGuard = false;

    function bindScrollSync() {
      if (syncEditorScroll) syncEditorScroll();
      if (syncPreviewScroll) syncPreviewScroll();
      syncEditorScroll = null;
      syncPreviewScroll = null;
      if (useSettingsStore.getState().viewMode !== 'split') return;
      const paneEl = document.querySelector(`[data-pane-id="${paneId}"]`);
      if (!paneEl) return;
      const editor = paneEl.querySelector('.pane--editor .cm-scroller') as HTMLElement | null;
      const preview = paneEl.querySelector('.pane--preview .preview-host') as HTMLElement | null;
      if (!editor || !preview) return;

      let activePane: 'editor' | 'preview' | null = null;
      let activeTimer: ReturnType<typeof setTimeout> | null = null;
      const markActive = (which: 'editor' | 'preview') => {
        activePane = which;
        if (activeTimer) clearTimeout(activeTimer);
        activeTimer = setTimeout(() => {
          activePane = null;
        }, 250);
      };
      const intentEvents = ['wheel', 'pointerdown', 'touchstart', 'keydown'] as const;
      const editorIntent = () => markActive('editor');
      const previewIntent = () => markActive('preview');
      for (const ev of intentEvents) {
        editor.addEventListener(ev, editorIntent, { passive: true });
        preview.addEventListener(ev, previewIntent, { passive: true });
      }

      const onEditorScroll = () => {
        if (syncGuard || activePane === 'preview') return;
        const currentLine = editorRef.current?.getViewLine() ?? null;
        if (!currentLine) return;
        const previewLines = getPreviewElementsByLine(preview);
        const entry = findNearestEntry(previewLines, currentLine);
        if (!entry) {
          const emax = editor.scrollHeight - editor.clientHeight;
          const pmax = preview.scrollHeight - preview.clientHeight;
          if (emax > 0 && pmax > 0) {
            syncGuard = true;
            preview.scrollTop = (editor.scrollTop / emax) * pmax;
            requestAnimationFrame(() => {
              syncGuard = false;
            });
          }
          return;
        }
        const elRect = entry.el.getBoundingClientRect();
        const wrapRect = preview.getBoundingClientRect();
        syncGuard = true;
        preview.scrollTop += elRect.top - wrapRect.top - 8;
        requestAnimationFrame(() => {
          syncGuard = false;
        });
      };

      const onPreviewScroll = () => {
        if (syncGuard || activePane === 'editor') return;
        const previewLines = getPreviewElementsByLine(preview);
        const wrapTop = preview.getBoundingClientRect().top;
        let targetLine: number | null = null;
        for (const { line, el } of previewLines) {
          const r = el.getBoundingClientRect();
          if (r.bottom >= wrapTop) {
            targetLine = line;
            break;
          }
        }
        if (targetLine == null) return;
        if (editorRef.current?.scrollToLine) {
          syncGuard = true;
          editorRef.current.scrollToLine(targetLine);
          requestAnimationFrame(() => {
            syncGuard = false;
          });
        }
      };

      editor.addEventListener('scroll', onEditorScroll, { passive: true });
      preview.addEventListener('scroll', onPreviewScroll, { passive: true });
      syncEditorScroll = () => {
        editor.removeEventListener('scroll', onEditorScroll);
        for (const ev of intentEvents) editor.removeEventListener(ev, editorIntent);
      };
      syncPreviewScroll = () => {
        preview.removeEventListener('scroll', onPreviewScroll);
        for (const ev of intentEvents) preview.removeEventListener(ev, previewIntent);
        if (activeTimer) clearTimeout(activeTimer);
      };
    }
    bindRef.current = bindScrollSync;

    function getCurrentTopLine(paneEl: Element, fromMode: string): number | null {
      if (fromMode === 'preview' || fromMode === 'reading') {
        const preview = paneEl.querySelector('.pane--preview .preview-host') as HTMLElement | null;
        if (!preview) return null;
        const list = getPreviewElementsByLine(preview);
        const wrapTop = preview.getBoundingClientRect().top;
        for (const { line, el } of list) {
          const r = el.getBoundingClientRect();
          if (r.bottom >= wrapTop) return line;
        }
        return null;
      }
      return editorRef.current?.getViewLine ? editorRef.current.getViewLine() : null;
    }

    function restoreToLine(paneEl: Element, toMode: string, line: number) {
      if (toMode === 'edit' || toMode === 'split') {
        editorRef.current?.scrollToLine?.(line);
      }
      if (toMode === 'preview' || toMode === 'reading' || toMode === 'split') {
        const preview = paneEl.querySelector('.pane--preview .preview-host') as HTMLElement | null;
        if (preview) {
          const list = getPreviewElementsByLine(preview);
          const entry = findNearestEntry(list, line);
          if (entry) {
            const elRect = entry.el.getBoundingClientRect();
            const wrapRect = preview.getBoundingClientRect();
            preview.scrollTop += elRect.top - wrapRect.top - 8;
          }
        }
      }
    }

    function gotoLine(line: number) {
      if (useSettingsStore.getState().viewMode === 'preview') previewRef.current?.scrollToLine(line);
      else editorRef.current?.gotoLine(line);
    }

    const onOutlineGotoEvent = (e: Event) => {
      const { line, paneId: pid } = (e as CustomEvent).detail;
      if (pid !== paneId) return;
      gotoLine(line);
    };
    const onInsertMarkdownEvent = (e: Event) => {
      const { snippet, paneId: pid } = (e as CustomEvent).detail;
      if (pid !== paneId) return;
      editorRef.current?.insertMarkdown?.(snippet);
    };
    const onInsertImagePathEvent = (e: Event) => {
      const { path, paneId: pid } = (e as CustomEvent).detail;
      if (pid !== paneId) return;
      editorRef.current?.insertImageFromPath?.(path);
    };
    const onPreviewSearchEvent = (e: Event) => {
      const { paneId: pid } = (e as CustomEvent).detail;
      if (pid !== paneId) return;
      previewRef.current?.openSearch?.();
    };

    const mountTimer = setTimeout(bindScrollSync, 300);
    window.addEventListener('eidon:outline-goto', onOutlineGotoEvent);
    window.addEventListener('eidon:insert-markdown', onInsertMarkdownEvent);
    window.addEventListener('eidon:insert-image-path', onInsertImagePathEvent);
    window.addEventListener('eidon:preview-search', onPreviewSearchEvent);

    // 视图模式切换：在旧 DOM 仍在时快照 top line，100ms 后还原到新视图并重绑同步。
    let prevMode = useSettingsStore.getState().viewMode;
    const unsub = useSettingsStore.subscribe((state) => {
      if (state.viewMode === prevMode) return;
      const oldMode = prevMode;
      prevMode = state.viewMode;
      const paneEl = document.querySelector(`[data-pane-id="${paneId}"]`);
      const savedLine = paneEl ? getCurrentTopLine(paneEl, oldMode) : null;
      setTimeout(() => {
        if (savedLine != null) {
          const newPaneEl = document.querySelector(`[data-pane-id="${paneId}"]`);
          if (newPaneEl) restoreToLine(newPaneEl, state.viewMode, savedLine);
        }
        bindScrollSync();
      }, 100);
    });

    return () => {
      clearTimeout(mountTimer);
      syncEditorScroll?.();
      syncPreviewScroll?.();
      unsub();
      window.removeEventListener('eidon:outline-goto', onOutlineGotoEvent);
      window.removeEventListener('eidon:insert-markdown', onInsertMarkdownEvent);
      window.removeEventListener('eidon:insert-image-path', onInsertImagePathEvent);
      window.removeEventListener('eidon:preview-search', onPreviewSearchEvent);
    };
  }, [paneId]);

  // 切 tab：100ms 后重绑滚动同步。
  useEffect(() => {
    const tid = setTimeout(() => bindRef.current?.(), 100);
    return () => clearTimeout(tid);
  }, [tab?.id]);

  const handleCursor = (line: number, col: number) => {
    if (isFocused()) onCursor(line, col);
  };
  const handleSelection = (text: string) => {
    if (isFocused()) onSelection(text);
  };

  return (
    <div className="pane-content">
      {showAsset && tab && <AssetPane tab={tab} />}
      {showEditor && tab && (
        <div className="pane pane--editor">
          <Editor
            ref={editorRef}
            tab={tab}
            focusMode={focusMode}
            typewriterMode={typewriterMode}
            spellCheck={spellCheck}
            onCursor={handleCursor}
            onSelection={handleSelection}
          />
        </div>
      )}
      {showPreview && tab && (
        <div className="pane pane--preview">
          {/* onOpenPath 复刻 Vue Preview.vue 内部直接 files.openPath 的行为：普通预览/分屏窗格里相对链接可点开 */}
          <Preview ref={previewRef} source={tab.content} filePath={tab.filePath} onOpenPath={openPath} />
        </div>
      )}
    </div>
  );
}

export default PaneContent;
