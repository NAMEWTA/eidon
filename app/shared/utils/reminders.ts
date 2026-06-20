/**
 * shared/utils/reminders —— 节点级待办的提醒时间数学（纯函数，无 I/O）。
 * 两端共用：frontend 调度器（reminder-scheduler 单定时器 + 关窗期结算）同步运算；
 * backend/domain/todos 复用同一推演，保证前后端一致。磁盘读写见 backend/domain/todos。
 */
import type { Reminder, TodoItem } from "../contracts";
import type { AggregatedTodo, DueReminder } from "../models";

/** 加月（保留日序，跨月溢出钳到目标月最后一日，如 1/31 + 1 月 → 2/28）。 */
const addMonths = (date: Date, n: number): Date => {
  const r = new Date(date.getTime());
  const day = r.getDate();
  r.setDate(1);
  r.setMonth(r.getMonth() + n);
  const lastDay = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
  r.setDate(Math.min(day, lastDay));
  return r;
};

// 按本地墙钟推进一个周期（用本地 get/setDate 而非 +24h：跨夏令时仍保持同一墙钟时刻）。
const advance = (date: Date, repeat: Reminder["repeat"]): Date => {
  const r = new Date(date.getTime());
  switch (repeat) {
    case "daily":
      r.setDate(r.getDate() + 1);
      return r;
    case "weekly":
      r.setDate(r.getDate() + 7);
      return r;
    case "monthly":
      return addMonths(r, 1);
    case "once":
      return r;
  }
};

/**
 * 重复提醒触发后的下次触发时刻（ISO）：从 fireAt 起按周期推进，直到**严格晚于** now。
 * once → null（无下次）。应用长时间关闭后跳过中间已错过的周期，只取下一个未来时刻。
 */
export const nextFireTime = (reminder: Reminder, now: Date): string | null => {
  if (reminder.repeat === "once") return null;
  const nowMs = now.getTime();
  let d = new Date(reminder.fireAt);
  // guard：极端跨度（如关闭数年的每日提醒）下封顶迭代，避免病态循环。
  for (let i = 0; i < 100000 && d.getTime() <= nowMs; i++) {
    d = advance(d, reminder.repeat);
  }
  return d.toISOString();
};

/** 提醒是否处于「待派发」：所属待办未完成 + 该次未通知。 */
const isPending = (item: TodoItem, reminder: Reminder): boolean =>
  !item.done && !reminder.notified;

/**
 * 收集到期（fireAt <= now）且待派发的提醒，扁平携带节点上下文。
 * 调度器据此立即派发通知，再把每条按 nextFireTime 滚动/标记已通知后写回。
 */
export const collectDue = (aggregated: AggregatedTodo[], now: Date): DueReminder[] => {
  const nowMs = now.getTime();
  const due: DueReminder[] = [];
  for (const a of aggregated) {
    for (const reminder of a.item.reminders) {
      if (isPending(a.item, reminder) && new Date(reminder.fireAt).getTime() <= nowMs) {
        due.push({
          nodeId: a.nodeId,
          nodePath: a.nodePath,
          itemId: a.item.id,
          text: a.item.text,
          reminder,
        });
      }
    }
  }
  return due;
};

/**
 * 最近一条待派发提醒的触发毫秒时间戳（用于调度器只挂一个 setTimeout）。
 * 含已逾期者（其值 <= now，调度器按 max(0, …) 钳为立即触发）。无待派发 → null。
 */
export const earliestFireAt = (
  aggregated: AggregatedTodo[],
  _now?: Date,
): number | null => {
  let min: number | null = null;
  for (const a of aggregated) {
    for (const reminder of a.item.reminders) {
      if (!isPending(a.item, reminder)) continue;
      const ms = new Date(reminder.fireAt).getTime();
      if (min === null || ms < min) min = ms;
    }
  }
  return min;
};
