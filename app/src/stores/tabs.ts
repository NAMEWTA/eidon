/**
 * tabs store（Zustand v5；从 Pinia `defineStore('tabs')` 1:1 迁移）。
 *
 * 持久化/作用域逻辑（按工作区分桶、会话恢复、旧全局 blob 迁移）逐字保留。
 * 跨 store 直读别的 store 的原始 localStorage blob（settings / workspace）的
 * 反模式按计划**暂留**（见 [[cross-store-localstorage-techdebt]]，迁移完成后另行清算）。
 * 跨 store 方法调用统一用 `useXStore.getState()`。
 */
import { create } from 'zustand';
import type { Language, Tab } from '../types';
import { useSettingsStore } from './settings';
import { useTilesStore } from './tiles';
import { useWritingSessionStore } from './writingSession';
import { stampGoalSetAtIfMissing } from '../lib/writing-goals';
import { initialMarkdownContent } from '../lib/frontmatter';

// Legacy / global key（per-workspace 关时使用，也是首次升级的迁移源）。
const LS_KEY = 'eidon.tabs.v1';
const LS_BUCKET_PREFIX = 'eidon.tabs.v1::';
const NO_WORKSPACE = '__none__';

let nextId = 1;
const newId = () => `tab-${Date.now()}-${nextId++}`;

function inferLanguage(name: string): Language {
  const lower = name.toLowerCase();
  if (/\.(md|markdown|mdown|mkd)$/.test(lower)) return 'markdown';
  return 'plaintext';
}

interface PersistedState {
  tabs: Tab[];
  activeId: string;
}

/** 直读 settings blob 的 restoreSession（store 尚未 hydrate 前也可用）。 */
function restoreSessionEnabled(): boolean {
  try {
    const raw = localStorage.getItem('eidon.settings.v1');
    if (raw) {
      const s = JSON.parse(raw);
      if (s && typeof s.restoreSession === 'boolean') return s.restoreSession;
    }
  } catch {}
  return true;
}

/** 直读 settings blob 的 perWorkspaceTabs（默认 ON）。 */
function perWorkspaceTabsEnabled(): boolean {
  try {
    const raw = localStorage.getItem('eidon.settings.v1');
    if (raw) {
      const s = JSON.parse(raw);
      if (s && typeof s.perWorkspaceTabs === 'boolean') return s.perWorkspaceTabs;
    }
  } catch {}
  return true;
}

/** 直读 workspace blob 的 currentFolder（规避静态 import 循环，且 init 时可用）。 */
function currentWorkspaceFolder(): string | null {
  try {
    const raw = localStorage.getItem('eidon.workspace.v1');
    if (raw) {
      const w = JSON.parse(raw);
      if (w && typeof w.currentFolder === 'string') return w.currentFolder;
    }
  } catch {}
  return null;
}

function bucketKey(folder: string | null): string {
  if (!perWorkspaceTabsEnabled()) return LS_KEY;
  return LS_BUCKET_PREFIX + (folder || NO_WORKSPACE);
}

function isDirty(t: Tab): boolean {
  return t.content !== t.savedContent;
}

function inFolder(filePath: string | undefined, folder: string | null): boolean {
  if (!filePath || !folder) return false;
  const norm = (s: string) => s.replace(/\\/g, '/').replace(/\/+$/, '');
  const root = norm(folder);
  const fp = norm(filePath);
  const ci = /^[a-zA-Z]:\//.test(root);
  const r = ci ? root.toLowerCase() : root;
  const f = ci ? fp.toLowerCase() : fp;
  return f === r || f.startsWith(r + '/');
}

function readBucket(key: string): PersistedState | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const data = JSON.parse(raw) as PersistedState;
      if (Array.isArray(data.tabs)) return { tabs: data.tabs, activeId: data.activeId || '' };
    }
  } catch {}
  return null;
}

function loadPersisted(): PersistedState {
  if (!restoreSessionEnabled()) return { tabs: [], activeId: '' };
  if (!perWorkspaceTabsEnabled()) {
    return readBucket(LS_KEY) ?? { tabs: [], activeId: '' };
  }
  const folder = currentWorkspaceFolder();
  const bucket = readBucket(bucketKey(folder));
  if (bucket) return bucket;
  // 升级后首次：该工作区还没有桶。把旧全局列表 scope 到当前文件夹（外加 untitled/dirty）。
  const legacy = readBucket(LS_KEY);
  if (legacy) {
    const scoped = legacy.tabs.filter(
      (t) => !t.filePath || inFolder(t.filePath, folder) || isDirty(t),
    );
    const activeKept = scoped.some((t) => t.id === legacy.activeId);
    return { tabs: scoped, activeId: activeKept ? legacy.activeId : scoped[0]?.id ?? '' };
  }
  return { tabs: [], activeId: '' };
}

