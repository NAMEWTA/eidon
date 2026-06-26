import { create } from 'zustand';

import { nodesBridge } from '@bridge/ipc';
import { relativeWorkspacePath } from '@shared/utils';
import type {
  CreateNodeInput,
  MoveNodeInput,
  NodeMutationResult,
  NodeTree,
  PromoteFolderInput,
  RelocateNodeInput,
  RenameNodeInput,
  ScannedNode,
  UpdateNodeFieldsInput,
  UpgradeNodeSchemaInput,
} from '@shared/models';
import { useWorkspaceStore } from './workspace';

interface NodesState {
  tree: NodeTree | null;
  nodes: ScannedNode[];
  workspace: string | null;
  loading: boolean;
  error: string | null;
}

interface NodesActions {
  scan(workspace?: string | null): Promise<NodeTree>;
  create(input: CreateNodeInput, workspace?: string | null): Promise<NodeMutationResult>;
  promote(input: PromoteFolderInput, workspace?: string | null): Promise<NodeMutationResult>;
  rename(input: RenameNodeInput, workspace?: string | null): Promise<NodeMutationResult>;
  move(input: MoveNodeInput, workspace?: string | null): Promise<NodeMutationResult>;
  relocate(input: RelocateNodeInput, workspace?: string | null): Promise<{ path: string; strippedIdentity: boolean }>;
  updateFields(input: UpdateNodeFieldsInput, workspace?: string | null): Promise<NodeMutationResult>;
  upgradeSchema(input: UpgradeNodeSchemaInput, workspace?: string | null): Promise<NodeMutationResult>;
  ensureDefaultInbox(workspace?: string | null): Promise<string>;
  /** 确保 date 所在月的日历整理箱链（L1 `_日历`/L2 年/L3 月）存在，返回月节点相对路径。 */
  ensureCalendarMonth(date: Date, workspace?: string | null): Promise<string>;
  relPath(absolutePath: string, workspace?: string | null): string;
  nodeAtPath(path: string): ScannedNode | null;
}

const resolveWorkspace = (workspace?: string | null): string => {
  const resolved = workspace ?? useWorkspaceStore.getState().currentFolder;
  if (!resolved) throw new Error('Open a workspace first');
  return resolved;
};

// 后端 nodes:scan 只回 ScannedNode[]（Map 不跨 IPC 必要传输）；前端缓存层据此重建 id↔path 映射。
const buildTree = (nodes: ScannedNode[]): NodeTree => {
  const idToPath = new Map<string, string>();
  const pathToId = new Map<string, string>();
  for (const scanned of nodes) {
    idToPath.set(scanned.node.id, scanned.path);
    pathToId.set(scanned.path, scanned.node.id);
  }
  return { nodes, idToPath, pathToId };
};

export const useNodesStore = create<NodesState & NodesActions>()((set, get) => ({
  tree: null,
  nodes: [],
  workspace: null,
  loading: false,
  error: null,

  async scan(workspace) {
    const root = resolveWorkspace(workspace);
    set({ loading: true, error: null });
    try {
      const nodes = await nodesBridge.scan(root);
      const tree = buildTree(nodes);
      set({ tree, nodes, workspace: root, loading: false });
      return tree;
    } catch (error) {
      const message = String(error);
      set({ error: message, loading: false });
      throw error;
    }
  },

  async create(input, workspace) {
    const root = resolveWorkspace(workspace);
    const result = await nodesBridge.create(root, input);
    await get().scan(root);
    return result;
  },

  async promote(input, workspace) {
    const root = resolveWorkspace(workspace);
    const result = await nodesBridge.promote(root, input);
    await get().scan(root);
    return result;
  },

  async rename(input, workspace) {
    const root = resolveWorkspace(workspace);
    const result = await nodesBridge.rename(root, input);
    await get().scan(root);
    return result;
  },

  async move(input, workspace) {
    const root = resolveWorkspace(workspace);
    const result = await nodesBridge.move(root, input);
    await get().scan(root);
    return result;
  },

  async relocate(input, workspace) {
    const root = resolveWorkspace(workspace);
    const result = await nodesBridge.relocate(root, input);
    await get().scan(root);
    return result;
  },

  async updateFields(input, workspace) {
    const root = resolveWorkspace(workspace);
    const result = await nodesBridge.updateFields(root, input);
    await get().scan(root);
    return result;
  },

  async upgradeSchema(input, workspace) {
    const root = resolveWorkspace(workspace);
    const result = await nodesBridge.upgradeSchema(root, input);
    await get().scan(root);
    return result;
  },

  async ensureDefaultInbox(workspace) {
    const root = resolveWorkspace(workspace);
    // 模板链解析 + 收件箱三层建链已下沉到 backend node-service（D1）。
    const inboxPath = await nodesBridge.ensureInbox(root);
    await get().scan(root);
    return inboxPath;
  },

  async ensureCalendarMonth(date, workspace) {
    const root = resolveWorkspace(workspace);
    const monthPath = await nodesBridge.ensureCalendar(root, date);
    await get().scan(root);
    return monthPath;
  },

  relPath(absolutePath, workspace) {
    return relativeWorkspacePath(resolveWorkspace(workspace), absolutePath);
  },

  nodeAtPath(path) {
    const normalized = path.replace(/\\/g, '/').split('/').filter(Boolean).join('/');
    return get().nodes.find((node) => node.path === normalized) ?? null;
  },
}));
