/**
 * shared/domain/snapshots —— 版本能力归属薄封装（见 ADR-0015）。
 *
 * 不实现私有快照系统；把 git 历史/diff/恢复收口为 EIDON 数据层公共 API。
 * 网关由调用方注入：renderer 用 `src/ipc/git`（经 Electron IPC），main/pi-agent 可用 capabilities/git。
 * 框架无关、可单测（注入 mock 网关）。
 */
import type {
  WorkspaceStatus,
  CommitMeta,
  DiffResult,
  PruneResult,
} from "@shared/models";

export type SnapshotWorkspaceStatus = WorkspaceStatus;
export type SnapshotCommitMeta = CommitMeta;
export type SnapshotDiffResult = DiffResult;
export type SnapshotPruneResult = PruneResult;

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

export const getSnapshotStatus = (
  folder: string,
  gateway: SnapshotGateway,
): Promise<SnapshotWorkspaceStatus> => gateway.workspaceStatus(folder);

export const initSnapshotHistory = (
  folder: string,
  input: { initialMessage?: string | null; excludeAssets?: boolean },
  gateway: SnapshotGateway,
): Promise<void> =>
  gateway.initWorkspace(folder, input.initialMessage ?? null, input.excludeAssets ?? false);

export const commitSnapshot = (
  folder: string,
  input: { filePath?: string | null; message?: string | null },
  gateway: SnapshotGateway,
): Promise<string | null> =>
  gateway.autoCommit(folder, input.filePath ?? null, input.message ?? null);

export const listFileSnapshots = (
  folder: string,
  filePath: string,
  limit: number,
  gateway: SnapshotGateway,
): Promise<SnapshotCommitMeta[]> => gateway.fileHistory(folder, filePath, limit);

export const diffFileSnapshot = (
  folder: string,
  filePath: string,
  sha: string,
  gateway: SnapshotGateway,
): Promise<SnapshotDiffResult> => gateway.fileDiff(folder, filePath, sha);

export const readFileSnapshot = (
  folder: string,
  filePath: string,
  sha: string,
  gateway: SnapshotGateway,
): Promise<string> => gateway.fileAtVersion(folder, filePath, sha);

export const restoreFileSnapshot = (
  folder: string,
  filePath: string,
  sha: string,
  gateway: SnapshotGateway,
): Promise<void> => gateway.rollbackFile(folder, filePath, sha);

export const getSnapshotRepoSize = (
  folder: string,
  gateway: SnapshotGateway,
): Promise<number> => gateway.repoSize(folder);

export const pruneSnapshotHistory = (
  folder: string,
  maxCommits: number,
  gateway: SnapshotGateway,
): Promise<SnapshotPruneResult> => gateway.pruneHistory(folder, maxCommits);
