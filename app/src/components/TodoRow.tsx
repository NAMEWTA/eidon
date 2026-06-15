/**
 * TodoRow.tsx — 单条节点级待办的可复用行（checkbox / 文本 / 节点面包屑 / 到期·提醒徽标 /
 * 展开后的截止日 + 提醒编辑器）。
 *
 * 由 TodoListPanel（全局聚合抽屉）与 CalendarPanel（按日期匹配的「待办事项」区）共用，
 * 避免两处逐字复制。**必须是模块级组件**：若内联定义在父组件函数体内，父组件每次重渲染
 * 都会让 React 以为是新组件类型而卸载重挂，丢失行内 expanded / 输入框状态。
 *
 * expanded 受控可选：传 `expanded` + `onToggleExpand` 即受控（TodoListPanel 单开手风琴）；
 * 不传则行内自管（CalendarPanel 各行独立展开）。
 */
import { useState } from 'react';

import { Icon } from './Icons';
import { useI18n } from '../i18n';
import { useTodosStore } from '../stores/todos';
import type { AggregatedTodo } from '../../core/todos';
import type { ReminderRepeat } from '../../core/contracts';

const pad = (n: number): string => String(n).padStart(2, '0');

/** ISO → `<input type="datetime-local">`（本地墙钟，无时区后缀）。 */
export const isoToLocalInput = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
/** `<input type="datetime-local">` 值 → ISO。 */
export const localInputToIso = (v: string): string => new Date(v).toISOString();
/** ISO → `<input type="date">`（仅日期）。 */
export const dateToInput = (iso: string): string => isoToLocalInput(iso).slice(0, 10);
/** workspace 相对路径取末段（节点面包屑）。 */
export const basename = (p: string): string => p.split('/').filter(Boolean).pop() ?? p;

const REPEATS: ReminderRepeat[] = ['once', 'daily', 'weekly', 'monthly'];

export function TodoRow({
  agg,
  expanded: expandedProp,
  onToggleExpand,
}: {
  agg: AggregatedTodo;
  /** 受控展开态（不传则行内自管）。 */
  expanded?: boolean;
  onToggleExpand?: () => void;
}) {
  const { t } = useI18n();
  const { nodePath, nodeId, item } = agg;
  const store = useTodosStore;

  const [expandedLocal, setExpandedLocal] = useState(false);
  const expanded = expandedProp ?? expandedLocal;
  const toggleExpand = onToggleExpand ?? (() => setExpandedLocal((v) => !v));

  const [reminderAt, setReminderAt] = useState('');
  const [repeat, setRepeat] = useState<ReminderRepeat>('once');

  async function addReminder() {
    if (!reminderAt) return;
    await store.getState().setReminder(nodePath, nodeId, item.id, localInputToIso(reminderAt), repeat);
    setReminderAt('');
    setRepeat('once');
  }

  const hasReminder = item.reminders.length > 0;

  return (
    <li className={`todos-item${item.done ? ' todos-item--done' : ''}`}>
      <div className="todos-item__row">
        <button
          className={`todos-check${item.done ? ' todos-check--on' : ''}`}
          type="button"
          onClick={() => void store.getState().toggleDone(nodePath, nodeId, item.id)}
          aria-pressed={item.done}
          title={t('todos.toggleDone')}
        >
          {item.done && <Icon name="check" size={12} />}
        </button>
        <div className="todos-item__main">
          <span className="todos-item__text">{item.text}</span>
          <span className="todos-item__meta">
            <span className="todos-item__node" title={nodePath}>{basename(nodePath)}</span>
            {item.due && <span className="todos-badge todos-badge--due"><Icon name="calendar" size={11} /> {dateToInput(item.due)}</span>}
            {hasReminder && <span className="todos-badge todos-badge--rem"><Icon name="bell" size={11} /> {item.reminders.length}</span>}
          </span>
        </div>
        <button className="todos-item__act" type="button" onClick={toggleExpand} title={t('todos.edit')}>
          <Icon name="alarm" size={15} />
        </button>
        <button className="todos-item__act" type="button" onClick={() => void store.getState().deleteTodo(nodePath, nodeId, item.id)} title={t('todos.delete')}>
          <Icon name="trash" size={15} />
        </button>
      </div>

      {expanded && (
        <div className="todos-editor">
          {/* 截止日 */}
          <label className="todos-editor__field">
            <span>{t('todos.due')}</span>
            <input
              type="date"
              value={item.due ? dateToInput(item.due) : ''}
              onChange={(e) => void store.getState().setDue(nodePath, nodeId, item.id, e.target.value ? new Date(`${e.target.value}T00:00`).toISOString() : null)}
            />
          </label>

          {/* 已设提醒列表 */}
          {item.reminders.length > 0 && (
            <ul className="todos-reminders">
              {item.reminders.map((r) => (
                <li key={r.id} className="todos-reminder">
                  <Icon name="bell" size={11} />
                  <span>{new Date(r.fireAt).toLocaleString()}</span>
                  <span className="todos-reminder__repeat">{t(`todos.repeatName.${r.repeat}`)}</span>
                  <button type="button" onClick={() => void store.getState().removeReminder(nodePath, nodeId, item.id, r.id)} title={t('todos.removeReminder')}>
                    <Icon name="close" size={12} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* 新增提醒 */}
          <div className="todos-editor__add">
            <input type="datetime-local" value={reminderAt} onChange={(e) => setReminderAt(e.target.value)} />
            <select value={repeat} onChange={(e) => setRepeat(e.target.value as ReminderRepeat)}>
              {REPEATS.map((r) => (
                <option key={r} value={r}>{t(`todos.repeatName.${r}`)}</option>
              ))}
            </select>
            <button type="button" onClick={() => void addReminder()} title={t('todos.addReminder')}>
              <Icon name="insert" size={14} />
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

export default TodoRow;
