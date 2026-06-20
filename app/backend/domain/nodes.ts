import { NodeSchema, type FieldDef, type FieldValue, type Level, type Node, type TemplateLayer } from "@shared/contracts";
import {
  createNodeId,
  CALENDAR_ROOT,
  DEFAULT_INBOX_SEGMENTS,
  basenameOf,
  calendarMonthPath,
  calendarYearPath,
  joinPath,
  normalizePath,
  parentPathOf,
  pathDepth,
  splitPath,
} from "@shared/utils";
import type {
  CreateNodeInput,
  EnsureCalendarStructureInput,
  EnsureCalendarStructureResult,
  EnsureDefaultInboxInput,
  EnsureDefaultInboxResult,
  MoveNodeInput,
  NodeMutationResult,
  NodeStore,
  NodeTree,
  PromoteFolderInput,
  RenameNodeInput,
  ScannedNode,
  UpdateNodeFieldsInput,
  UpgradeNodeSchemaInput,
  WorkspaceReader,
} from "@shared/models";

/**
 * core/nodes —— 节点拓扑内核（公共出口）。
 * 扫描建树 + 创建/重命名/移动/提升为节点。违规检测属 core/consistency，
 * 本模块只负责 EIDON 内部创建期硬强制（深度=层级）与 `.node/node.json` 契约写盘。
 */

// 节点只存在于第 1/2/3 物理层；第 4 层起为自由文件夹（无身份），不再下探建节点。
const MAX_NODE_DEPTH = 3;


const assertSafeName = (name: string): string => {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("node name is required");
  if (trimmed.includes("/") || trimmed.includes("\\") || trimmed === "." || trimmed === "..") {
    throw new Error(`invalid node name: ${name}`);
  }
  return trimmed;
};

const levelFromDepth = (depth: number): Level => {
  if (depth !== 1 && depth !== 2 && depth !== 3) {
    throw new Error("structure nodes can only live in the first three physical depths; L3 children are free folders");
  }
  return depth;
};

const nowIso = (now?: string | Date): string =>
  now instanceof Date ? now.toISOString() : (now ?? new Date().toISOString());

