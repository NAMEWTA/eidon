/**
 * TagsPanel.tsx — 标签侧栏（纯标签：列出工作区索引的 #tag，按频次降序、再字母序；点击 emit filter-tag）。
 * 日期/每日笔记导航已迁出至左抽屉「日历整理箱」(CalendarPanel)，标签面板不再承载日期能力。
 */
import { useMemo } from 'react';
import { Icon } from '../shared/Icons';
import { useWorkspaceIndexStore } from '../../stores/workspaceIndex';
import { useI18n } from '../../i18n';

export function TagsPanel({ onFilterTag, onClose }: { onFilterTag: (tag: string) => void; onClose?: () => void }) {
  const { t } = useI18n();
  const tags = useWorkspaceIndexStore((s) => s.tags);
  const folder = useWorkspaceIndexStore((s) => s.folder);

  const sortedTags = useMemo(
    () => [...tags].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag)),
    [tags],
  );
  const hasFolder = folder !== null;

  return (
    <div className="tags-panel">
      <header className="tags-panel__head">
        <span className="tags-panel__title">{t('tags.heading')}</span>
        {onClose && <button className="rs-pane-close" type="button" title={t('rightSidebar.hidePane')} onClick={onClose}><Icon name="close" size={16} /></button>}
      </header>
      {!hasFolder ? (
        <div className="tags-panel__empty">{t('tags.openFolder')}</div>
      ) : sortedTags.length === 0 ? (
        <div className="tags-panel__empty">{t('tags.empty')}</div>
      ) : (
        <ul className="tags-panel__list">
          {sortedTags.map((row) => (
            <li key={row.tag} className="tags-panel__item">
              <button className="tags-panel__row" onClick={() => onFilterTag(row.tag)}>
                <span className="tags-panel__pill">#{row.tag}</span>
                <span className="tags-panel__count">{row.count}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default TagsPanel;
