/**
 * shared/models/git —— git/版本/会话域 wire 形状（camelCase）。
 * 迁移自旧 shared/ipc/types.ts，蛇形字段已统一为 camelCase（见 ADR-0025 / D7）。
 */

export interface WorkspaceStatus {
  initialized: boolean;
  headSha: string | null;
  headMessage: string | null;
  dirty: boolean;
  branch: string | null;
}

export interface CommitMeta {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  time: number;
}

export type DiffLineKind = "context" | "add" | "remove";

export interface DiffLine {
  kind: DiffLineKind;
  text: string;
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface DiffResult {
  fromSha: string | null;
  toSha: string;
  hunks: DiffHunk[];
  unified: string;
}

export interface PruneResult {
  commitsBefore: number;
  commitsAfter: number;
  sizeAfter: number;
  gcRan: boolean;
}

// 云文件夹检测的取值，与 stores/cloudSync 的 CloudProvider 字面量严格一致（值保持原样，仅字段名 camelCase）。
export type CloudProvider =
  | "none"
  | "icloud"
  | "dropbox"
  | "onedrive"
  | "google_drive";

export interface CloudFolderInfo {
  provider: CloudProvider;
  label: string;
}

export interface SessionTab {
  filePath: string | null;
  fileName: string;
  cursorLine: number | null;
  cursorCol: number | null;
  relPath: string | null;
}

export interface SessionPayload {
  deviceId: string;
  deviceLabel: string;
  savedAt: number;
  activeIndex: number;
  tabs: SessionTab[];
}

export interface SiblingSession {
  deviceId: string;
  deviceLabel: string;
  savedAt: number;
  tabCount: number;
}
