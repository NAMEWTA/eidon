import { invoke } from "@tauri-apps/api/core";

export const hasDirtyChanges = (workspace: string): Promise<boolean> =>
  invoke("git_has_dirty_changes", { workspace });

export const createBranch = (
  workspace: string,
  branch: string,
): Promise<void> => invoke("git_create_branch", { workspace, branch });

export interface WorkspaceStatus {
  initialized: boolean;
  head_sha: string | null;
  head_message: string | null;
  dirty: boolean;
  branch: string | null;
}

export interface CommitMeta {
  sha: string;
  short_sha: string;
  message: string;
  author: string;
  time: number;
}

export interface DiffLine {
  kind: "context" | "add" | "remove";
  text: string;
}

export interface DiffHunk {
  old_start: number;
  old_lines: number;
  new_start: number;
  new_lines: number;
  lines: DiffLine[];
}

export interface DiffResult {
  from_sha: string | null;
  to_sha: string;
  hunks: DiffHunk[];
  unified: string;
}

export const workspaceStatus = (folder: string): Promise<WorkspaceStatus> =>
  invoke("git_workspace_status", { folder });

export const initWorkspace = (
  folder: string,
  initialMessage?: string | null,
  excludeAssets?: boolean,
): Promise<void> =>
  invoke("git_init_workspace", {
    folder,
    initialMessage: initialMessage ?? null,
    excludeAssets: excludeAssets ?? false,
  });

export const autoCommit = (
  folder: string,
  filePath?: string | null,
  message?: string | null,
): Promise<string | null> =>
  invoke("git_auto_commit", {
    folder,
    filePath: filePath ?? null,
    message: message ?? null,
  });

export const fileHistory = (
  folder: string,
  filePath: string,
  limit = 50,
): Promise<CommitMeta[]> =>
  invoke("git_file_history", { folder, filePath, limit });

export const fileDiff = (
  folder: string,
  filePath: string,
  sha: string,
): Promise<DiffResult> =>
  invoke("git_file_diff", { folder, filePath, sha });

export const fileAtVersion = (
  folder: string,
  filePath: string,
  sha: string,
): Promise<string> =>
  invoke("git_file_at_version", { folder, filePath, sha });

export const rollbackFile = (
  folder: string,
  filePath: string,
  sha: string,
): Promise<void> =>
  invoke("git_rollback_file", { folder, filePath, sha });
