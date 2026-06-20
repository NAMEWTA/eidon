/**
 * M1 · workspace 持久化域。`eidon.workspace.v1`。
 * 逐字保真复刻既有 `stores/workspace.ts` 的 load/persist（最近文件/文件夹、当前文件夹）。
 */
import type { PersistedCodec } from './index';

export const WORKSPACE_LS_KEY = 'eidon.workspace.v1';

export interface WorkspaceData {
  recentFiles: string[];
  recentFolders: string[];
  currentFolder: string | null;
}

export function defaultWorkspace(): WorkspaceData {
  return { recentFiles: [], recentFolders: [], currentFolder: null };
}

export function loadWorkspace(raw: string | null): WorkspaceData {
  try {
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<WorkspaceData>;
      return {
        recentFiles: Array.isArray(parsed.recentFiles) ? parsed.recentFiles : [],
        recentFolders: Array.isArray(parsed.recentFolders) ? parsed.recentFolders : [],
        currentFolder: typeof parsed.currentFolder === 'string' ? parsed.currentFolder : null,
      };
    }
  } catch {}
  return defaultWorkspace();
}

export function serializeWorkspace(s: WorkspaceData): string {
  return JSON.stringify({
    recentFiles: s.recentFiles,
    recentFolders: s.recentFolders,
    currentFolder: s.currentFolder,
  });
}

export const workspaceCodec: PersistedCodec<WorkspaceData> = {
  key: WORKSPACE_LS_KEY,
  load: loadWorkspace,
  serialize: serializeWorkspace,
};
