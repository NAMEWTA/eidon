/**
 * DiffView.tsx — 编辑器主区内的「历史版本 ↔ 当前」对比视图（VSCode 式，可编辑）。
 *
 * 由 PaneContent 在 diffView store 命中当前 tab 时挂载（取代 Editor/Preview）。
 * 基于 @codemirror/merge，复用主编辑器的扩展（buildDiffEditorExtensions）→ 观感/编辑体验一致（防割裂）：
 *  - 旧侧 = 选中历史版本(fileAt sha)，新侧 = 当前内容(tab.content)，且**当前侧可直接编辑**，改动经
 *    setContent 回灌 tab（与主编辑器同一份文档、同一 dirty/保存/自动提交链路）。
 *  - 版式：stacked=上下（unifiedMergeView，历史以删除块叠在当前之上，默认）；split=并排（MergeView，左历史只读/右当前可编辑）。
 *  - 无差异时照常显示当前完整内容（merge 视图天然如此，无空状态）。
 * 退出：工具栏✕ / 切 tab / 切工作区（见 App.tsx）→ diffView.close()。
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { EditorView } from '@codemirror/view';
import { MergeView, unifiedMergeView } from '@codemirror/merge';
import { Icon } from '../shared/Icons';
import type { Tab } from '../../types';
import { useDiffViewStore } from '../../stores/diffView';
import { useSettingsStore } from '../../stores/settings';
import { useGitHistoryStore } from '../../stores/gitHistory';
import { useTabsStore } from '../../stores/tabs';
import { useToastsStore } from '../../stores/toasts';
import { useI18n } from '../../i18n';
import { buildDiffEditorExtensions, type DiffEditorSettings } from '../../editor-extensions/cm-config';

export interface DiffViewProps {
  tab: Tab;
  folder: string;
}

/** 从 settings 快照出 diff 单侧编辑器需要的视觉切片。 */
function diffSettingsSnapshot(): DiffEditorSettings {
  const s = useSettingsStore.getState();
  return {
    showLineNumbers: s.showLineNumbers,
    wordWrap: s.wordWrap,
    theme: s.theme,
    fontSize: s.fontSize,
    fontFamily: s.fontFamily,
    language: s.language,
  };
}

