import { create } from 'zustand';

import { createWorkspaceFileStore, relativeWorkspacePath } from '../../core/bridge/file';
import {
  CALENDAR_ROOT,
  createNode,
  DEFAULT_INBOX_PATH,
  ensureCalendarStructure,
  ensureDefaultInboxStructure,
  moveNode,
  promoteFolderToNode,
  renameNode,
  scanWorkspace,
  updateNodeFields,
  upgradeNodeSchema,
  type CreateNodeInput,
  type MoveNodeInput,
  type NodeMutationResult,
  type NodeTree,
  type PromoteFolderInput,
  type RenameNodeInput,
  type ScannedNode,
  type UpdateNodeFieldsInput,
  type UpgradeNodeSchemaInput,
} from '../../core/nodes';
import { CALENDAR_TEMPLATE_SEED, DEFAULT_NODE_TEMPLATE_SEED } from '../../core/templates';
import { useWorkspaceStore } from './workspace';
import { useTemplatesStore } from './templates';

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
      const tree = await scanWorkspace(createWorkspaceFileStore(root));
      set({ tree, nodes: tree.nodes, workspace: root, loading: false });
      return tree;
    } catch (error) {
      const message = String(error);
      set({ error: message, loading: false });
      throw error;
    }
  },

  async create(input, workspace) {
    const root = resolveWorkspace(workspace);
    const result = await createNode(createWorkspaceFileStore(root), input);
    await get().scan(root);
    return result;
  },

  async promote(input, workspace) {
    const root = resolveWorkspace(workspace);
    const result = await promoteFolderToNode(createWorkspaceFileStore(root), input);
    await get().scan(root);
    return result;
  },

  async rename(input, workspace) {
    const root = resolveWorkspace(workspace);
    const result = await renameNode(createWorkspaceFileStore(root), input);
    await get().scan(root);
    return result;
  },

  async move(input, workspace) {
    const root = resolveWorkspace(workspace);
    const result = await moveNode(createWorkspaceFileStore(root), input);
    await get().scan(root);
    return result;
  },

  async updateFields(input, workspace) {
    const root = resolveWorkspace(workspace);
    const result = await updateNodeFields(createWorkspaceFileStore(root), input);
    await get().scan(root);
    return result;
  },

  async upgradeSchema(input, workspace) {
    const root = resolveWorkspace(workspace);
    const result = await upgradeNodeSchema(createWorkspaceFileStore(root), input);
    await get().scan(root);
    return result;
  },

  async ensureDefaultInbox(workspace) {
    const root = resolveWorkspace(workspace);
    const templates = await useTemplatesStore.getState().init(root);
    const store = createWorkspaceFileStore(root);
    let selected = templates[0];

    // 无任何模板时（init 的目录级 guard 命中、或用户删光了模板）现场补一个默认模板，
    // 而非抛错——保证收件箱三层总能绑定到模板，新建文件绝不因缺模板而落不进 L3。
    if (!selected) {
      selected = await useTemplatesStore.getState().create(DEFAULT_NODE_TEMPLATE_SEED, root);
    }

    try {
      const tree = await scanWorkspace(store);
      const l1Path = DEFAULT_INBOX_PATH.split('/')[0];
      const l1 = tree.nodes.find((node) => node.path === l1Path);
      const matching = l1
        ? templates.find((template) =>
            template.templateId === l1.node.templateId &&
            template.version === l1.node.schemaVersion,
          )
        : null;
      if (matching) selected = matching;
    } catch {
      // Consistency scanning will surface broken structures; here we still try
      // to create the default path with the selected template.
    }

    const result = await ensureDefaultInboxStructure(store, { templateLayers: selected.layers });
    await get().scan(root);
    return result.inboxPath;
  },

  async ensureCalendarMonth(date, workspace) {
    const root = resolveWorkspace(workspace);
    const templatesStore = useTemplatesStore.getState();
    const templates = await templatesStore.init(root);
    const store = createWorkspaceFileStore(root);

    // 模板链选取优先级：已存在 L1 `_日历` 所绑定的模板版本 → 名为「日历」的模板 → 现场创建种子。
    let selected = null as (typeof templates)[number] | null;
    try {
      const tree = await scanWorkspace(store);
      const l1 = tree.nodes.find((node) => node.path === CALENDAR_ROOT);
      if (l1) {
        selected = templates.find(
          (template) =>
            template.templateId === l1.node.templateId &&
            template.version === l1.node.schemaVersion,
        ) ?? null;
      }
    } catch {
      // 扫描失败交给一致性面板呈现；这里继续按名称/种子兜底建链。
    }
    if (!selected) {
      selected = templates.find((template) => template.templateName === CALENDAR_TEMPLATE_SEED.templateName) ?? null;
    }
    if (!selected) {
      selected = await templatesStore.create(CALENDAR_TEMPLATE_SEED, root);
    }

    const result = await ensureCalendarStructure(store, { templateLayers: selected.layers, date });
    await get().scan(root);
    return result.monthPath;
  },

  relPath(absolutePath, workspace) {
    return relativeWorkspacePath(resolveWorkspace(workspace), absolutePath);
  },

  nodeAtPath(path) {
    const normalized = path.replace(/\\/g, '/').split('/').filter(Boolean).join('/');
    return get().nodes.find((node) => node.path === normalized) ?? null;
  },
}));
