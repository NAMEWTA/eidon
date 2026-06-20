/**
 * bridge/ipc/snapshots —— 版本能力的便捷别名（薄封装 git:* 通道，见 ADR-0015）。
 * gitHistory store 从这里 import（与旧 core/snapshots 同名同签名）；底层固定为 Electron git 网关。
 */
import * as git from "./git";
import type { CommitMeta, DiffResult, PruneResult, WorkspaceStatus } from "@shared/models";

export type SnapshotWorkspaceStatus = WorkspaceStatus;
export type SnapshotCommitMeta = CommitMeta;
export type SnapshotDiffResult = DiffResult;
export type SnapshotPruneResult = PruneResult;

export const getSnapshotStatus = (folder: string) => git.workspaceStatus(folder);
export const initSnapshotHistory = (
  folder: string,
  input: { initialMessage?: string | null; excludeAssets?: boolean } = {},
) => git.initWorkspace(folder, input.initialMessage ?? null, input.excludeAssets ?? false);
export const commitSnapshot = (
  folder: string,
  input: { filePath?: string | null; message?: string | null } = {},
) => git.autoCommit(folder, input.filePath ?? null, input.message ?? null);
export const listFileSnapshots = (folder: string, filePath: string, limit = 50) =>
  git.fileHistory(folder, filePath, limit);
export const diffFileSnapshot = (folder: string, filePath: string, sha: string) =>
  git.fileDiff(folder, filePath, sha);
export const readFileSnapshot = (folder: string, filePath: string, sha: string) =>
  git.fileAtVersion(folder, filePath, sha);
export const restoreFileSnapshot = (folder: string, filePath: string, sha: string) =>
  git.rollbackFile(folder, filePath, sha);
export const getSnapshotRepoSize = (folder: string) => git.repoSize(folder);
export const pruneSnapshotHistory = (folder: string, maxCommits: number) =>
  git.pruneHistory(folder, maxCommits);
