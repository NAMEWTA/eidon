/**
 * HistoryPanel.tsx — AutoGit 每文档历史面板。
 * 列出触及当前文档的提交（新→旧），点击展开 unified diff，Restore 回滚工作副本并同步标签缓冲。
 * watch → useEffect。
 */
import { Fragment, useEffect, useState } from 'react';
import { Icon } from '../shared/Icons';
import { useTabsStore } from '../../stores/tabs';
import { useWorkspaceStore } from '../../stores/workspace';
import { useSettingsStore } from '../../stores/settings';
import { useGitHistoryStore, type CommitMeta, type DiffResult } from '../../stores/gitHistory';
import { useToastsStore } from '../../stores/toasts';
import { useI18n } from '../../i18n';

export function HistoryPanel({ onClose }: { onClose?: () => void }) {
  const { t } = useI18n();
  const activeFile = useTabsStore((s) => s.activeTab()?.filePath ?? null);
  const folder = useWorkspaceStore((s) => s.currentFolder);
  const headSha = useGitHistoryStore((s) => s.status?.headSha);
  const ghLoading = useGitHistoryStore((s) => s.loading);
  const initialized = useGitHistoryStore((s) => s.isInitialized());
  const [commits, setCommits] = useState<CommitMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedSha, setExpandedSha] = useState<string | null>(null);
  const [diffCache, setDiffCache] = useState<Record<string, DiffResult | null>>({});

  async function reload() {
    if (!folder || !activeFile) {
      setCommits([]);
      return;
    }
    // 守卫：跨工作区携带的标签页可能指向非当前工作区的文件
    if (!activeFile.startsWith(folder + "/") && activeFile !== folder) {
      setCommits([]);
      return;
    }
    if (!useGitHistoryStore.getState().status) {
      await useGitHistoryStore.getState().refreshStatus(folder);
    }
    if (!useGitHistoryStore.getState().isInitialized()) {
      setCommits([]);
      return;
    }
    setLoading(true);
    try {
      const limit = useSettingsStore.getState().historyMaxVersionsPerFile;
      setCommits(await useGitHistoryStore.getState().historyFor(folder, activeFile, limit));
    } finally {
      setLoading(false);
    }
  }

  // folder / activeFile 变化：重置展开 + 清缓存 + 重载。
  useEffect(() => {
    setExpandedSha(null);
    setDiffCache({});
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder, activeFile]);

  // HEAD 移动：清缓存 + 重载。
  useEffect(() => {
    setDiffCache({});
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headSha]);

  async function onInit() {
    if (!folder) return;
    try {
      await useGitHistoryStore.getState().init(folder, 'init: EIDON workspace');
      useToastsStore.getState().success(t('history.initialized'));
      reload();
    } catch (e) {
      useToastsStore.getState().error(`${t('history.initFailed')}: ${e}`);
    }
  }

  async function toggleRow(sha: string) {
    if (expandedSha === sha) {
      setExpandedSha(null);
      return;
    }
    setExpandedSha(sha);
    if (diffCache[sha] === undefined && folder && activeFile) {
      const d = await useGitHistoryStore.getState().diff(folder, activeFile, sha);
      setDiffCache((c) => ({ ...c, [sha]: d }));
    }
  }

  async function onRestore(sha: string, shortSha: string) {
    if (!folder || !activeFile) return;
    if (!window.confirm(t('history.confirmRestore', { sha: shortSha }))) return;
    const tabId = useTabsStore.getState().activeTab()?.id;
    try {
      await useGitHistoryStore.getState().rollback(folder, activeFile, sha);
      const restored = await useGitHistoryStore.getState().fileAt(folder, activeFile, sha);
      if (restored !== null && tabId) {
        useTabsStore.getState().setContent(tabId, restored);
        useTabsStore.getState().markSaved(tabId, activeFile);
      }
      useToastsStore.getState().success(t('history.restored', { sha: shortSha }));
    } catch (e) {
      useToastsStore.getState().error(`${t('history.commitFailed')}: ${e}`);
    }
  }

  function timeAgo(unix: number): string {
    const now = Math.floor(Date.now() / 1000);
    const delta = Math.max(0, now - unix);
    if (delta < 60) return t('history.justNow');
    if (delta < 3600) return `${Math.floor(delta / 60)}m`;
    if (delta < 86_400) return `${Math.floor(delta / 3600)}h`;
    if (delta < 86_400 * 30) return `${Math.floor(delta / 86_400)}d`;
    const d = new Date(unix * 1000);
    return d.toISOString().slice(0, 10);
  }

  return (
    <div className="history">
      <header className="history__head">
        <span className="history__title">{t('history.heading')}</span>
        {!loading && commits.length > 0 && <span className="history__count">{commits.length}</span>}
        {onClose && <button className="rs-pane-close" type="button" title={t('rightSidebar.hidePane')} onClick={onClose}><Icon name="close" size={16} /></button>}
      </header>

      {!folder ? (
        <div className="history__empty">{t('history.openFolder')}</div>
      ) : !initialized ? (
        <div className="history__empty">
          <p className="history__msg">{t('history.notInitialized')}</p>
          <button className="history__init-btn" disabled={ghLoading} onClick={onInit}>
            {ghLoading ? '…' : t('history.initBtn')}
          </button>
        </div>
      ) : !activeFile ? (
        <div className="history__empty">{t('history.noActive')}</div>
      ) : loading ? (
        <div className="history__empty">{t('history.loading')}</div>
      ) : commits.length === 0 ? (
        <div className="history__empty">{t('history.empty')}</div>
      ) : (
        <ul className="history__list">
          {commits.map((c) => (
            <li key={c.sha} className="history__item">
              <button
                className={`history__row${expandedSha === c.sha ? ' history__row--open' : ''}`}
                onClick={() => toggleRow(c.sha)}
              >
                <span className="history__sha">{c.shortSha}</span>
                <span className="history__time">{timeAgo(c.time)}</span>
                <span className="history__msg-line">{c.message}</span>
              </button>
              {expandedSha === c.sha && (
                <div className="history__diff-wrap">
                  <div className="history__diff-toolbar">
                    <button className="history__restore" onClick={() => onRestore(c.sha, c.shortSha)}>
                      {t('history.restore')}
                    </button>
                    <span className="history__author">{c.author}</span>
                  </div>
                  {diffCache[c.sha] === undefined ? (
                    <div className="history__diff-loading">{t('history.loading')}</div>
                  ) : !diffCache[c.sha] ? (
                    <div className="history__diff-empty">{t('history.diffUnavailable')}</div>
                  ) : (
                    <pre className="history__diff">
                      {diffCache[c.sha]!.hunks.map((hunk, hi) => (
                        <Fragment key={hi}>
                          <span className="history__hunk-hdr">
                            @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
                          </span>
                          {hunk.lines.map((line, li) => (
                            <span key={`${hi}-${li}`} className={`history__line history__line--${line.kind}`}>
                              {(line.kind === 'add' ? '+' : line.kind === 'remove' ? '-' : ' ') + line.text}
                            </span>
                          ))}
                        </Fragment>
                      ))}
                    </pre>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default HistoryPanel;
