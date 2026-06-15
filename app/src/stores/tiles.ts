/**
 * tiles store（Zustand v5；从 Pinia `defineStore('tiles')` 1:1 迁移）。
 *
 * 窗格平铺树（leaf/branch）、分屏、聚焦、拖拽分隔、每窗格独立标签。纯树操作
 * 保留为模块级纯函数。会话恢复读 `eidon.tiles.v1`；持久化仅 root + focusedPaneId。
 * 跨 store 同步活动标签直接写 tabs：`useTabsStore.setState({ activeId })`（与 Vue 版
 * 直接赋值 `tabs.activeId` 等价，均不触发 tabs 持久化）。
 */
import { create } from 'zustand';
import type { SplitDirection, TileBranch, TileLeaf, TileNode } from '../types';
import { useTabsStore } from './tabs';

const LS_KEY = 'eidon.tiles.v1';

let nextPaneId = 0;
const newPaneId = () => `pane-${Date.now()}-${nextPaneId++}`;
const newBranchId = () => `branch-${Date.now()}-${nextPaneId++}`;

interface PersistedState {
  root: TileNode;
  focusedPaneId: string;
}

// 瞬态（不持久化）：指针拖拽标签的状态。见 PaneTabBar（#86，Windows WebView2 用指针事件而非 HTML5 DnD）。
interface DragState {
  dragTabId: string | null;
  dragSplit: { paneId: string; direction: SplitDirection } | null;
}

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

function loadPersisted(): PersistedState | null {
  if (!restoreSessionEnabled()) return null;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const data = JSON.parse(raw) as PersistedState;
      if (data.root) return data;
    }
  } catch {}
  return null;
}

// ---- Tree helpers（纯函数）----

function collectLeaves(node: TileNode): TileLeaf[] {
  if (node.type === 'leaf') return [node];
  return [...collectLeaves(node.children[0]), ...collectLeaves(node.children[1])];
}

function findNode(root: TileNode, id: string): TileNode | null {
  if (root.id === id) return root;
  if (root.type === 'leaf') return null;
  return findNode(root.children[0], id) ?? findNode(root.children[1], id);
}

function findLeaf(root: TileNode, paneId: string): TileLeaf | null {
  const node = findNode(root, paneId);
  return node?.type === 'leaf' ? node : null;
}

function findParent(root: TileNode, id: string): { parent: TileBranch; index: 0 | 1 } | null {
  if (root.type === 'leaf') return null;
  for (let i = 0 as 0 | 1; i <= 1; i++) {
    if (root.children[i].id === id) return { parent: root, index: i };
    const found = findParent(root.children[i], id);
    if (found) return found;
  }
  return null;
}

/** Replace a node in the tree by id, returning a new tree (immutable). */
function replaceNode(root: TileNode, targetId: string, replacement: TileNode): TileNode {
  if (root.id === targetId) return replacement;
  if (root.type === 'leaf') return root;
  return {
    ...root,
    children: [
      replaceNode(root.children[0], targetId, replacement),
      replaceNode(root.children[1], targetId, replacement),
    ] as [TileNode, TileNode],
  };
}

function firstLeaf(node: TileNode): TileLeaf {
  if (node.type === 'leaf') return node;
  return firstLeaf(node.children[0]);
}

interface TilesActions {
  // getters → 方法
  allLeaves(): TileLeaf[];
  focusedLeaf(): TileLeaf | null;
  leafForPane(paneId: string): TileLeaf | null;
  // actions
  initDefault(tabId: string): void;
  splitPane(paneId: string, direction: SplitDirection, newTabId?: string): void;
  closePane(paneId: string): void;
  setActiveTab(paneId: string, tabId: string): void;
  syncFromTabs(tabId: string): void;
  setFocusedPane(paneId: string): void;
  setSizes(branchId: string, sizes: [number, number]): void;
  removePaneReferences(tabId: string): void;
  syncActiveTab(): void;
  focusNextPane(): void;
  focusPrevPane(): void;
  beginTabDrag(tabId: string): void;
  setDragSplit(target: { paneId: string; direction: SplitDirection } | null): void;
  endTabDrag(): void;
  persist(): void;
  validate(tabs: { id: string }[]): void;
}

function initialState(): PersistedState & DragState {
  const saved = loadPersisted();
  if (saved) return { ...saved, dragTabId: null, dragSplit: null };
  const defaultLeaf: TileLeaf = { type: 'leaf', id: newPaneId(), activeTabId: '' };
  return { root: defaultLeaf, focusedPaneId: defaultLeaf.id, dragTabId: null, dragSplit: null };
}

