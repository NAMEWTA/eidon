/**
 * bridge/ipc/todos —— 待办域 IPC 包装（磁盘读写经 backend；提醒纯数学在 @shared/utils）。
 */
import { eidonInvoke } from "./client";
import type { AggregatedTodo, NodeRef } from "@shared/models";
import type { NodeTodoFile } from "@shared/contracts";

export const todosBridge = {
  scan: (workspace: string, nodes: NodeRef[]): Promise<AggregatedTodo[]> =>
    eidonInvoke("todos:scan", { workspace, nodes }),
  readNode: (workspace: string, nodePath: string, nodeId: string): Promise<NodeTodoFile> =>
    eidonInvoke("todos:readNode", { workspace, nodePath, nodeId }),
  writeNode: (workspace: string, nodePath: string, file: NodeTodoFile): Promise<NodeTodoFile> =>
    eidonInvoke("todos:writeNode", { workspace, nodePath, file }),
};