export function DiffView({ tab, folder }: DiffViewProps) {
  const { t } = useI18n();
  const sha = useDiffViewStore((s) => s.sha);
  const shortSha = useDiffViewStore((s) => s.shortSha);
  const message = useDiffViewStore((s) => s.message);
  const author = useDiffViewStore((s) => s.author);
  const close = useDiffViewStore((s) => s.close);
  const diffLayout = useSettingsStore((s) => s.diffLayout);
  const setDiffLayout = useSettingsStore((s) => s.setDiffLayout);
  const collapseUnchanged = useSettingsStore((s) => s.diffCollapseUnchanged);
  const setCollapseUnchanged = useSettingsStore((s) => s.setDiffCollapseUnchanged);
  // 触发 merge 视图重建的视觉设置（变化即重建）。
  const theme = useSettingsStore((s) => s.theme);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const fontFamily = useSettingsStore((s) => s.fontFamily);
  const wordWrap = useSettingsStore((s) => s.wordWrap);
  const showLineNumbers = useSettingsStore((s) => s.showLineNumbers);

  const [oldContent, setOldContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // 递增 token：仅最后一次发起的请求允许写回，防止快速切节点/文件时旧结果覆盖新结果。
  const reqRef = useRef(0);
  const hostRef = useRef<HTMLDivElement | null>(null);

  const filePath = tab.filePath;
  const isMarkdown = tab.language === 'markdown';
  const tabId = tab.id;
  const shaLabel = shortSha ?? sha?.slice(0, 7) ?? '';

  // 取旧侧（选中历史版本）内容。
  useEffect(() => {
    if (!sha || !filePath) return;
    const token = ++reqRef.current;
    setLoading(true);
    setOldContent(null);
    void (async () => {
      const content = await useGitHistoryStore.getState().fileAt(folder, filePath, sha);
      if (token !== reqRef.current) return; // 已被更新的请求取代
      // null = 该提交里没有此文件（新增文件）→ 旧侧按空串，呈现全量新增。
      setOldContent(content ?? '');
      setLoading(false);
    })();
  }, [folder, filePath, sha]);

  // 构建 merge 视图（命令式）。重建键：版式 / 历史内容 / 视觉设置 / tab。
  // 当前侧 doc 用 getState 实时读取（不依赖 tab.content），避免每次键入重建。
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host || oldContent === null) return;
    const settings = diffSettingsSnapshot();
    const current = useTabsStore.getState().tabs.find((x) => x.id === tabId)?.content ?? tab.content;
    const onDocChanged = (text: string) => useTabsStore.getState().setContent(tabId, text);
    // 默认 undefined = 显示全部（含未改动行）；开启「仅修改」时折叠未改动区段，保留 3 行上下文。
    const collapse = collapseUnchanged ? { margin: 3, minSize: 4 } : undefined;

    if (diffLayout === 'split') {
      const mv = new MergeView({
        a: { doc: oldContent, extensions: buildDiffEditorExtensions({ settings, isMarkdown, editable: false }) },
        b: { doc: current, extensions: buildDiffEditorExtensions({ settings, isMarkdown, editable: true, onDocChanged }) },
        parent: host,
        orientation: 'a-b',
        gutter: true,
        highlightChanges: true,
        collapseUnchanged: collapse,
      });
      return () => mv.destroy();
    }
    // stacked（上下）：单编辑器 + unifiedMergeView，doc=当前(可编辑)，original=历史。
    const view = new EditorView({
      parent: host,
      doc: current,
      extensions: [
        buildDiffEditorExtensions({ settings, isMarkdown, editable: true, onDocChanged }),
        unifiedMergeView({
          original: oldContent,
          mergeControls: false,
          gutter: true,
          collapseUnchanged: collapse,
        }),
      ],
    });
    return () => view.destroy();
    // 不依赖 tab.content：当前侧 CM 即真源，编辑经 onDocChanged 外流；
    // 若把 content 入依赖会每次键入重建、光标被甩走。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diffLayout, collapseUnchanged, oldContent, theme, fontSize, fontFamily, wordWrap, showLineNumbers, tabId, isMarkdown]);

  async function onRestore() {
    if (!sha || !filePath) return;
    if (!window.confirm(t('history.confirmRestore', { sha: shaLabel }))) return;
    try {
      await useGitHistoryStore.getState().rollback(folder, filePath, sha);
      const restored = await useGitHistoryStore.getState().fileAt(folder, filePath, sha);
      if (restored !== null) {
        useTabsStore.getState().setContent(tabId, restored);
        useTabsStore.getState().markSaved(tabId, filePath);
      }
      useToastsStore.getState().success(t('history.restored', { sha: shaLabel }));
      close(); // 恢复后当前内容 == 该版本，diff 归零 → 退出。
    } catch (e) {
      useToastsStore.getState().error(`${t('history.commitFailed')}: ${e}`);
    }
  }

  return (
    <div className="diff-view">
      <div className="diff-view__toolbar">
        <div className="diff-view__title">
          <span className="diff-view__comparing">{t('diff.comparing', { sha: shaLabel })}</span>
          {message && <span className="diff-view__msg" title={message}>{message}</span>}
          {author && <span className="diff-view__author">{author}</span>}
        </div>
        <div className="diff-view__actions">
          <div className="diff-view__toggle-group" role="group">
            <button
              type="button"
              className={`diff-view__toggle${!collapseUnchanged ? ' diff-view__toggle--active' : ''}`}
              onClick={() => setCollapseUnchanged(false)}
            >
              {t('diff.showAll')}
            </button>
            <button
              type="button"
              className={`diff-view__toggle${collapseUnchanged ? ' diff-view__toggle--active' : ''}`}
              onClick={() => setCollapseUnchanged(true)}
            >
              {t('diff.onlyChanges')}
            </button>
          </div>
          <div className="diff-view__toggle-group" role="group">
            <button
              type="button"
              className={`diff-view__toggle${diffLayout === 'stacked' ? ' diff-view__toggle--active' : ''}`}
              onClick={() => setDiffLayout('stacked')}
            >
              {t('diff.stacked')}
            </button>
            <button
              type="button"
              className={`diff-view__toggle${diffLayout === 'split' ? ' diff-view__toggle--active' : ''}`}
              onClick={() => setDiffLayout('split')}
            >
              {t('diff.split')}
            </button>
          </div>
          <button type="button" className="diff-view__restore" onClick={onRestore}>
            {t('history.restore')}
          </button>
          <button
            type="button"
            className="diff-view__close"
            title={t('diff.close')}
            aria-label={t('diff.close')}
            onClick={() => close()}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      </div>

      {/* 左右/上下两侧的明确标识：哪边是历史版本、哪边是当前可编辑。 */}
      {diffLayout === 'split' ? (
        <div className="diff-view__panes-head">
          <div className="diff-view__pane-label diff-view__pane-label--old">{t('diff.historyLabel', { sha: shaLabel })}</div>
          <div className="diff-view__pane-label diff-view__pane-label--new">{t('diff.currentLabel')}</div>
        </div>
      ) : (
        <div className="diff-view__unified-hint">{t('diff.unifiedHint', { sha: shaLabel })}</div>
      )}

      <div className="diff-view__host">
        {/* CM 挂载节点保持空（由 @codemirror/merge 命令式接管其子节点，React 不介入）。 */}
        <div className="cm-host" ref={hostRef} />
        {loading && <div className="diff-view__loading">{t('history.loading')}</div>}
      </div>
    </div>
  );
}

export default DiffView;
