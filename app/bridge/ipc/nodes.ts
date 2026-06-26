/**
 * bridge/ipc/nodes —— 节点域 IPC 包装（前端经此调 backend，不再本地跑 domain，见 ADR-0025/D1）。
 */
import { eidonInvoke } from "./client";
import type {
  CreateNodeInput,
  MoveNodeInput,
  NodeMutationResult,
  PromoteFolderInput,
  RelocateNodeInput,
  RenameNodeInput,
  ScannedNode,
  UpdateNodeFieldsInput,
  UpgradeNodeSchemaInput,
} from "@shared/models";

export const nodesBridge = {
  scan: (workspace: string): Promise<ScannedNode[]> =>
    eidonInvoke("nodes:scan", { workspace }),
  create: (workspace: string, input: CreateNodeInput): Promise<NodeMutationResult> =>
    eidonInvoke("nodes:create", { workspace, ...input }),
  promote: (workspace: string, input: PromoteFolderInput): Promise<NodeMutationResult> =>
    eidonInvoke("nodes:promote", { workspace, ...input }),
  rename: (workspace: string, input: RenameNodeInput): Promise<NodeMutationResult> =>
    eidonInvoke("nodes:rename", { workspace, ...input }),
  move: (workspace: string, input: MoveNodeInput): Promise<NodeMutationResult> =>
    eidonInvoke("nodes:move", { workspace, ...input }),
  relocate: (workspace: string, input: RelocateNodeInput): Promise<{ path: string; strippedIdentity: boolean }> =>
    eidonInvoke("nodes:relocate", { workspace, ...input }),
  updateFields: (workspace: string, input: UpdateNodeFieldsInput): Promise<NodeMutationResult> =>
    eidonInvoke("nodes:updateFields", { workspace, ...input }),
  upgradeSchema: (workspace: string, input: UpgradeNodeSchemaInput): Promise<NodeMutationResult> =>
    eidonInvoke("nodes:upgradeSchema", { workspace, ...input }),
  ensureInbox: (workspace: string): Promise<string> =>
    eidonInvoke("nodes:ensureInbox", { workspace }),
  ensureCalendar: (workspace: string, date: Date): Promise<string> =>
    eidonInvoke("nodes:ensureCalendar", { workspace, date: date.toISOString() }),
};
