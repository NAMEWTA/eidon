/**
 * bridge/ipc/consistency —— 一致性域 IPC 包装（检测 + 一键迁移）。
 */
import { eidonInvoke } from "./client";
import type { ConsistencyReport, NormalizationResult } from "@shared/models";

export const consistencyBridge = {
  check: (workspace: string): Promise<ConsistencyReport> =>
    eidonInvoke("consistency:check", { workspace }),
  normalize: (workspace: string): Promise<NormalizationResult> =>
    eidonInvoke("consistency:normalize", { workspace }),
};