// 尝试读取并解析某目录下的 .node/node.json；缺失/损坏/非法一律返回 null（视为非节点）。
const tryReadNode = async (
  reader: WorkspaceReader,
  dirPath: string,
): Promise<Node | null> => {
  try {
    const raw = await reader.readFile(joinPath(dirPath, ".node/node.json"));
    const parsed = NodeSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

const readNode = async (reader: WorkspaceReader, dirPath: string): Promise<Node> => {
  const node = await tryReadNode(reader, normalizePath(dirPath));
  if (!node) throw new Error(`parent node missing or invalid: ${dirPath}`);
  return node;
};

const ensureNodeAtPath = async (
  store: NodeStore,
  input: {
    path: string;
    parentPath: string;
    name: string;
    templateLayer: TemplateLayer;
    now?: string | Date;
  },
): Promise<NodeMutationResult> => {
  const path = normalizePath(input.path);
  const existing = await tryReadNode(store, path);
  if (existing) {
    const depth = levelFromDepth(pathDepth(path));
    if (existing.level !== depth) {
      throw new Error(`default inbox node level mismatch at ${path}: node says L${existing.level}, physical path is L${depth}`);
    }
    return { node: existing, path, depth };
  }

  if (await store.exists(path)) {
    return promoteFolderToNode(store, {
      path,
      templateLayer: input.templateLayer,
      now: input.now,
    });
  }

  return createNode(store, {
    parentPath: input.parentPath,
    name: input.name,
    templateLayer: input.templateLayer,
    now: input.now,
  });
};

const assertTemplateForLevel = (
  templateLayer: TemplateLayer,
  level: Level,
): void => {
  if (templateLayer.level !== level) {
    throw new Error(`template layer level ${templateLayer.level} does not match target L${level}`);
  }
};

const assertParentChain = async (
  reader: WorkspaceReader,
  parentPath: string,
  level: Level,
  templateLayer: TemplateLayer,
): Promise<void> => {
  if (level === 1) {
    if (normalizePath(parentPath) !== "") {
      throw new Error("L1 nodes must be created at the workspace root");
    }
    return;
  }

  const parent = await readNode(reader, parentPath);
  if (parent.level !== level - 1) {
    throw new Error(`parent node must be L${level - 1}`);
  }
  if (
    parent.templateId !== templateLayer.templateId ||
    parent.schemaVersion !== templateLayer.schemaVersion
  ) {
    throw new Error("template chain mismatch with parent node");
  }
};

const assertNodeFitsParent = async (
  reader: WorkspaceReader,
  node: Node,
  newParentPath: string,
): Promise<void> => {
  const targetLevel = levelFromDepth(pathDepth(newParentPath) + 1);
  if (targetLevel !== node.level) {
    throw new Error(`target parent would place L${node.level} node at L${targetLevel}`);
  }
  if (targetLevel === 1) return;

  const parent = await readNode(reader, newParentPath);
  if (parent.level !== node.level - 1) {
    throw new Error(`parent node must be L${node.level - 1}`);
  }
  if (parent.templateId !== node.templateId || parent.schemaVersion !== node.schemaVersion) {
    throw new Error("template chain mismatch with target parent");
  }
};

const validateFieldValue = (
  field: FieldDef,
  value: unknown,
  options: { enforceRequired: boolean },
): FieldValue => {
  if (value === null || value === undefined) {
    if (field.required && options.enforceRequired) throw new Error(`${field.key} is required`);
    return null;
  }

  switch (field.type) {
    case "text":
    case "textarea":
    case "date":
      if (typeof value !== "string") throw new Error(`${field.key} must be a string`);
      if (field.required && options.enforceRequired && value.trim() === "") throw new Error(`${field.key} is required`);
      return value;
    case "number":
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error(`${field.key} must be a finite number`);
      }
      return value;
    case "boolean":
      if (typeof value !== "boolean") throw new Error(`${field.key} must be a boolean`);
      return value;
    case "select":
      if (typeof value !== "string") throw new Error(`${field.key} must be a select option`);
      if (!field.options?.includes(value)) {
        throw new Error(`${field.key} must be one of the configured select options`);
      }
      return value;
    default: {
      const _exhaustive: never = field.type;
      throw new Error(`unsupported field type: ${_exhaustive}`);
    }
  }
};

const validateFields = (
  templateLayer: TemplateLayer,
  fields: Record<string, unknown> = {},
  options: {
    enforceRequired?: boolean;
    allowUnknown?: boolean;
    resetInvalid?: boolean;
  } = {},
): Record<string, FieldValue> => {
  const enforceRequired = options.enforceRequired ?? true;
  const fieldDefs = new Map(templateLayer.fields.map((field) => [field.key, field]));
  if (!options.allowUnknown) {
    for (const key of Object.keys(fields)) {
      if (!fieldDefs.has(key)) throw new Error(`unknown field: ${key}`);
    }
  }

  const normalized: Record<string, FieldValue> = {};
  for (const field of templateLayer.fields) {
    const value = fields[field.key] ?? null;
    try {
      normalized[field.key] = validateFieldValue(field, value, { enforceRequired });
    } catch (error) {
      if (!options.resetInvalid) throw error;
      normalized[field.key] = null;
    }
  }
  return normalized;
};

const buildNode = (input: {
  level: Level;
  templateLayer: TemplateLayer;
  fields?: Record<string, unknown>;
  now?: string | Date;
}): Node =>
  NodeSchema.parse({
    id: createNodeId(),
    templateId: input.templateLayer.templateId,
    level: input.level,
    type: input.templateLayer.name,
    schemaVersion: input.templateLayer.schemaVersion,
    createdAt: nowIso(input.now),
    fields: validateFields(input.templateLayer, input.fields),
    references: [],
    flags: {},
  });

/**
 * 节点 AGENTS.md 默认内容：撰写本节点所处的 L1/L2/L3 目录层级结构与名称，供 AI 助手参考。
 * 由相对路径各段（= L1/L2/L3 名）+ node.level/type 生成。
 */
const buildNodeAgentsDoc = (relPath: string, node: Node): string => {
  const segs = splitPath(relPath);
  const name = segs[segs.length - 1] ?? "";
  const chain = segs.map((seg, i) => `L${i + 1} ${seg}`).join(" / ");
  return [
    `# ${name}`,
    "",
    `- 层级：L${node.level}（${node.type}）`,
    `- 结构路径：${chain}`,
    "",
    "> 本文件由 EIDON 在创建节点时生成，记录本节点在 L1/L2/L3 结构中的位置与名称，供 AI 助手参考。",
    "",
  ].join("\n");
};

const writeNodeEnvelope = async (
  store: NodeStore,
  path: string,
  node: Node,
): Promise<NodeMutationResult> => {
  const normalizedPath = normalizePath(path);
  await store.createDir(normalizedPath);
  await store.createDir(joinPath(normalizedPath, ".node"));
  await store.writeFile(
    joinPath(normalizedPath, ".node/node.json"),
    JSON.stringify(NodeSchema.parse(node), null, 2),
  );
  // 仅初始化 AGENTS.md（带层级结构内容）；不再创建 README.md。
  const agentsPath = joinPath(normalizedPath, "AGENTS.md");
  if (!(await store.exists(agentsPath))) {
    await store.writeFile(agentsPath, buildNodeAgentsDoc(normalizedPath, node));
  }
  return { node, path: normalizedPath, depth: node.level };
};

/**
 * 扫描 workspace 建节点树。
 * - 物理深度=层级：根的第 1/2/3 层子目录分别为 L1/L2/L3 候选。
 * - 含可解析 `.node/node.json` 者为结构节点；否则为普通文件夹（不计入、但仍下探找更深节点）。
 * - 忽略 `.` 开头目录（.node/.eidon/.eidon-sync/.git 等系统与隐藏目录）。
 * - 结果按 path 字典序排序，保证「删缓存重建」输出确定、可逐一比对（AX-1/AX-4）。
 */
export const scanWorkspace = async (
  reader: WorkspaceReader,
): Promise<NodeTree> => {
  const nodes: ScannedNode[] = [];

  const walk = async (relPath: string, depth: number): Promise<void> => {
    const entries = await reader.listDir(relPath);
    const dirs = entries
      .filter((e) => e.isDir && !e.name.startsWith("."))
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const dir of dirs) {
      const childDepth = depth + 1;
      if (childDepth > MAX_NODE_DEPTH) continue; // 第 4 层起无身份，不下探

      const childPath = joinPath(relPath, dir.name);
      const node = await tryReadNode(reader, childPath);
      if (node) {
        nodes.push({ node, path: childPath, depth: childDepth as 1 | 2 | 3 });
      }
      await walk(childPath, childDepth);
    }
  };

  await walk("", 0);

  nodes.sort((a, b) => a.path.localeCompare(b.path));

  const idToPath = new Map<string, string>();
  const pathToId = new Map<string, string>();
  for (const scanned of nodes) {
    idToPath.set(scanned.node.id, scanned.path);
    pathToId.set(scanned.path, scanned.node.id);
  }

  return { nodes, idToPath, pathToId };
};