export const useTilesStore = create<PersistedState & DragState & TilesActions>()((set, get) => ({
  ...initialState(),

  allLeaves() {
    return collectLeaves(get().root);
  },
  focusedLeaf() {
    return findLeaf(get().root, get().focusedPaneId);
  },
  leafForPane(paneId) {
    return findLeaf(get().root, paneId);
  },

  initDefault(tabId) {
    const leaf: TileLeaf = { type: 'leaf', id: newPaneId(), activeTabId: tabId };
    set({ root: leaf, focusedPaneId: leaf.id });
  },

  splitPane(paneId, direction, newTabId) {
    const leaf = findLeaf(get().root, paneId);
    if (!leaf) return;
    const child0: TileLeaf = { type: 'leaf', id: leaf.id, activeTabId: leaf.activeTabId };
    const child1: TileLeaf = {
      type: 'leaf',
      id: newPaneId(),
      activeTabId: newTabId ?? leaf.activeTabId,
    };
    const branch: TileBranch = {
      type: 'branch',
      id: newBranchId(),
      direction,
      sizes: [50, 50],
      children: [child0, child1],
    };
    set({ root: replaceNode(get().root, paneId, branch), focusedPaneId: child1.id });
    get().syncActiveTab();
  },

  closePane(paneId) {
    const leaves = collectLeaves(get().root);
    if (leaves.length <= 1) return; // 始终保留至少一个窗格
    const parentInfo = findParent(get().root, paneId);
    if (!parentInfo) return;
    const { parent, index } = parentInfo;
    const sibling = parent.children[1 - index];
    let root: TileNode;
    if (get().root.id === parent.id) {
      root = sibling;
    } else {
      root = replaceNode(get().root, parent.id, sibling);
    }
    set({ root, focusedPaneId: firstLeaf(sibling).id });
    get().syncActiveTab();
  },

  setActiveTab(paneId, tabId) {
    const leaf = findLeaf(get().root, paneId);
    if (!leaf) return;
    const newLeaf: TileLeaf = { ...leaf, activeTabId: tabId };
    set({ root: replaceNode(get().root, paneId, newLeaf), focusedPaneId: paneId });
    get().syncActiveTab();
  },

  syncFromTabs(tabId) {
    if (!tabId) return;
    const leaf = findLeaf(get().root, get().focusedPaneId);
    if (leaf && leaf.activeTabId !== tabId) {
      const newLeaf: TileLeaf = { ...leaf, activeTabId: tabId };
      set({ root: replaceNode(get().root, leaf.id, newLeaf) });
    }
  },

  setFocusedPane(paneId) {
    set({ focusedPaneId: paneId });
    get().syncActiveTab();
  },

  setSizes(branchId, sizes) {
    const node = findNode(get().root, branchId);
    if (!node || node.type !== 'branch') return;
    const clamped: [number, number] = [Math.max(10, Math.min(90, sizes[0])), 0];
    clamped[1] = 100 - clamped[0];
    const updated: TileBranch = { ...node, sizes: clamped };
    set({ root: replaceNode(get().root, branchId, updated) });
  },

  removePaneReferences(tabId) {
    const tabsState = useTabsStore.getState();
    const leaves = collectLeaves(get().root);
    let root = get().root;
    let changed = false;
    for (const leaf of leaves) {
      if (leaf.activeTabId !== tabId) continue;
      const other = tabsState.tabs.find((t) => t.id !== tabId);
      const newLeaf: TileLeaf = { ...leaf, activeTabId: other?.id ?? '' };
      root = replaceNode(root, leaf.id, newLeaf);
      changed = true;
    }
    if (changed) {
      set({ root });
      get().syncActiveTab();
    }
  },

  syncActiveTab() {
    const leaf = findLeaf(get().root, get().focusedPaneId);
    if (leaf?.activeTabId) {
      // 直接写 tabs.activeId（与 Vue 版赋值等价，不触发 tabs 持久化）。
      useTabsStore.setState({ activeId: leaf.activeTabId });
    }
  },

  focusNextPane() {
    const leaves = collectLeaves(get().root);
    if (leaves.length <= 1) return;
    const idx = leaves.findIndex((l) => l.id === get().focusedPaneId);
    const next = leaves[(idx + 1) % leaves.length];
    set({ focusedPaneId: next.id });
    get().syncActiveTab();
  },

  focusPrevPane() {
    const leaves = collectLeaves(get().root);
    if (leaves.length <= 1) return;
    const idx = leaves.findIndex((l) => l.id === get().focusedPaneId);
    const prev = leaves[(idx - 1 + leaves.length) % leaves.length];
    set({ focusedPaneId: prev.id });
    get().syncActiveTab();
  },

  // ---- 指针拖拽标签（瞬态）----
  beginTabDrag(tabId) {
    set({ dragTabId: tabId, dragSplit: null });
  },
  setDragSplit(target) {
    set({ dragSplit: target });
  },
  endTabDrag() {
    set({ dragTabId: null, dragSplit: null });
  },

  persist() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ root: get().root, focusedPaneId: get().focusedPaneId }));
    } catch {}
  },

  validate(tabs) {
    const ids = new Set(tabs.map((t) => t.id));
    let changed = false;
    const fix = (node: TileNode): TileNode => {
      if (node.type === 'leaf') {
        if (node.activeTabId && !ids.has(node.activeTabId)) {
          changed = true;
          return { ...node, activeTabId: tabs[0]?.id ?? '' };
        }
        return node;
      }
      return { ...node, children: [fix(node.children[0]), fix(node.children[1])] as [TileNode, TileNode] };
    };
    let root = fix(get().root);
    let focusedPaneId = get().focusedPaneId;
    const leafIds = new Set(collectLeaves(root).map((l) => l.id));
    if (!leafIds.has(focusedPaneId)) {
      focusedPaneId = firstLeaf(root).id;
      changed = true;
    }
    set({ root, focusedPaneId });
    if (changed) get().syncActiveTab();
  },
}));
