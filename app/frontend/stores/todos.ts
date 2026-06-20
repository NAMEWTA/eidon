/**
 * todos store（Zustand v5）—— 节点级待办 + 定时提醒的前端聚合态与调度编排。
 *
 * 数据源 = 磁盘（每节点 `.node/todos.json`，经 core/todos），**不**入 localStorage：
 * 与 nodes/templates store 同范式，满足「删缓存可重建」。store 仅持内存聚合视图 +
 * 把磁盘写入与调度器重排串起来。
 *
 * 跨 store：节点列表来自 useNodesStore（避免 core/todos 二次全树遍历，见 plan）。
 */
import { create } from 'zustand';

import { todosBridge, notification } from '@bridge/ipc';
import { collectDue, createNodeId, nextFireTime } from '@shared/utils';
import type { AggregatedTodo, DueReminder } from '@shared/models';
import type { NodeTodoFile, Reminder, ReminderRepeat } from '@shared/contracts';
import { t } from '../i18n/t';
import { useNodesStore } from './nodes';
import { useToastsStore } from './toasts';
import { useWorkspaceStore } from './workspace';
import {
  initReminderScheduler,
  rescheduleReminders,
} from '../lib/reminder-scheduler';

interface TodosState {
  items: AggregatedTodo[];
  workspace: string | null;
  loading: boolean;
  error: string | null;
  schedulerReady: boolean;
}

interface TodosActions {
  /** 从当前节点树读取所有 .node/todos.json，结算关窗期间错过的提醒，并（首次）启动调度器。 */
  loadAll(workspace?: string | null): Promise<void>;
  /** 一次性创建待办（内容 + 可选截止日 + 可选定时提醒），供文件树右键「创建待办事项」弹窗使用。 */
  createTodo(
    nodePath: string,
    nodeId: string,
    input: { text: string; due?: string | null; reminderAt?: string | null; repeat?: ReminderRepeat },
  ): Promise<void>;
  toggleDone(nodePath: string, nodeId: string, itemId: string): Promise<void>;
  deleteTodo(nodePath: string, nodeId: string, itemId: string): Promise<void>;
  setDue(nodePath: string, nodeId: string, itemId: string, due: string | null): Promise<void>;
  setReminder(
    nodePath: string,
    nodeId: string,
    itemId: string,
    fireAt: string,
    repeat: ReminderRepeat,
  ): Promise<void>;
  removeReminder(nodePath: string, nodeId: string, itemId: string, reminderId: string): Promise<void>;
}

const resolveWorkspace = (workspace?: string | null): string => {
  const resolved = workspace ?? useWorkspaceStore.getState().currentFolder;
  if (!resolved) throw new Error('Open a workspace first');
  return resolved;
};

/** 取节点树的 {nodeId, nodePath} 列表（喂给 core/todos.scanTodos）。 */
const nodeRefs = (): { nodeId: string; nodePath: string }[] =>
  useNodesStore.getState().nodes.map((n) => ({ nodeId: n.node.id, nodePath: n.path }));

/** 提醒触发/结算后的滚动：once → 标记已通知；重复 → fireAt 推到下一未来周期并复位。 */
const rollReminder = (reminder: Reminder, now: Date): void => {
  if (reminder.repeat === 'once') {
    reminder.notified = true;
    return;
  }
  const next = nextFireTime(reminder, now);
  if (next) {
    reminder.fireAt = next;
    reminder.notified = false;
  } else {
    reminder.notified = true;
  }
};