/** 列出使用某模板的所有结构节点（跨 schemaVersion）。 */
export const listNodesUsingTemplate = async (
  reader: WorkspaceReader,
  templateId: string,
): Promise<ScannedNode[]> => {
  const tree = await scanWorkspace(reader);
  return tree.nodes.filter((scanned) => scanned.node.templateId === templateId);
};

/** 创建 L1/L2/L3 结构节点；创建期硬强制深度=层级与父链模板一致。 */
export const createNode = async (
  store: NodeStore,
  input: CreateNodeInput,
): Promise<NodeMutationResult> => {
  const parentPath = normalizePath(input.parentPath);
  const name = assertSafeName(input.name);
  const targetPath = joinPath(parentPath, name);
  const level = levelFromDepth(pathDepth(targetPath));
  assertTemplateForLevel(input.templateLayer, level);
  await assertParentChain(store, parentPath, level, input.templateLayer);
  if (await store.exists(targetPath)) {
    throw new Error(`target already exists: ${targetPath}`);
  }

  const node = buildNode({
    level,
    templateLayer: input.templateLayer,
    fields: input.fields,
    now: input.now,
  });
  return writeNodeEnvelope(store, targetPath, node);
};

/** 把普通文件夹按当前物理深度提升为结构节点；不移动既有内容。 */
export const promoteFolderToNode = async (
  store: NodeStore,
  input: PromoteFolderInput,
): Promise<NodeMutationResult> => {
  const path = normalizePath(input.path);
  if (!path || !(await store.exists(path))) {
    throw new Error(`folder does not exist: ${input.path}`);
  }
  const level = levelFromDepth(pathDepth(path));
  assertTemplateForLevel(input.templateLayer, level);
  if (await tryReadNode(store, path)) {
    throw new Error(`folder is already a node: ${path}`);
  }
  await assertParentChain(store, parentPathOf(path), level, input.templateLayer);

  const node = buildNode({
    level,
    templateLayer: input.templateLayer,
    fields: input.fields,
    now: input.now,
  });
  return writeNodeEnvelope(store, path, node);
};

