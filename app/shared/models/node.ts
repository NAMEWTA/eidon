/**
 * shared/models/node —— 节点域数据模型 + 注入端口（纯类型，零逻辑）。
 * 业务实现见 backend/domain/nodes；前端经 bridge IPC 消费这些类型。
 */
import type { Level, Node, TemplateLayer } from "../contracts";
import type { DirEntry } from "./fs";

/**
 * workspace 读取器（注入依赖，系统边界）。
 * 生产由 backend 经 capabilities/editor/file-ops 实现；测试用 node:fs 临时目录实现。
 * 路径均为 workspace 相对 POSIX 路径（"/" 分隔），根目录用空串。
 */
export interface WorkspaceReader {
  listDir(relPath: string): Promise<DirEntry[]>;
  readFile(relPath: string): Promise<string>;
}

/** 可写节点 store（生产由 backend capabilities 适配；测试用 node:fs）。 */
export interface NodeStore extends WorkspaceReader {
  writeFile(relPath: string, contents: string): Promise<void>;
  createDir(relPath: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  exists(relPath: string): Promise<boolean>;
}

/** 扫描得到的单个节点：解析后的 node.json + 物理路径 + 物理深度（=权威层级）。 */
export interface ScannedNode {
  node: Node;
  path: string;
  depth: 1 | 2 | 3;
}

/** 扫描结果：节点列表（按路径稳定排序）+ 双向 id↔path 映射。 */
export interface NodeTree {
  nodes: ScannedNode[];
  idToPath: Map<string, string>;
  pathToId: Map<string, string>;
}

export interface NodeMutationResult extends ScannedNode {}

export interface CreateNodeInput {
  parentPath: string;
  name: string;
  templateLayer: TemplateLayer;
  fields?: Record<string, unknown>;
  now?: string | Date;
}

export interface PromoteFolderInput {
  path: string;
  templateLayer: TemplateLayer;
  fields?: Record<string, unknown>;
  now?: string | Date;
}

export interface RenameNodeInput {
  path: string;
  newName: string;
}

export interface MoveNodeInput {
  path: string;
  newParentPath: string;
}

export interface UpdateNodeFieldsInput {
  path: string;
  templateLayer: TemplateLayer;
  fields: Record<string, unknown>;
}

export interface UpgradeNodeSchemaInput {
  path: string;
  templateLayer: TemplateLayer;
}

export interface EnsureDefaultInboxInput {
  templateLayers: Record<Level, TemplateLayer>;
  now?: string | Date;
}

export interface EnsureDefaultInboxResult {
  l1: NodeMutationResult;
  l2: NodeMutationResult;
  l3: NodeMutationResult;
  inboxPath: string;
}

export interface EnsureCalendarStructureInput {
  templateLayers: Record<Level, TemplateLayer>;
  date: Date;
  now?: string | Date;
}

export interface EnsureCalendarStructureResult {
  l1: NodeMutationResult;
  l2: NodeMutationResult;
  l3: NodeMutationResult;
  monthPath: string;
}
