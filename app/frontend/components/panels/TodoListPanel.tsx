/**
 * TodoListPanel.tsx — 全局聚合待办抽屉（跨所有 L1/L2/L3 节点汇总 .node/todos.json）。
 *
 * 按 逾期 / 今天 / 即将 / 无期 / 已完成 分组；行渲染复用模块级 TodoRow（与 CalendarPanel 共用）。
 * 数据与调度全在 useTodosStore；本组件只做订阅渲染与分组。新建待办在文件树右键菜单触发。
 */
import { useMemo, useState } from 'react';
import { Icon } from '../shared/Icons';
import { TodoRow } from './TodoRow';
import { useI18n } from '../../i18n';
import { useTodosStore } from '../../stores/todos';
import type { AggregatedTodo } from '@shared/models';
import type { TodoItem } from '@shared/contracts';

type GroupKey = 'overdue' | 'today' | 'upcoming' | 'noDate' | 'done';
const GROUP_ORDER: GroupKey[] = ['overdue', 'today', 'upcoming', 'noDate', 'done'];

// 分组参考时刻：优先截止日，否则取最早提醒；都无 → null（无期）。
// 截止日仅有日期语义（创建时落当天 00:00），按「当天结束」计——否则当天 0 点后即被判逾期。
const refTime = (item: TodoItem): number | null => {
  if (item.due) {
    const d = new Date(item.due);
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  }
  const ts = item.reminders.map((r) => new Date(r.fireAt).getTime());
  return ts.length ? Math.min(...ts) : null;
};

const endOfTodayMs = (): number => {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.getTime();
};

const groupOf = (a: AggregatedTodo, now: number, endToday: number): GroupKey => {
  if (a.item.done) return 'done';
  const ref = refTime(a.item);
  if (ref === null) return 'noDate';
  if (ref < now) return 'overdue';
  if (ref <= endToday) return 'today';
  return 'upcoming';
};

export function TodoListPanel({ onClose }: { onClose?: () => void }) {
  const { t } = useI18n();
  const items = useTodosStore((s) => s.items);
  const loading = useTodosStore((s) => s.loading);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const now = Date.now();
    const endToday = endOfTodayMs();
    const buckets: Record<GroupKey, AggregatedTodo[]> = {
      overdue: [], today: [], upcoming: [], noDate: [], done: [],
    };
    for (const a of items) buckets[groupOf(a, now, endToday)].push(a);
    // 组内按参考时刻升序，无期组按创建时间。
    for (const key of GROUP_ORDER) {
      buckets[key].sort((x, y) => (refTime(x.item) ?? Number.MAX_SAFE_INTEGER) - (refTime(y.item) ?? Number.MAX_SAFE_INTEGER));
    }
    return buckets;
  }, [items]);

  return (
    <div className="todos-panel">
      <header className="todos-panel__head">
        <span className="todos-panel__title">{t('todos.heading')}</span>
        {onClose && (
          <button className="rs-pane-close" type="button" title={t('rightSidebar.hidePane')} onClick={onClose}>
            <Icon name="close" size={16} />
          </button>
        )}
      </header>

      {items.length === 0 ? (
        <div className="todos-panel__empty">{loading ? t('todos.loading') : t('todos.empty')}</div>
      ) : (
        <div className="todos-panel__groups">
          {GROUP_ORDER.filter((g) => grouped[g].length > 0).map((g) => (
            <section key={g} className={`todos-group todos-group--${g}`}>
              <div className="todos-group__head">
                {t(`todos.group.${g}`)} <span className="todos-group__count">{grouped[g].length}</span>
              </div>
              <ul className="todos-list">
                {grouped[g].map((a) => (
                  <TodoRow
                    key={a.item.id}
                    agg={a}
                    expanded={expandedId === a.item.id}
                    onToggleExpand={() => setExpandedId(expandedId === a.item.id ? null : a.item.id)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

export default TodoListPanel;
