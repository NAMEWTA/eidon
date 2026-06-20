/**
 * backend/ipc/handlers/consistency.handlers.ts — 一致性域 IPC handler（薄层 → consistency-service）。
 */
import { consistencyService } from "../../services/consistency-service";
import type { IpcHandlers } from "../register";

export const consistencyHandlers: IpcHandlers = {
  "consistency:check": ({ workspace }) => consistencyService.check(workspace),
  "consistency:normalize": ({ workspace }) => consistencyService.normalize(workspace),
};
