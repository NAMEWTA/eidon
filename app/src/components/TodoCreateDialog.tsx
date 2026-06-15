/**
 * TodoCreateDialog.tsx — 在某 L1/L2/L3 节点上创建待办事项的弹窗。
 *
 * 由文件树右键菜单「创建待办事项」唤起。填写：内容（必填）+ 可选提醒时间（datetime-local，
 * 同时作为截止日落到日历当天）+ 重复规则。提交经 useTodosStore.createTodo 一次写入
 * `<node>/.node/todos.json`，并由提醒调度器接管定时。复用 node-dialog 弹窗样式。
 */
import { useState } from 'react';

import type { ReminderRepeat } from '../../core/contracts';
import type { ScannedNode } from '../../core/nodes';
import { useTodosStore } from '../stores/todos';
import { useToastsStore } from '../stores/toasts';
import { useI18n } from '../i18n';
import { Icon } from './Icons';

const REPEATS: ReminderRepeat[] = ['once', 'daily', 'weekly', 'monthly'];

const basename = (p: string): string => p.split('/').filter(Boolean).pop() ?? p;

// datetime-local（本地墙钟）→ ISO；截止日取当天 00:00 的本地日期 ISO。
const localToIso = (v: string): string => new Date(v).toISOString();
const localToDueIso = (v: string): string => {
  const d = new Date(v);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

export function TodoCreateDialog({ node, onClose, onCreated }: {
  node: ScannedNode;
  onClose: () => void;
  onCreated?: () => void;
}) {
  const { t } = useI18n();
  const [text, setText] = useState('');
  const [reminderAt, setReminderAt] = useState('');
  const [repeat, setRepeat] = useState<ReminderRepeat>('once');
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      await useTodosStore.getState().createTodo(node.path, node.node.id, {
        text,
        due: reminderAt ? localToDueIso(reminderAt) : null,
        reminderAt: reminderAt ? localToIso(reminderAt) : null,
        repeat,
      });
      useToastsStore.getState().success(t('todos.created'));
      onCreated?.();
      onClose();
    } catch (error) {
      useToastsStore.getState().error(String(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="node-dialog__backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="node-dialog" role="dialog" aria-label={t('todos.createTitle')}>
        <header className="node-dialog__header">
          <h3>{t('todos.createTitle')} · L{node.node.level} · {basename(node.path)}</h3>
          <button type="button" onClick={onClose} title={t('todos.cancel')}><Icon name="close" size={16} /></button>
        </header>

        <div className="node-dialog__body">
          <label>
            {t('todos.contentLabel')}
            <input
              value={text}
              autoFocus
              placeholder={t('todos.addPlaceholder')}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }}
            />
          </label>

          <label>
            {t('todos.reminderLabel')}
            <input type="datetime-local" value={reminderAt} onChange={(e) => setReminderAt(e.target.value)} />
          </label>

          {reminderAt && (
            <label>
              {t('todos.repeatLabel')}
              <select value={repeat} onChange={(e) => setRepeat(e.target.value as ReminderRepeat)}>
                {REPEATS.map((r) => <option key={r} value={r}>{t(`todos.repeatName.${r}`)}</option>)}
              </select>
            </label>
          )}
        </div>

        <footer className="node-dialog__footer">
          <button type="button" onClick={onClose}>{t('todos.cancel')}</button>
          <button type="button" className="primary-btn" disabled={!text.trim() || submitting} onClick={() => void submit()}>
            {t('todos.create')}
          </button>
        </footer>
      </div>
    </div>
  );
}

export default TodoCreateDialog;
