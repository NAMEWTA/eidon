/**
 * HistoryPanel.tsx — AutoGit 每文档历史面板（版本列表）。
 * 列出触及当前文档的提交（新→旧）。点击某版本 → 在编辑器主区打开「当前 ↔ 该版本」diff
 * （经 diffView store，渲染见 components/editor/DiffView）。再点同一版本收起；Restore 已移至 diff 工具栏。
 * watch → useEffect。
 */
import { useEffect, useState } from 'react';
import { Icon } from '../shared/Icons';
import { useTabsStore } from '../../stores/tabs';
import { useWorkspaceStore } from '../../stores/workspace';
import { useSettingsStore } from '../../stores/settings';
import { useGitHistoryStore, type CommitMeta } from '../../stores/gitHistory';
import { useDiffViewStore } from '../../stores/diffView';
import { useToastsStore } from '../../stores/toasts';
import { useI18n } from '../../i18n';

export function HistoryPanel({ onClose }: { onClose?: () => void }) {
  const { t } = useI18n();
  const activeFile = useTabsStore((s) => s.activeTab()?.filePath ?? null);
  const folder = useWorkspaceStore((s) => s.currentFolder);
  const headSha = useGitHistoryStore((s) => s.status?.headSha);
  const ghLoading = useGitHistoryStore((s) => s.loading);
  const initialized = useGitHistoryStore((s) => s.isInitialized());
  // 当前正在编辑器里对比的版本（高亮列表对应行）。
  const activeDiffSha = useDiffViewStore((s) => s.sha);
  const [commits, setCommits] = useState<CommitMeta[]>([]);
  const [loading, setLoading] = useState(false);

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

  // folder / activeFile 变化：重载（diff 视图由 App 层在切 tab/工作区时统一关闭）。
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder, activeFile]);

  // HEAD 移动：重载。
  useEffect(() => {
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

  // 点击版本：在编辑器打开对比；再点当前对比版本则收起。
  function onRowClick(c: CommitMeta) {
    if (!activeFile) return;
    const dv = useDiffViewStore.getState();
    if (dv.sha === c.sha && dv.filePath === activeFile) dv.close();
    else dv.open(activeFile, c);
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
                className={`history__row${activeDiffSha === c.sha ? ' history__row--active' : ''}`}
                onClick={() => onRowClick(c)}
              >
                <span className="history__sha">{c.shortSha}</span>
                <span className="history__time">{timeAgo(c.time)}</span>
                <span className="history__msg-line">{c.message}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default HistoryPanel;
