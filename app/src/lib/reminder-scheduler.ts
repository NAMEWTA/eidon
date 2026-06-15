/**
 * reminder-scheduler — 节点级待办的前端定时提醒调度器（单定时器，性能核心）。
 *
 * 设计要点（见 plan §4）：
 *  - **只挂一个 setTimeout**，指向「最近一条待派发提醒」（earliestFireAt），而非每条一个定时器、
 *    也非 1s 轮询 → O(1) 活动定时器，万级待办无压力。
 *  - 触发后由宿主（todos store）派发通知 + 滚动/标记该条，再 rearm 到下一条。
 *  - delay 封顶 setTimeout 上限（~24.8 天）：更远的提醒先挂一个「重新评估」定时器。
 *  - 监听 focus/visibilitychange：休眠唤醒后墙钟跳变即结算逾期（关窗期间错过的不在此补，由 store 启动时一次性处理）。
 *
 * 已知约束：无系统托盘、关窗即退出，故仅在应用运行时生效（见 ADR-0019 / plan「明确不做」）。
 */
import { collectDue, earliestFireAt, type AggregatedTodo, type DueReminder } from "../../core/todos";

// setTimeout 的 32 位上限：超过此 delay 必须分段，否则会立即（溢出为负）触发。
const MAX_DELAY = 2_147_483_647;

interface SchedulerDeps {
  /** 读取当前全量聚合待办（每次 rearm/fire 都取最新，不持快照）。 */
  getItems: () => AggregatedTodo[];
  /** 派发到期提醒（通知 + Toast + 宠物 + 写回磁盘标记），由 store 提供。 */
  onFire: (due: DueReminder[]) => void | Promise<void>;
}

let deps: SchedulerDeps | null = null;
let handle: ReturnType<typeof setTimeout> | null = null;
let listenersAttached = false;

const clearHandle = (): void => {
  if (handle !== null) {
    clearTimeout(handle);
    handle = null;
  }
};

const rearm = (): void => {
  clearHandle();
  if (!deps) return;
  const earliest = earliestFireAt(deps.getItems());
  if (earliest === null) return; // 无待派发提醒 → 不挂定时器
  const delay = Math.max(0, Math.min(earliest - Date.now(), MAX_DELAY));
  handle = setTimeout(fire, delay);
};

const fire = async (): Promise<void> => {
  if (!deps) return;
  const due = collectDue(deps.getItems(), new Date());
  // delay 被封顶/被 focus 唤醒提前触发时 due 可能为空 → 跳过派发，仅重排。
  if (due.length > 0) {
    try {
      await deps.onFire(due);
    } catch {
      // 派发失败不应中断调度；下一轮仍会重试到期项（未标记 notified）。
    }
  }
  rearm();
};

/** 启动/重置调度器：注入依赖、（首次）挂窗口监听、立即按当前待办重排。 */
export const initReminderScheduler = (next: SchedulerDeps): void => {
  deps = next;
  if (!listenersAttached && typeof window !== "undefined") {
    // 唤醒/切回前台时墙钟可能已跨过若干提醒：重排即把已逾期者钳为立即触发。
    window.addEventListener("focus", rearm);
    document.addEventListener("visibilitychange", rearm);
    listenersAttached = true;
  }
  rearm();
};

/** 待办增删改后由 store 调用，按最新状态重排单定时器。 */
export const rescheduleReminders = (): void => {
  rearm();
};

/** 关闭工作区/卸载时清理（测试与热重载友好）。 */
export const disposeReminderScheduler = (): void => {
  clearHandle();
  if (listenersAttached && typeof window !== "undefined") {
    window.removeEventListener("focus", rearm);
    document.removeEventListener("visibilitychange", rearm);
    listenersAttached = false;
  }
  deps = null;
};