interface TabsActions {
  // getters → 方法
  activeTab(): Tab | undefined;
  isDirty(id: string): boolean;
  // actions
  newTab(opts?: { fileName?: string; language?: Language }): Tab;
  openFromDisk(payload: {
    filePath: string;
    content: string;
    encoding: string;
    language: Language;
    hadBom: boolean;
  }): Tab;
  openAssetFromDisk(payload: {
    filePath: string;
    kind: Exclude<NonNullable<Tab['kind']>, 'text'>;
  }): Tab;
  setContent(id: string, content: string): void;
  markSaved(id: string, filePath: string): void;
  closeTab(id: string): void;
  activate(id: string): void;
  reorder(tabId: string, intendedIndex: number): void;
  toggleOutline(id: string): void;
  setShowOutlineAll(value: boolean): void;
  persist(): void;
  persistToFolder(folder: string | null): void;
  onWorkspaceSwitched(prevFolder: string | null, newFolder: string | null): void;
}

export const useTabsStore = create<PersistedState & TabsActions>()((set, get) => ({
  ...loadPersisted(),

  activeTab() {
    return get().tabs.find((t) => t.id === get().activeId);
  },
  isDirty(id) {
    const t = get().tabs.find((x) => x.id === id);
    return !!t && t.content !== t.savedContent;
  },

  newTab(opts) {
    const fileName = opts?.fileName ?? 'Untitled.md';
    const language = opts?.language ?? inferLanguage(fileName);
    // 新建 Markdown 文件自动初始化 frontmatter（创建时间 + 更新时间精确到秒）。
    const content = language === 'markdown' ? initialMarkdownContent() : '';
    const tab: Tab = {
      id: newId(),
      kind: 'text',
      fileName,
      content,
      savedContent: '',
      encoding: 'UTF-8',
      language,
      hadBom: false,
      showOutline: language === 'markdown',
    };
    set({ tabs: [...get().tabs, tab], activeId: tab.id });
    return tab;
  },

  openFromDisk(payload) {
    const existing = get().tabs.find((t) => t.filePath === payload.filePath);
    if (existing) {
      set({ activeId: existing.id });
      return existing;
    }
    const fileName = payload.filePath.split(/[\\/]/).pop() ?? 'Untitled';
    // 与 CodeMirror 创建 doc 时的 \r\n → \n 归一化保持同步（否则打开 Windows 文件即被判脏）。
    const lineEnding: 'lf' | 'crlf' = payload.content.includes('\r\n') ? 'crlf' : 'lf';
    const normalized = lineEnding === 'crlf' ? payload.content.replace(/\r\n/g, '\n') : payload.content;
    const tab: Tab = {
      id: newId(),
      kind: 'text',
      filePath: payload.filePath,
      fileName,
      content: normalized,
      savedContent: normalized,
      encoding: payload.encoding,
      language: payload.language,
      hadBom: payload.hadBom,
      lineEnding,
      showOutline: payload.language === 'markdown',
    };
    set({ tabs: [...get().tabs, tab], activeId: tab.id });
    return tab;
  },

  openAssetFromDisk(payload) {
    const existing = get().tabs.find((t) => t.filePath === payload.filePath);
    if (existing) {
      set({ activeId: existing.id });
      return existing;
    }
    const fileName = payload.filePath.split(/[\\/]/).pop() ?? 'Untitled';
    const tab: Tab = {
      id: newId(),
      kind: payload.kind,
      filePath: payload.filePath,
      fileName,
      content: '',
      savedContent: '',
      encoding: '',
      language: 'plaintext',
      hadBom: false,
      showOutline: false,
    };
    set({ tabs: [...get().tabs, tab], activeId: tab.id });
    return tab;
  },

  setContent(id, content) {
    set({ tabs: get().tabs.map((t) => (t.id === id ? { ...t, content } : t)) });
  },

  markSaved(id, filePath) {
    const t = get().tabs.find((x) => x.id === id);
    if (!t) return;
    const fileName = filePath.split(/[\\/]/).pop() ?? t.fileName;
    // v2.5 — 首存带 goal 的文档时自动打 goal_set_at 戳（幂等）。
    let content = t.content;
    const stamped = stampGoalSetAtIfMissing(content);
    if (stamped !== content) content = stamped;
    const savedContent = content;
    const language = inferLanguage(fileName);
    set({
      tabs: get().tabs.map((x) =>
        x.id === id ? { ...x, filePath, fileName, content, savedContent, language, showOutline: language === 'markdown' ? (x.showOutline ?? true) : false } : x,
      ),
    });
    // v2.5 — 把「saved」锚点推进 writing-session store。
    try {
      const ws = useWritingSessionStore.getState();
      ws.markSaved(filePath, ws.sessionForPath(filePath)?.current ?? 0);
    } catch {}
  },

  closeTab(id) {
    const tabs = get().tabs;
    const idx = tabs.findIndex((t) => t.id === id);
    if (idx === -1) return;
    const closed = tabs[idx];
    const newTabs = [...tabs.slice(0, idx), ...tabs.slice(idx + 1)];
    let activeId = get().activeId;
    if (activeId === id) {
      activeId = newTabs[idx]?.id ?? newTabs[idx - 1]?.id ?? '';
    }
    set({ tabs: newTabs, activeId });
    // 清理窗格对已关闭标签的引用。
    try {
      useTilesStore.getState().removePaneReferences(id);
    } catch {}
    // v2.5 — 丢弃该文档的 writing-session 锚点。
    try {
      const ws = useWritingSessionStore.getState();
      const key = closed?.filePath || closed?.id;
      if (key) ws.closePath(key);
    } catch {}
    if (get().tabs.length === 0) get().newTab();
  },

  activate(id) {
    set({ activeId: id });
  },

  reorder(tabId, intendedIndex) {
    const tabs = [...get().tabs];
    const fromIdx = tabs.findIndex((t) => t.id === tabId);
    if (fromIdx < 0) return;
    const adjusted = fromIdx < intendedIndex ? intendedIndex - 1 : intendedIndex;
    const [moved] = tabs.splice(fromIdx, 1);
    const target = Math.max(0, Math.min(adjusted, tabs.length));
    if (target === fromIdx) {
      tabs.splice(fromIdx, 0, moved);
      set({ tabs });
      return;
    }
    tabs.splice(target, 0, moved);
    set({ tabs });
  },

  toggleOutline(id) {
    set({ tabs: get().tabs.map((t) => (t.id === id ? { ...t, showOutline: !t.showOutline } : t)) });
  },

  setShowOutlineAll(value) {
    set({
      tabs: get().tabs.map((t) => (t.language === 'markdown' ? { ...t, showOutline: value } : t)),
    });
  },

  persist() {
    try {
      localStorage.setItem(
        bucketKey(currentWorkspaceFolder()),
        JSON.stringify({ tabs: get().tabs, activeId: get().activeId }),
      );
    } catch {}
  },

  persistToFolder(folder) {
    if (!perWorkspaceTabsEnabled()) {
      get().persist();
      return;
    }
    try {
      localStorage.setItem(
        bucketKey(folder),
        JSON.stringify({ tabs: get().tabs, activeId: get().activeId }),
      );
    } catch {}
  },

  onWorkspaceSwitched(prevFolder, newFolder) {
    const settings = useSettingsStore.getState();
    if (!settings.perWorkspaceTabs) return;
    // 记住即将离开的工作区里打开的标签。
    get().persistToFolder(prevFolder);
    // 必须跟随用户的标签：任何有未保存内容（dirty / 有内容的 untitled）的标签。
    const carried = get().tabs.filter((t) => isDirty(t));
    const restored = settings.restoreSession
      ? readBucket(bucketKey(newFolder)) ?? { tabs: [], activeId: '' }
      : { tabs: [], activeId: '' };
    const seenPaths = new Set<string>();
    const seenIds = new Set<string>();
    const merged: Tab[] = [];
    const push = (t: Tab) => {
      if (seenIds.has(t.id)) return;
      if (t.filePath && seenPaths.has(t.filePath)) return;
      seenIds.add(t.id);
      if (t.filePath) seenPaths.add(t.filePath);
      merged.push(t);
    };
    // 携带的标签优先（持有实时、可能未保存的内容）。
    carried.forEach(push);
    restored.tabs.forEach(push);
    const removed = get().tabs.filter((t) => !merged.some((m) => m.id === t.id));
    // 选活动标签：优先恢复桶的 active，否则保留当前（若存活），再否则第一个。
    let activeId = get().activeId;
    const ids = new Set(merged.map((t) => t.id));
    if (restored.activeId && ids.has(restored.activeId)) {
      activeId = restored.activeId;
    } else if (!ids.has(activeId)) {
      activeId = merged[0]?.id ?? '';
    }
    set({ tabs: merged, activeId });
    // 丢弃对已不再打开标签的窗格引用，再保证至少一个标签存在。
    try {
      const tiles = useTilesStore.getState();
      for (const t of removed) tiles.removePaneReferences(t.id);
      tiles.validate(get().tabs);
    } catch {}
    if (get().tabs.length === 0) get().newTab();
    get().persist();
  },
}));
