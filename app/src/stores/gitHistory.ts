import { create } from 'zustand';
import { listen, type UnlistenFn } from '../../core/bridge/tauri';
import {
  commitSnapshot,
  diffFileSnapshot,
  getSnapshotStatus,
  initSnapshotHistory,
  listFileSnapshots,
  readFileSnapshot,
  restoreFileSnapshot,
  type SnapshotCommitMeta,
  type SnapshotDiffResult,
  type SnapshotWorkspaceStatus,
} from '../../core/snapshots';

/**
 * gitHistory store（Zustand v5；从 Pinia 1:1 迁移）。缓存每文件夹 WorkspaceStatus，
 * 监听 `eidon://index-updated` 失效缓存。版本/diff/恢复经 `core/snapshots`
 * 薄封装现有 git bridge（ADR-0015）。
 */
export type WorkspaceStatus = SnapshotWorkspaceStatus;
export type CommitMeta = SnapshotCommitMeta;
export type DiffResult = SnapshotDiffResult;

interface State {
  folder: string | null;
  status: WorkspaceStatus | null;
  history: Record<string, CommitMeta[]>;
  loading: boolean;
  lastError: string | null;
}

interface Actions {
  isInitialized(): boolean;
  refreshStatus(folder: string | null): Promise<void>;
  init(folder: string, initialMessage?: string, excludeAssets?: boolean): Promise<void>;
  commit(folder: string, filePath?: string, message?: string): Promise<string | null>;
  historyFor(folder: string, filePath: string, limit?: number): Promise<CommitMeta[]>;
  diff(folder: string, filePath: string, sha: string): Promise<DiffResult | null>;
  fileAt(folder: string, filePath: string, sha: string): Promise<string | null>;
  rollback(folder: string, filePath: string, sha: string): Promise<void>;
}

let unlisten: UnlistenFn | null = null;

export const useGitHistoryStore = create<State & Actions>()((set, get) => ({
  folder: null,
  status: null,
  history: {},
  loading: false,
  lastError: null,

  isInitialized() {
    return get().status?.initialized === true;
  },

  async refreshStatus(folder) {
    if (!folder) {
      set({ folder: null, status: null });
      return;
    }
    set({ folder });
    try {
      set({ status: await getSnapshotStatus(folder) });
    } catch (e) {
      set({ lastError: String(e), status: null });
    }
    if (!unlisten) {
      try {
        unlisten = await listen('eidon://index-updated', () => {
          set({ history: {} });
          if (get().folder) get().refreshStatus(get().folder).catch(() => {});
        });
      } catch {
        /* ignore */
      }
    }
  },

  async init(folder, initialMessage, excludeAssets) {
    set({ loading: true });
    try {
      await initSnapshotHistory(folder, { initialMessage, excludeAssets });
      await get().refreshStatus(folder);
    } finally {
      set({ loading: false });
    }
  },

  async commit(folder, filePath, message) {
    try {
      const sha = await commitSnapshot(folder, { filePath, message });
      set({ history: {} });
      await get().refreshStatus(folder);
      return sha ?? null;
    } catch (e) {
      set({ lastError: String(e) });
      throw e;
    }
  },

  async historyFor(folder, filePath, limit = 50) {
    const key = filePath;
    const cached = get().history[key];
    if (cached) return cached;
    try {
      const list = await listFileSnapshots(folder, filePath, limit);
      set({ history: { ...get().history, [key]: list } });
      return list;
    } catch (e) {
      set({ lastError: String(e) });
      return [];
    }
  },

  async diff(folder, filePath, sha) {
    try {
      return await diffFileSnapshot(folder, filePath, sha);
    } catch (e) {
      set({ lastError: String(e) });
      return null;
    }
  },

  async fileAt(folder, filePath, sha) {
    try {
      return await readFileSnapshot(folder, filePath, sha);
    } catch (e) {
      set({ lastError: String(e) });
      return null;
    }
  },

  async rollback(folder, filePath, sha) {
    await restoreFileSnapshot(folder, filePath, sha);
    const { [filePath]: _drop, ...rest } = get().history;
    void _drop;
    set({ history: rest });
  },
}));
