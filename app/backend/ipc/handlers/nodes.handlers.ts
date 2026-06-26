/**
 * backend/ipc/handlers/nodes.handlers.ts — 节点域 IPC handler（薄层：解构 req → 调 node-service）。
 * 业务规则在 backend/domain/nodes，编排在 backend/services/node-service；磁盘结果由 domain 过契约。
 */
import { nodeService } from "../../services/node-service";
import type { IpcHandlers } from "../register";

export const nodesHandlers: IpcHandlers = {
  "nodes:scan": ({ workspace }) => nodeService.scan(workspace),
  "nodes:create": ({ workspace, ...input }) => nodeService.create(workspace, input),
  "nodes:promote": ({ workspace, ...input }) => nodeService.promote(workspace, input),
  "nodes:rename": ({ workspace, ...input }) => nodeService.rename(workspace, input),
  "nodes:move": ({ workspace, ...input }) => nodeService.move(workspace, input),
  "nodes:relocate": ({ workspace, ...input }) => nodeService.relocate(workspace, input),
  "nodes:updateFields": ({ workspace, ...input }) => nodeService.updateFields(workspace, input),
  "nodes:upgradeSchema": ({ workspace, ...input }) => nodeService.upgradeSchema(workspace, input),
  "nodes:ensureInbox": ({ workspace }) => nodeService.ensureInbox(workspace),
  "nodes:ensureCalendar": ({ workspace, date }) => nodeService.ensureCalendar(workspace, new Date(date)),
};
