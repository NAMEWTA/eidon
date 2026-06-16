import * as git from "../bridge/git";

/**
 * core/snapshots —— 版本能力归属薄封装（见 ADR-0015）。
 * 本期不实现私有快照系统，不建 `.eidon/snapshots.git`；这里只把现有 git 历史/diff/恢复能力
 * 收口为 EIDON 数据层公共 API，方便后续调用方不直接关心 Rust 命令名。
 */

export type SnapshotWorkspaceStatus = git.WorkspaceStatus;
export type SnapshotCommitMeta = git.CommitMeta;
export type SnapshotDiffResult = git.DiffResult;
export type SnapshotPruneResult = git.PruneResult;

export interface SnapshotGateway {
  workspaceStatus(folder: string): Promise<SnapshotWorkspaceStatus>;
  initWorkspace(folder: string, initialMessage?: string | null, excludeAssets?: boolean): Promise<void>;
  autoCommit(folder: string, filePath?: string | null, message?: string | null): Promise<string | null>;
  fileHistory(folder: string, filePath: string, limit?: number): Promise<SnapshotCommitMeta[]>;
  fileDiff(folder: string, filePath: string, sha: string): Promise<SnapshotDiffResult>;
  fileAtVersion(folder: string, filePath: string, sha: string): Promise<string>;
  rollbackFile(folder: string, filePath: string, sha: string): Promise<void>;
  repoSize(folder: string): Promise<number>;
  pruneHistory(folder: string, maxCommits: number): Promise<SnapshotPruneResult>;
}

const defaultGateway: SnapshotGateway = git;

export const getSnapshotStatus = (
  folder: string,
  gateway: SnapshotGateway = defaultGateway,
): Promise<SnapshotWorkspaceStatus> => gateway.workspaceStatus(folder);

export const initSnapshotHistory = (
  folder: string,
  input: { initialMessage?: string | null; excludeAssets?: boolean } = {},
  gateway: SnapshotGateway = defaultGateway,
): Promise<void> =>
  gateway.initWorkspace(folder, input.initialMessage ?? null, input.excludeAssets ?? false);

export const commitSnapshot = (
  folder: string,
  input: { filePath?: string | null; message?: string | null } = {},
  gateway: SnapshotGateway = defaultGateway,
): Promise<string | null> =>
  gateway.autoCommit(folder, input.filePath ?? null, input.message ?? null);

export const listFileSnapshots = (
  folder: string,
  filePath: string,
  limit = 50,
  gateway: SnapshotGateway = defaultGateway,
): Promise<SnapshotCommitMeta[]> => gateway.fileHistory(folder, filePath, limit);

export const diffFileSnapshot = (
  folder: string,
  filePath: string,
  sha: string,
  gateway: SnapshotGateway = defaultGateway,
): Promise<SnapshotDiffResult> => gateway.fileDiff(folder, filePath, sha);

export const readFileSnapshot = (
  folder: string,
  filePath: string,
  sha: string,
  gateway: SnapshotGateway = defaultGateway,
): Promise<string> => gateway.fileAtVersion(folder, filePath, sha);

export const restoreFileSnapshot = (
  folder: string,
  filePath: string,
  sha: string,
  gateway: SnapshotGateway = defaultGateway,
): Promise<void> => gateway.rollbackFile(folder, filePath, sha);

/** `.git` 体积（字节）。 */
export const getSnapshotRepoSize = (
  folder: string,
  gateway: SnapshotGateway = defaultGateway,
): Promise<number> => gateway.repoSize(folder);

/** 历史修剪：保留最近 maxCommits 个提交（破坏性，见 ADR-0023）。 */
export const pruneSnapshotHistory = (
  folder: string,
  maxCommits: number,
  gateway: SnapshotGateway = defaultGateway,
): Promise<SnapshotPruneResult> => gateway.pruneHistory(folder, maxCommits);