/** 重命名节点目录；`.node/node.json` 原样随目录移动，ID 不变。 */
export const renameNode = async (
  store: NodeStore,
  input: RenameNodeInput,
): Promise<NodeMutationResult> => {
  const path = normalizePath(input.path);
  const node = await readNode(store, path);
  const target = joinPath(parentPathOf(path), assertSafeName(input.newName));
  if (target === path) return { node, path, depth: node.level };
  if (await store.exists(target)) throw new Error(`target already exists: ${target}`);
  await store.rename(path, target);
  return { node, path: target, depth: node.level };
};

/** 移动节点目录到合法父级；不改 node.json，ID/字段/schemaVersion 保持稳定。 */
export const moveNode = async (
  store: NodeStore,
  input: MoveNodeInput,
): Promise<NodeMutationResult> => {
  const path = normalizePath(input.path);
  const newParentPath = normalizePath(input.newParentPath);
  const node = await readNode(store, path);
  await assertNodeFitsParent(store, node, newParentPath);
  const target = joinPath(newParentPath, basenameOf(path));
  if (target === path) return { node, path, depth: node.level };
  if (target.startsWith(`${path}/`)) throw new Error("cannot move a node inside itself");
  if (await store.exists(target)) throw new Error(`target already exists: ${target}`);
  await store.rename(path, target);
  return { node, path: target, depth: node.level };
};

/** 按节点所绑定的模板版本写扩展字段；未知字段或类型不符会在写盘前拒绝。 */
export const updateNodeFields = async (
  store: NodeStore,
  input: UpdateNodeFieldsInput,
): Promise<NodeMutationResult> => {
  const path = normalizePath(input.path);
  const node = await readNode(store, path);
  if (
    node.templateId !== input.templateLayer.templateId ||
    node.level !== input.templateLayer.level ||
    node.schemaVersion !== input.templateLayer.schemaVersion
  ) {
    throw new Error("template layer does not match node schemaVersion");
  }

  const updated = NodeSchema.parse({
    ...node,
    type: input.templateLayer.name,
    fields: validateFields(input.templateLayer, input.fields),
  });
  await store.writeFile(
    joinPath(path, ".node/node.json"),
    JSON.stringify(updated, null, 2),
  );
  return { node: updated, path, depth: updated.level };
};

