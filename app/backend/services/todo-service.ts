/**
 * backend/services/todo-service —— 待办域编排（磁盘读写）。
 * 纯时间数学（collectDue/nextFireTime/earliestFireAt）在 shared/utils/reminders，由前端调度器同步运行。
 */
import type { NodeRef } from "@shared/models";
import type { NodeTodoFile } from "@shared/contracts";
import { readNodeTodos, scanTodos, writeNodeTodos } from "../domain/todos";
import { createWorkspaceStore } from "./workspace-store";

export const todoService = {
  scan: (workspace: string, nodes: NodeRef[]) =>
    scanTodos(createWorkspaceStore(workspace), nodes),

  readNode: (workspace: string, nodePath: string, nodeId: string) =>
    readNodeTodos(createWorkspaceStore(workspace), nodePath, nodeId),

  writeNode: (workspace: string, nodePath: string, file: NodeTodoFile) =>
    writeNodeTodos(createWorkspaceStore(workspace), nodePath, file),
};
