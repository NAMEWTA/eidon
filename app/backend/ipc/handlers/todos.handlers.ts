/**
 * backend/ipc/handlers/todos.handlers.ts — 待办域 IPC handler（薄层 → todo-service）。
 */
import { todoService } from "../../services/todo-service";
import type { IpcHandlers } from "../register";

export const todosHandlers: IpcHandlers = {
  "todos:scan": ({ workspace, nodes }) => todoService.scan(workspace, nodes),
  "todos:readNode": ({ workspace, nodePath, nodeId }) =>
    todoService.readNode(workspace, nodePath, nodeId),
  "todos:writeNode": ({ workspace, nodePath, file }) =>
    todoService.writeNode(workspace, nodePath, file),
};
