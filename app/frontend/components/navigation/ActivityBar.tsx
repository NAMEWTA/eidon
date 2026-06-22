/**
 * ActivityBar.tsx — 左右两侧竖条按钮栏（IDE 形态）。
 *
 * 左栏（上→下）：品牌 logo、分隔线、文件资源(explorer)、搜索(search)、日历(calendar)、
 *   spacer、设置(settings，底部)。
 * 右栏（上→下）：大纲(outline)、节点属性(node)、反向链接(backlinks)、标签(tags)、历史(history)。
 *
 * 点击按钮 = toggle 对应抽屉视图（再点同按钮收起；点其他按钮切换）。
 * 激活按钮带黏土色指示条（::before 2px bar）。
 * 统一样式类：activitybar / ab-btn / ab-divider / ab-spacer（见 components.css）。
 */
import { Icon } from '../shared/Icons';
import { EidonPet } from '../features/EidonPet';
import { useSettingsStore, type LeftPanelView, type RightPanelView } from '../../stores/settings';
import { useI18n } from '../../i18n';

export interface ActivityBarItem {
  id: string;
  icon: string;
  label: string;
  /** 对应的抽屉视图 id（null 表示不切换抽屉，仅触发 onClick）。 */
  viewId?: string;
  onClick?: () => void;
}

interface ActivityBarProps {
  side: 'left' | 'right';
}

export function ActivityBar({ side }: ActivityBarProps) {
  const { t } = useI18n();
  const settings = useSettingsStore();

  const leftPanelView = settings.leftPanelView;
  const rightPanelView = settings.rightPanelView;

  // ---- 左侧按钮项 ----
  const leftItems: ActivityBarItem[] = [
    { id: 'explorer', icon: 'sidebar', label: t('activitybar.explorer'), viewId: 'explorer' },
    { id: 'search', icon: 'search', label: t('activitybar.search'), viewId: 'search' },
    { id: 'calendar', icon: 'calendar', label: t('activitybar.calendar'), viewId: 'calendar' },
    { id: 'todos', icon: 'todos', label: t('activitybar.todos'), viewId: 'todos' },
  ];

  // ---- 右侧按钮项（AI 对话置顶）----
  const rightItems: ActivityBarItem[] = [
    { id: 'ai', icon: 'sparkles', label: t('activitybar.ai'), viewId: 'ai' },
    { id: 'outline', icon: 'outline', label: t('activitybar.outline'), viewId: 'outline' },
    { id: 'node', icon: 'folder-tree', label: t('activitybar.node'), viewId: 'node' },
    { id: 'backlinks', icon: 'git-commit', label: t('activitybar.backlinks'), viewId: 'backlinks' },
    { id: 'tags', icon: 'hash', label: t('activitybar.tags'), viewId: 'tags' },
    { id: 'history', icon: 'recent', label: t('activitybar.history'), viewId: 'history' },
  ];

  const items = side === 'left' ? leftItems : rightItems;

  function handleClick(item: ActivityBarItem) {
    if (item.onClick) {
      item.onClick();
      return;
    }
    if (!item.viewId) return;

    if (side === 'left') {
      const view = item.viewId as Exclude<LeftPanelView, null>;
      settings.toggleLeftPanelView(view);
    } else {
      const view = item.viewId as Exclude<RightPanelView, null>;
      settings.toggleRightPanelView(view);
    }
  }

  function isActive(item: ActivityBarItem): boolean {
    if (!item.viewId) return false;
    if (side === 'left') {
      return leftPanelView === item.viewId;
    } else {
      return rightPanelView === item.viewId;
    }
  }

  return (
    <div className={`activitybar activitybar--${side}`}>
      {side === 'left' && (
        <>
          <div className="activitybar__brand" title={t('activitybar.pet')}>
            {/* 交互式像素宠物「小芽」（精灵表见 scripts/generate-brand-icon.mjs / EidonPet.tsx） */}
            <EidonPet label={t('activitybar.pet')} />
          </div>
          <div className="ab-divider" />
        </>
      )}

      {items.map((item) => (
        <button
          key={item.id}
          className={`ab-btn${isActive(item) ? ' ab-btn--active' : ''}`}
          title={item.label}
          onClick={() => handleClick(item)}
          aria-label={item.label}
          aria-pressed={isActive(item)}
        >
          <Icon name={item.icon} size={20} />
        </button>
      ))}

      {side === 'left' && (
        <>
          <div className="ab-spacer" />
          <button
            className="ab-btn"
            title={t('activitybar.settings')}
            onClick={() => window.dispatchEvent(new CustomEvent('eidon:open-settings'))}
            aria-label={t('activitybar.settings')}
          >
            <Icon name="settings" size={20} />
          </button>
        </>
      )}
    </div>
  );
}

export default ActivityBar;