/** 将旧节点显式升级到同模板同层级的新 schemaVersion；字段按新 schema 懒迁移。 */
export const upgradeNodeSchema = async (
  store: NodeStore,
  input: UpgradeNodeSchemaInput,
): Promise<NodeMutationResult> => {
  const path = normalizePath(input.path);
  const node = await readNode(store, path);
  if (node.templateId !== input.templateLayer.templateId) {
    throw new Error("template id does not match node");
  }
  if (node.level !== input.templateLayer.level) {
    throw new Error("template layer level does not match node level");
  }

  const updated = NodeSchema.parse({
    ...node,
    type: input.templateLayer.name,
    schemaVersion: input.templateLayer.schemaVersion,
    fields: validateFields(input.templateLayer, node.fields, {
      allowUnknown: true,
      enforceRequired: false,
      resetInvalid: true,
    }),
  });
  await store.writeFile(
    joinPath(path, ".node/node.json"),
    JSON.stringify(updated, null, 2),
  );
  return { node: updated, path, depth: updated.level };
};

/** 确保默认物理收件箱存在：L1 `_整理箱` → L2 `未分类` → L3 `收件箱`。 */
export const ensureDefaultInboxStructure = async (
  store: NodeStore,
  input: EnsureDefaultInboxInput,
): Promise<EnsureDefaultInboxResult> => {
  const l1 = await ensureNodeAtPath(store, {
    path: DEFAULT_INBOX_SEGMENTS[0],
    parentPath: "",
    name: DEFAULT_INBOX_SEGMENTS[0],
    templateLayer: input.templateLayers[1],
    now: input.now,
  });
  const l2Path = joinPath(l1.path, DEFAULT_INBOX_SEGMENTS[1]);
  const l2 = await ensureNodeAtPath(store, {
    path: l2Path,
    parentPath: l1.path,
    name: DEFAULT_INBOX_SEGMENTS[1],
    templateLayer: input.templateLayers[2],
    now: input.now,
  });
  const l3Path = joinPath(l2.path, DEFAULT_INBOX_SEGMENTS[2]);
  const l3 = await ensureNodeAtPath(store, {
    path: l3Path,
    parentPath: l2.path,
    name: DEFAULT_INBOX_SEGMENTS[2],
    templateLayer: input.templateLayers[3],
    now: input.now,
  });

  return { l1, l2, l3, inboxPath: l3.path };
};

/**
 * 确保某日期对应的日历整理箱链存在：L1 `_日历` → L2 `2026`（年）→ L3 `2026-06`（月）。
 * 幂等（已是节点→校验层级；裸目录→提升；缺失→创建），日记文件由调用方写入月 L3 内。
 */
export const ensureCalendarStructure = async (
  store: NodeStore,
  input: EnsureCalendarStructureInput,
): Promise<EnsureCalendarStructureResult> => {
  const yearPath = calendarYearPath(input.date);
  const monthPath = calendarMonthPath(input.date);

  const l1 = await ensureNodeAtPath(store, {
    path: CALENDAR_ROOT,
    parentPath: "",
    name: CALENDAR_ROOT,
    templateLayer: input.templateLayers[1],
    now: input.now,
  });
  const l2 = await ensureNodeAtPath(store, {
    path: yearPath,
    parentPath: l1.path,
    name: basenameOf(yearPath),
    templateLayer: input.templateLayers[2],
    now: input.now,
  });
  const l3 = await ensureNodeAtPath(store, {
    path: monthPath,
    parentPath: l2.path,
    name: basenameOf(monthPath),
    templateLayer: input.templateLayers[3],
    now: input.now,
  });

  return { l1, l2, l3, monthPath: l3.path };
};

// 便捷再导出：注入端口类型的事实源在 @shared/models，路径/日历纯函数在 @shared/utils。
// backend 内部与既有测试以「节点域」单点 import；ESLint 边界仍禁前端 import backend（见 ADR-0025）。
export type { NodeStore, WorkspaceReader, ScannedNode, NodeTree, NodeMutationResult } from "@shared/models";
export {
  CALENDAR_ROOT,
  DEFAULT_INBOX_PATH,
  DEFAULT_INBOX_SEGMENTS,
  calendarYearPath,
  calendarMonthPath,
  calendarNotePath,
} from "@shared/utils";
