/**
 * shared/models/todo —— 待办域数据模型 + 注入端口（纯类型，零逻辑）。
 * 业务实现见 backend/domain/todos（磁盘读写）+ shared/utils/reminders（纯时间数学）。
 */
import type { Reminder, TodoItem } from "../contracts";

/** 写盘所需的最小文件 store（生产由 backend capabilities 适配；测试用内存/node:fs）。 */
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

/** 喂给 scanTodos 的节点定位信息（解耦 ScannedNode）。 */
export interface NodeRef {
  nodeId: string;
  nodePath: string;
}