export const useTodosStore = create<TodosState & TodosActions>()((set, get) => {
  /** 读单节点文件 → 应用 mutator → 写回 → patch 内存聚合态 → 重排调度器。 */
  const mutateNode = async (
    workspace: string,
    nodePath: string,
    nodeId: string,
    mutator: (file: NodeTodoFile) => void,
  ): Promise<void> => {
    const file = await todosBridge.readNode(workspace, nodePath, nodeId);
    mutator(file);
    const written = await todosBridge.writeNode(workspace, nodePath, file);
    const others = get().items.filter((a) => a.nodePath !== nodePath);
    const mine: AggregatedTodo[] = written.items.map((item) => ({ nodeId, nodePath, item }));
    set({ items: [...others, ...mine] });
    rescheduleReminders();
  };

  /** 到期提醒派发：原生通知 + Toast + 宠物表情 + 写回滚动（由调度器回调）。 */
  const handleFire = async (due: DueReminder[]): Promise<void> => {
    const workspace = get().workspace;
    if (!workspace) return;
    for (const d of due) {
      await notification.notify({ title: t('todos.reminderTitle'), body: d.text });
      useToastsStore.getState().info(`⏰ ${d.text}`);
      window.dispatchEvent(new CustomEvent('eidon:reminder-due'));
      await mutateNode(workspace, d.nodePath, d.nodeId, (file) => {
        const item = file.items.find((i) => i.id === d.itemId);
        const reminder = item?.reminders.find((r) => r.id === d.reminder.id);
        if (reminder) rollReminder(reminder, new Date());
      });
    }
  };

  return {
    items: [],
    workspace: null,
    loading: false,
    error: null,
    schedulerReady: false,

    async loadAll(workspace) {
      const root = resolveWorkspace(workspace);
      set({ loading: true, error: null });
      try {
        const items = await todosBridge.scan(root, nodeRefs());
        set({ items, workspace: root, loading: false });

        // 关窗期间错过的提醒：静默结算（不补发通知，避免开窗轰炸），逾期态由 UI 按 due 呈现。
        const missed = collectDue(items, new Date());
        for (const d of missed) {
          await mutateNode(root, d.nodePath, d.nodeId, (file) => {
            const item = file.items.find((i) => i.id === d.itemId);
            const reminder = item?.reminders.find((r) => r.id === d.reminder.id);
            if (reminder) rollReminder(reminder, new Date());
          });
        }

        // 首次启动调度器；后续 mutateNode 内的 rescheduleReminders 负责重排。
        if (!get().schedulerReady) {
          initReminderScheduler({ getItems: () => get().items, onFire: handleFire });
          set({ schedulerReady: true });
        } else {
          rescheduleReminders();
        }
      } catch (error) {
        set({ error: String(error), loading: false });
      }
    },

    async createTodo(nodePath, nodeId, input) {
      const text = input.text.trim();
      if (!text) return;
      const root = resolveWorkspace();
      // 带提醒的待办：提前申请系统通知权限（首次会弹授权框），到点才不丢通知。
      if (input.reminderAt) void notification.ensureNotificationPermission();
      await mutateNode(root, nodePath, nodeId, (file) => {
        const reminders = input.reminderAt
          ? [{ id: createNodeId(), fireAt: input.reminderAt, repeat: input.repeat ?? 'once', notified: false }]
          : [];
        file.items.push({
          id: createNodeId(),
          text,
          done: false,
          createdAt: new Date().toISOString(),
          due: input.due ?? null,
          priority: 'normal',
          reminders,
        });
      });
    },

    async toggleDone(nodePath, nodeId, itemId) {
      const root = resolveWorkspace();
      await mutateNode(root, nodePath, nodeId, (file) => {
        const item = file.items.find((i) => i.id === itemId);
        if (item) item.done = !item.done;
      });
    },

    async deleteTodo(nodePath, nodeId, itemId) {
      const root = resolveWorkspace();
      await mutateNode(root, nodePath, nodeId, (file) => {
        file.items = file.items.filter((i) => i.id !== itemId);
      });
    },

    async setDue(nodePath, nodeId, itemId, due) {
      const root = resolveWorkspace();
      await mutateNode(root, nodePath, nodeId, (file) => {
        const item = file.items.find((i) => i.id === itemId);
        if (item) item.due = due;
      });
    },

    async setReminder(nodePath, nodeId, itemId, fireAt, repeat) {
      const root = resolveWorkspace();
      // 新增提醒：提前申请系统通知权限（首次会弹授权框）。
      void notification.ensureNotificationPermission();
      await mutateNode(root, nodePath, nodeId, (file) => {
        const item = file.items.find((i) => i.id === itemId);
        if (!item) return;
        item.reminders.push({ id: createNodeId(), fireAt, repeat, notified: false });
      });
    },

    async removeReminder(nodePath, nodeId, itemId, reminderId) {
      const root = resolveWorkspace();
      await mutateNode(root, nodePath, nodeId, (file) => {
        const item = file.items.find((i) => i.id === itemId);
        if (item) item.reminders = item.reminders.filter((r) => r.id !== reminderId);
      });
    },
  };
});
