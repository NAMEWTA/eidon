/**
 * workspaceIndex store（Zustand v5；从 Pinia 1:1 迁移）。包裹 Rust
 * `workspace_index` Tauri 命令（经 core/bridge）。Wikilink/Backlink/Tags/Bases
 * 的唯一数据源。文件夹变化时重建索引；监听 `eidon://index-updated` 刷新缓存。
 */
import { create } from 'zustand';
import { invoke } from '../../core/bridge/tauri';
import { listen, type UnlistenFn } from '../../core/bridge/tauri';

export interface WikilinkRef {
  target: string;
  heading?: string | null;
  alias?: string | null;
  line: number;
}

export interface IndexEntry {
  path: string;
  name: string;
  stem: string;
  mtime: number;
  size: number;
  frontmatter: Record<string, unknown> | null;
  wikilinks: WikilinkRef[];
  tags: string[];
  headings: string[];
  summary: string;
  title?: string | null;
}

export interface BacklinkRef {
  from_path: string;
  from_name: string;
  line: number;
  context: string[];
}

export interface TagCount {
  tag: string;
  count: number;
  files: string[];
}

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
      await invoke<number>('workspace_index_init', { folder });
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
        invoke<IndexEntry[]>('workspace_index_files'),
        invoke<TagCount[]>('workspace_index_tags'),
      ]);
      set({ entries: files, tags });
    } catch {
      // Probably not initialized yet; quietly retry on next event.
    }
  },

  async resolve(name) {
    try {
      return await invoke<string | null>('workspace_index_resolve', { name });
    } catch {
      return null;
    }
  },

  async backlinksFor(target) {
    try {
      return await invoke<BacklinkRef[]>('workspace_index_backlinks', { target });
    } catch {
      return [];
    }
  },

  async rescan() {
    try {
      await invoke('workspace_index_rescan');
      await get().refresh();
    } catch (e) {
      set({ lastError: String(e) });
    }
  },
}));
