/**
 * workspaceIndex store（Zustand v5）。包裹
 * workspace 索引（经 bridge）。Wikilink/Backlink/Tags/Bases
 * 的唯一数据源。文件夹变化时重建索引；监听 `eidon://index-updated` 刷新缓存。
 */
import { create } from 'zustand';
import { eidonInvoke } from '@bridge/ipc';
import { listen, type UnlistenFn } from '@bridge/ipc/platform';

// wire 形状事实源在 @shared/models；此处再导出供消费组件以 store 单点 import。
export type { WikilinkRef, IndexEntry, BacklinkRef, TagCount } from '@shared/models';
import type { IndexEntry, TagCount, BacklinkRef } from '@shared/models';

interface State {
  folder: string | null;
  ready: boolean;
  entries: IndexEntry[];
  tags: TagCount[];
  lastError: string | null;
}

interface Actions {
  // getters → 方法
  byStem(): Map<string, IndexEntry>;
  byPath(): Map<string, IndexEntry>;
  // actions
  setFolder(folder: string | null): Promise<void>;
  refresh(): Promise<void>;
  resolve(name: string): Promise<string | null>;
  backlinksFor(target: string): Promise<BacklinkRef[]>;
  rescan(): Promise<void>;
}

let unlistenIndex: UnlistenFn | null = null;

export const useWorkspaceIndexStore = create<State & Actions>()((set, get) => ({
  folder: null,
  ready: false,
  entries: [],
  tags: [],
  lastError: null,

  byStem() {
    const m = new Map<string, IndexEntry>();
    for (const e of get().entries) m.set(e.stem.toLowerCase(), e);
    return m;
  },
  byPath() {
    const m = new Map<string, IndexEntry>();
    for (const e of get().entries) m.set(e.path, e);
    return m;
  },

  async setFolder(folder) {
    if (folder === get().folder) return;
    set({ folder, ready: false, entries: [], tags: [] });
    if (!folder) return;
    try {
      await eidonInvoke('kn:indexInit', { workspace: folder });
      await get().refresh();
      if (!unlistenIndex) {
        unlistenIndex = await listen('eidon://index-updated', () => {
          get().refresh().catch(() => {});
        });
      }
      set({ ready: true });
    } catch (e) {
      set({ lastError: String(e) });
      console.warn('workspace_index_init failed', e);
    }
  },

  async refresh() {
    try {
      const [files, tags] = await Promise.all([
        eidonInvoke('kn:indexFiles', {}),
        eidonInvoke('kn:tags', {}),
      ]);
      set({ entries: files, tags });
    } catch {
      // Probably not initialized yet; quietly retry on next event.
    }
  },

  async resolve(name) {
    try {
      return await eidonInvoke('kn:resolve', { name });
    } catch {
      return null;
    }
  },

  async backlinksFor(target) {
    try {
      return await eidonInvoke('kn:backlinks', { target });
    } catch {
      return [];
    }
  },

  async rescan() {
    try {
      await eidonInvoke('kn:rescan', {});
      await get().refresh();
    } catch (e) {
      set({ lastError: String(e) });
    }
  },
}));
