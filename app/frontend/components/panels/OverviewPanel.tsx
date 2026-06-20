/**
 * OverviewPanel.tsx — 概览页（快速启动 + 工作区数据总揽）。
 *
 * 当没有打开任何文件时默认显示；也可点左上角像素宠物「小芽」随时唤出
 * （App 监听 `eidon:open-overview`）。内容为脚手架：欢迎区 + 快速操作 + 工作区统计，
 * 全部复用现有 store 数据，后续可继续往上加卡片。
 */
import { useMemo } from 'react';

import { Icon } from '../shared/Icons';
import { useI18n } from '../../i18n';
import { useFiles } from '../../hooks/useFiles';
import { useWorkspaceStore } from '../../stores/workspace';
import { useNodesStore } from '../../stores/nodes';
import { useWorkspaceIndexStore } from '../../stores/workspaceIndex';
import { useTodosStore } from '../../stores/todos';
import type { Level } from '@shared/contracts';
import type { TodoItem } from '@shared/contracts';

// 与 TodoListPanel 同口径：截止日按当天结束计，避免「今天」被当成逾期（#8）。
const todoRefTime = (item: TodoItem): number | null => {
  if (item.due) {
    const d = new Date(item.due);
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  }
  const ts = item.reminders.map((r) => new Date(r.fireAt).getTime());
  return ts.length ? Math.min(...ts) : null;
};

const baseName = (p: string): string => p.split(/[\\/]/).filter(Boolean).pop() ?? p;

function StatCard({ label, value, tone }: { label: string; value: number | string; tone?: 'warn' }) {
  return (
    <div className={`overview__stat${tone === 'warn' ? ' overview__stat--warn' : ''}`}>
      <div className="overview__stat-value">{value}</div>
      <div className="overview__stat-label">{label}</div>
    </div>
  );
}

export function OverviewPanel({ onClose }: { onClose?: () => void }) {
  const { t } = useI18n();
  const files = useFiles();
  const currentFolder = useWorkspaceStore((s) => s.currentFolder);
  const recentFolders = useWorkspaceStore((s) => s.recentFolders);
  const nodes = useNodesStore((s) => s.nodes);
  const tags = useWorkspaceIndexStore((s) => s.tags);
  const entries = useWorkspaceIndexStore((s) => s.entries);
  const todos = useTodosStore((s) => s.items);

  const nodeCounts = useMemo(() => {
    const c: Record<Level, number> = { 1: 0, 2: 0, 3: 0 };
    for (const n of nodes) c[n.node.level] += 1;
    return c;
  }, [nodes]);

  const todoStats = useMemo(() => {
    const now = Date.now();
    const endToday = (() => {
      const d = new Date();
      d.setHours(23, 59, 59, 999);
      return d.getTime();
    })();
    let overdue = 0;
    let today = 0;
    for (const a of todos) {
      if (a.item.done) continue;
      const r = todoRefTime(a.item);
      if (r === null) continue;
      if (r < now) overdue += 1;
      else if (r <= endToday) today += 1;
    }
    return { overdue, today };
  }, [todos]);

  return (
    <div className="overview">
      {onClose && (
        <button className="overview__close" type="button" title={t('overview.close')} onClick={onClose}>
          <Icon name="close" size={16} />
        </button>
      )}

      <header className="overview__hero">
        <span className="overview__pet eidon-pet eidon-pet--happy" aria-hidden="true" />
        <h1 className="overview__title">EIDON</h1>
        <p className="overview__tagline">{t('overview.tagline')}</p>
      </header>

      <section className="overview__section">
        <h2 className="overview__section-title">{t('overview.quickActions')}</h2>
        <div className="overview__actions">
          <button className="overview__action" type="button" onClick={() => void files.newFile()}>
            <Icon name="new-text" size={18} />
            <span>{t('overview.newNote')}</span>
          </button>
          <button className="overview__action" type="button" onClick={() => void files.openFolder()}>
            <Icon name="folder" size={18} />
            <span>{t('overview.openFolder')}</span>
          </button>
        </div>
      </section>

      {currentFolder && (
        <section className="overview__section">
          <h2 className="overview__section-title">{t('overview.stats')}</h2>
          <div className="overview__stats">
            <StatCard label={t('overview.statFiles')} value={entries.length} />
            <StatCard label={t('overview.statNodes')} value={`${nodeCounts[1]} / ${nodeCounts[2]} / ${nodeCounts[3]}`} />
            <StatCard label={t('overview.statTags')} value={tags.length} />
            <StatCard label={t('overview.statTodayTodos')} value={todoStats.today} />
            <StatCard
              label={t('overview.statOverdueTodos')}
              value={todoStats.overdue}
              tone={todoStats.overdue > 0 ? 'warn' : undefined}
            />
          </div>
        </section>
      )}

      {recentFolders.length > 0 && (
        <section className="overview__section">
          <h2 className="overview__section-title">{t('overview.recentFolders')}</h2>
          <ul className="overview__recents">
            {recentFolders.slice(0, 6).map((folder) => (
              <li key={folder}>
                <button
                  className={`overview__recent${folder === currentFolder ? ' overview__recent--active' : ''}`}
                  type="button"
                  title={folder}
                  onClick={() => useWorkspaceStore.getState().setFolder(folder)}
                >
                  <Icon name="folder" size={14} />
                  <span className="overview__recent-name">{baseName(folder)}</span>
                  <span className="overview__recent-path">{folder}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default OverviewPanel;
