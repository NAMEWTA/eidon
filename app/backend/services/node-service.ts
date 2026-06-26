/**
 * backend/services/node-service —— 节点域编排（构造 store → 调 domain → 返回 model）。
 * ensureInbox/ensureCalendar 承载原渲染侧 nodes store 的模板链解析编排（组合 templates 域）。
 */
import type {
  CreateNodeInput,
  MoveNodeInput,
  NodeMutationResult,
  PromoteFolderInput,
  RelocateNodeInput,
  RenameNodeInput,
  ScannedNode,
  Template,
  UpdateNodeFieldsInput,
  UpgradeNodeSchemaInput,
} from "@shared/models";
import { CALENDAR_ROOT, DEFAULT_INBOX_PATH } from "@shared/utils";
import {
  CALENDAR_TEMPLATE_SEED,
  DEFAULT_NODE_TEMPLATE_SEED,
  createNode,
  createTemplate,
  ensureCalendarStructure,
  ensureDefaultInboxStructure,
  moveNode,
  promoteFolderToNode,
  relocateNode,
  renameNode,
  scanWorkspace,
  updateNodeFields,
  upgradeNodeSchema,
} from "../domain";
import { ensureTemplatesInitialized } from "./template-service";
import { createWorkspaceStore } from "./workspace-store";

export const nodeService = {
  async scan(workspace: string): Promise<ScannedNode[]> {
    const tree = await scanWorkspace(createWorkspaceStore(workspace));
    return tree.nodes;
  },

  create: (workspace: string, input: CreateNodeInput): Promise<NodeMutationResult> =>
    createNode(createWorkspaceStore(workspace), input),

  promote: (workspace: string, input: PromoteFolderInput): Promise<NodeMutationResult> =>
    promoteFolderToNode(createWorkspaceStore(workspace), input),

  rename: (workspace: string, input: RenameNodeInput): Promise<NodeMutationResult> =>
    renameNode(createWorkspaceStore(workspace), input),

  move: (workspace: string, input: MoveNodeInput): Promise<NodeMutationResult> =>
    moveNode(createWorkspaceStore(workspace), input),

  /** 降级/重定位节点（向下移动 + 按新深度重写 level 或剥离身份）。 */
  relocate: (workspace: string, input: RelocateNodeInput): Promise<{ path: string; strippedIdentity: boolean }> =>
    relocateNode(createWorkspaceStore(workspace), input),

  updateFields: (workspace: string, input: UpdateNodeFieldsInput): Promise<NodeMutationResult> =>
    updateNodeFields(createWorkspaceStore(workspace), input),

  upgradeSchema: (workspace: string, input: UpgradeNodeSchemaInput): Promise<NodeMutationResult> =>
    upgradeNodeSchema(createWorkspaceStore(workspace), input),

  /** 确保默认收件箱（L1 `_整理箱`/L2 `未分类`/L3 `收件箱`）存在，返回 L3 收件箱相对路径。 */
  async ensureInbox(workspace: string): Promise<string> {
    const store = createWorkspaceStore(workspace);
    const templates = await ensureTemplatesInitialized(workspace);
    // 无任何模板时现场补一个默认模板，保证收件箱三层总能绑定到模板。
    let selected: Template = templates[0] ?? (await createTemplate(store, DEFAULT_NODE_TEMPLATE_SEED));
    try {
      const tree = await scanWorkspace(store);
      const l1Path = DEFAULT_INBOX_PATH.split("/")[0];
      const l1 = tree.nodes.find((node) => node.path === l1Path);
      const matching = l1
        ? templates.find(
            (template) =>
              template.templateId === l1.node.templateId &&
              template.version === l1.node.schemaVersion,
          )
        : undefined;
      if (matching) selected = matching;
    } catch {
      // 一致性面板会呈现破损结构；此处仍按 selected 模板尽力建链。
    }
    const result = await ensureDefaultInboxStructure(store, { templateLayers: selected.layers });
    return result.inboxPath;
  },

  /** 确保 date 所在月的日历整理箱链（L1 `_日历`/L2 年/L3 月）存在，返回月节点相对路径。 */
  async ensureCalendar(workspace: string, date: Date): Promise<string> {
    const store = createWorkspaceStore(workspace);
    const templates = await ensureTemplatesInitialized(workspace);
    // 模板链选取：已存在 L1 `_日历` 所绑定的版本 → 名为「日历」的模板 → 现场创建种子。
    let selected: Template | undefined;
    try {
      const tree = await scanWorkspace(store);
      const l1 = tree.nodes.find((node) => node.path === CALENDAR_ROOT);
      if (l1) {
        selected = templates.find(
          (template) =>
            template.templateId === l1.node.templateId &&
            template.version === l1.node.schemaVersion,
        );
      }
    } catch {
      // 扫描失败交给一致性面板；继续按名称/种子兜底建链。
    }
    if (!selected) {
      selected = templates.find((t) => t.templateName === CALENDAR_TEMPLATE_SEED.templateName);
    }
    if (!selected) {
      selected = await createTemplate(store, CALENDAR_TEMPLATE_SEED);
    }
    const result = await ensureCalendarStructure(store, {
      templateLayers: selected.layers,
      date,
    });
    return result.monthPath;
  },
};
