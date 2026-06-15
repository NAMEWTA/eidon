import {
  NodeTodoFileSchema,
  type NodeTodoFile,
  type Reminder,
  type TodoItem,
} from "../contracts";

/**
 * core/todos —— 节点级待办 + 定时提醒内核（公共出口）。
 *
 * 职责二分：
 *  1) 磁盘读写：每节点 `<nodePath>/.node/todos.json`（契约 `NodeTodoFileSchema`）。
 *  2) 纯计算：提醒下次触发时刻 / 到期筛选 / 最近一条 —— 全为纯函数，可在 Node 下单测。
 *
 * 框架无关：不 import 任何 UI/zustand；亦**不** import `core/nodes` 内部
 * （节点路径列表由 UI 层喂入，避免对万级文件做第二次全树遍历，见计划）。
 */

/** 写盘所需的最小文件 store（生产由 `core/bridge/file` 适配；测试用内存/`node:fs`）。 */
export interface TodoFileStore {
  readFile(relPath: string): Promise<string>;
  writeFile(relPath: string, contents: string): Promise<void>;
}

/** 摊平后的单条待办：附带所属节点身份与路径，供全局聚合面板与调度器使用。 */
export interface AggregatedTodo {
  nodeId: string;
  nodePath: string;
  item: TodoItem;
}

/** 到期待派发的提醒：扁平携带节点/待办上下文，供调度器派发通知。 */
export interface DueReminder {
  nodeId: string;
  nodePath: string;
  itemId: string;
  text: string;
  reminder: Reminder;
}

/** 喂给 scanTodos 的节点定位信息（解耦 `core/nodes` 的 ScannedNode）。 */
export interface NodeRef {
  nodeId: string;
  nodePath: string;
}

const normalizePath = (path: string): string =>
  path.replace(/\\/g, "/").split("/").filter(Boolean).join("/");

/** `<nodePath>/.node/todos.json` —— workspace 相对 POSIX 路径。 */
export const todosRelPath = (nodePath: string): string =>
  `${normalizePath(nodePath)}/.node/todos.json`;

const nowIso = (now?: Date): string => (now ?? new Date()).toISOString();

/** 空待办文件（缺文件/损坏/删缓存重建时的兜底，nodeId 由调用方按扫描结果提供）。 */
export const emptyTodoFile = (nodeId: string, now?: Date): NodeTodoFile => ({
  version: 1,
  nodeId,
  updatedAt: nowIso(now),
  items: [],
});

/**
 * 读取某节点的 `.node/todos.json`。
 * 缺文件/JSON 损坏/契约不符一律回退为空文件（与 node.json 的「非节点即 null」同范式），
 * 保证「删缓存 → 遍历 .node/ 100% 重建」不被单个坏文件中断。
 */
export const readNodeTodos = async (
  store: TodoFileStore,
  nodePath: string,
  nodeId: string,
): Promise<NodeTodoFile> => {
  try {
    const raw = await store.readFile(todosRelPath(nodePath));
    const parsed = NodeTodoFileSchema.safeParse(JSON.parse(raw));
    if (parsed.success) return parsed.data;
  } catch {
    // 缺文件/不可读/坏 JSON → 空
  }
  return emptyTodoFile(nodeId);
};

/** 校验并写回某节点的 `.node/todos.json`；每次写盘刷新 updatedAt。 */
export const writeNodeTodos = async (
  store: TodoFileStore,
  nodePath: string,
  file: NodeTodoFile,
  now?: Date,
): Promise<NodeTodoFile> => {
  const validated = NodeTodoFileSchema.parse({ ...file, updatedAt: nowIso(now) });
  await store.writeFile(todosRelPath(nodePath), JSON.stringify(validated, null, 2));
  return validated;
};

/** 批量读多节点 todos 并摊平（并行 IO）；缺待办文件的节点贡献 0 条。 */
export const scanTodos = async (
  store: TodoFileStore,
  nodes: NodeRef[],
): Promise<AggregatedTodo[]> => {
  const files = await Promise.all(
    nodes.map((n) => readNodeTodos(store, n.nodePath, n.nodeId)),
  );
  const out: AggregatedTodo[] = [];
  nodes.forEach((n, i) => {
    for (const item of files[i].items) {
      out.push({ nodeId: n.nodeId, nodePath: n.nodePath, item });
    }
  });
  return out;
};

// ——— 纯计算：提醒时间推演 ———

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
