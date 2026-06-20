import { NodeTodoFileSchema, type NodeTodoFile } from "@shared/contracts";
import type { AggregatedTodo, NodeRef, TodoFileStore } from "@shared/models";

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


// 便捷再导出：待办域类型事实源在 @shared/models；提醒纯时间数学在 @shared/utils。
export type { AggregatedTodo, DueReminder, NodeRef, TodoFileStore } from "@shared/models";
export { collectDue, earliestFireAt, nextFireTime } from "@shared/utils";
