/**
 * workspace store（Zustand v5）。
 * 持久化逻辑抽到 M1（lib/persistence/workspace.ts）。跨 store 调用 tabs 用
 * `useTabsStore.getState()`（call-time，规避静态 import 循环）。
 */
import { create } from 'zustand';
import { useTabsStore } from './tabs';
import {
  WORKSPACE_LS_KEY,
  loadWorkspace,
  serializeWorkspace,
  type WorkspaceData,
} from '../lib/persistence/workspace';

const MAX_RECENT = 12;
const MAX_RECENT_FOLDERS = 8;

interface WorkspaceActions {
  persist(): void;
  pushRecent(path: string): void;
  removeRecent(path: string): void;
  clearRecent(): void;
  setFolder(folder: string | null): void;
  removeRecentFolder(path: string): void;
  clearRecentFolders(): void;
}

export const useWorkspaceStore = create<WorkspaceData & WorkspaceActions>()((set, get) => ({
  ...loadWorkspace(typeof localStorage !== 'undefined' ? localStorage.getItem(WORKSPACE_LS_KEY) : null),

  persist() {
    try {
      localStorage.setItem(WORKSPACE_LS_KEY, serializeWorkspace(get()));
    } catch {}
  },
  pushRecent(path) {
    set({ recentFiles: [path, ...get().recentFiles.filter((p) => p !== path)].slice(0, MAX_RECENT) });
    get().persist();
  },
  removeRecent(path) {
    set({ recentFiles: get().recentFiles.filter((p) => p !== path) });
    get().persist();
  },
  clearRecent() {
    set({ recentFiles: [] });
    get().persist();
  },
  setFolder(folder) {
    const prev = get().currentFolder;
    // 先写 currentFolder，再（有 folder 时）更新最近文件夹 MRU。
    set({ currentFolder: folder });
    if (folder) {
      set({ recentFolders: [folder, ...get().recentFolders.filter((p) => p !== folder)].slice(0, MAX_RECENT_FOLDERS) });
    }
    // 先 persist，使 tabs store 写目标 bucket 时读到新的 currentFolder。
    get().persist();
    // 每工作区标签作用域：folder 真正变化时切换可见标签集（携带未保存/未命名标签）。
    if (folder !== prev) {
      try {
        useTabsStore.getState().onWorkspaceSwitched(prev, folder);
      } catch {}
    }
  },
  removeRecentFolder(path) {
    set({ recentFolders: get().recentFolders.filter((p) => p !== path) });
    get().persist();
  },
  clearRecentFolders() {
    set({ recentFolders: [] });
    get().persist();
  },
}));
