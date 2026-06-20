/**
 * git 网关。
 *
 * 形状与旧 bridge/git 完全一致（函数名/签名/返回类型），故 snapshots 与分支调用点零改动。
 * 类型统一来自 @shared/ipc（wire 单一事实源）。
 */
import { eidonInvoke } from "./client";
import type {
  WorkspaceStatus,
  CommitMeta,
  DiffResult,
  DiffLine,
  DiffHunk,
  PruneResult,
} from "@shared/models";

export type { WorkspaceStatus, CommitMeta, DiffResult, DiffLine, DiffHunk, PruneResult };

export const hasDirtyChanges = (workspace: string): Promise<boolean> =>
  eidonInvoke("git:dirty", { workspace });

export const createBranch = (workspace: string, branch: string): Promise<void> =>
  eidonInvoke("git:createBranch", { workspace, branch });

export const workspaceStatus = (folder: string): Promise<WorkspaceStatus> =>
  eidonInvoke("git:status", { folder });

export const initWorkspace = (
  folder: string,
  initialMessage?: string | null,
  excludeAssets?: boolean,
): Promise<void> =>
  eidonInvoke("git:init", {
    folder,
    initialMessage: initialMessage ?? null,
    excludeAssets: excludeAssets ?? false,
  });

export const autoCommit = (
  folder: string,
  filePath?: string | null,
  message?: string | null,
): Promise<string | null> =>
  eidonInvoke("git:autoCommit", {
    folder,
    filePath: filePath ?? null,
    message: message ?? null,
  });

export const fileHistory = (
  folder: string,
  filePath: string,
  limit = 50,
): Promise<CommitMeta[]> => eidonInvoke("git:fileHistory", { folder, filePath, limit });

export const fileDiff = (folder: string, filePath: string, sha: string): Promise<DiffResult> =>
  eidonInvoke("git:fileDiff", { folder, filePath, sha });

export const fileAtVersion = (folder: string, filePath: string, sha: string): Promise<string> =>
  eidonInvoke("git:fileAtVersion", { folder, filePath, sha });

export const rollbackFile = (folder: string, filePath: string, sha: string): Promise<void> =>
  eidonInvoke("git:rollbackFile", { folder, filePath, sha });

export const repoSize = (folder: string): Promise<number> =>
  eidonInvoke("git:repoSize", { folder });

export const pruneHistory = (folder: string, maxCommits: number): Promise<PruneResult> =>
  eidonInvoke("git:pruneHistory", { folder, maxCommits });

// 分支辅助（HistoryPanel/一致性可能用到）。
export const checkout = (workspace: string, branch: string): Promise<string> =>
  eidonInvoke("git:checkout", { workspace, branch });

export const restoreHead = (workspace: string, branch: string): Promise<void> =>
  eidonInvoke("git:restoreHead", { workspace, branch });

export const deleteBranch = (workspace: string, branch: string): Promise<void> =>
  eidonInvoke("git:deleteBranch", { workspace, branch });
