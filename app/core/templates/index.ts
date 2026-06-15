import {
  EIDON_TEMPLATES_DIR,
  TemplateLayerSchema,
  parseTemplateLayerFileName,
  templateLayerPath,
  type FieldType,
  type Level,
  type TemplateLayer,
} from "../contracts";
import { createNodeId } from "../shared/id";

/**
 * core/templates —— 多模板 schema 管理（公共出口）。
 * 本期（阶段1）：首次初始化+内置种子 / 创建 / 列出 / 取版本 / 版本化不可变编辑 / 删除孤儿态。
 * 写盘前一律过 `TemplateLayerSchema`（契约先行，ADR-0014）；文件系统经注入的 `TemplateStore`（系统边界）。
 * 设置内 React TemplateManager UI 与生产 bridge 实装不在本模块范围。
 */

/** 目录项（store 返回的最小信息）。 */
export interface DirEntry {
  name: string;
  isDir: boolean;
}

/**
 * 可写文件系统抽象（注入依赖，系统边界）。
 * 生产环境由 core/bridge 经 editor/file_ops 实现；测试用 node:fs 临时目录实现。
 * 路径均为 workspace 相对 POSIX 路径，根用空串。
 */
export interface TemplateStore {
  listDir(relPath: string): Promise<DirEntry[]>;
  readFile(relPath: string): Promise<string>;
  writeFile(relPath: string, contents: string): Promise<void>;
  remove(relPath: string): Promise<void>;
  exists(relPath: string): Promise<boolean>;
}

/** 单层模板输入（pre-parse；required/options 可省，由契约补默认/校验）。 */
export interface LayerInput {
  name: string;
  fields: Array<{
    key: string;
    label: string;
    type: FieldType;
    options?: string[];
    required?: boolean;
  }>;
}

/** 创建/编辑模板输入：三层各自的名字 + 字段集。 */
export interface TemplateInput {
  templateName?: string;
  layers: Record<Level, LayerInput>;
}

/** 一套模板的运行时三层捆绑视图（非磁盘单元；磁盘是每层一文件）。 */
export interface Template {
  templateId: string;
  templateName: string;
  version: number;
  layers: Record<Level, TemplateLayer>;
}

export interface InvalidTemplate {
  templateId: string;
  reason: string;
}

const LEVELS: Level[] = [1, 2, 3];

const templateDir = (templateId: string): string =>
  `${EIDON_TEMPLATES_DIR}/${templateId}`;

const templateDisplayNameFromLayers = (layers: Record<Level, LayerInput | TemplateLayer>): string =>
  LEVELS
    .map((level) => layers[level].name.trim())
    .filter(Boolean)
    .join(" / ");

const normalizeTemplateName = (input: TemplateInput): string => {
  const explicit = input.templateName?.trim();
  return explicit || templateDisplayNameFromLayers(input.layers);
};

// 把三层输入构造为校验后的 TemplateLayer（先全部校验，调用方再统一写盘 → 原子）。
const buildLayers = (
  templateId: string,
  version: number,
  schemaVersion: number,
  input: TemplateInput,
): Record<Level, TemplateLayer> => {
  const layers = {} as Record<Level, TemplateLayer>;
  const templateName = normalizeTemplateName(input);
  for (const level of LEVELS) {
    const spec = input.layers[level];
    layers[level] = TemplateLayerSchema.parse({
      templateId,
      templateName,
      level,
      name: spec.name,
      version,
      schemaVersion,
      fields: spec.fields,
    });
  }
  return layers;
};

const writeLayers = async (
  store: TemplateStore,
  layers: Record<Level, TemplateLayer>,
): Promise<void> => {
  for (const level of LEVELS) {
    const layer = layers[level];
    const path = templateLayerPath(layer.templateId, {
      level: layer.level,
      name: layer.name,
      version: layer.version,
    });
    await store.writeFile(path, JSON.stringify(layer, null, 2));
  }
};

// 读某模板某版本（默认最新）的三层；版本不完整或不存在返回 null。
const readTemplateVersion = async (
  store: TemplateStore,
  templateId: string,
  version?: number,
): Promise<Template | null> => {
  const dir = templateDir(templateId);
  const files = (await store.listDir(dir))
    .filter((e) => !e.isDir)
    .map((e) => ({ name: e.name, meta: parseTemplateLayerFileName(e.name) }))
    .filter(
      (x): x is { name: string; meta: NonNullable<typeof x.meta> } =>
        x.meta !== null,
    );
  if (files.length === 0) return null;

  const targetVersion =
    version ?? Math.max(...files.map((f) => f.meta.version));

  const layers = {} as Record<Level, TemplateLayer>;
  for (const level of LEVELS) {
    const file = files.find(
      (f) => f.meta.level === level && f.meta.version === targetVersion,
    );
    if (!file) return null; // 该版本三层不完整
    try {
      const raw = await store.readFile(`${dir}/${file.name}`);
      layers[level] = TemplateLayerSchema.parse(JSON.parse(raw));
    } catch {
      return null;
    }
  }
  const templateName =
    LEVELS.map((level) => layers[level].templateName?.trim()).find(Boolean) ??
    templateDisplayNameFromLayers(layers);
  return { templateId, templateName, version: targetVersion, layers };
};

/**
 * 创建一套新模板：生成 ULID templateId、version=1，写三个不可变层文件。
 * 全部三层先过 `TemplateLayerSchema` 校验，再统一写盘——校验失败原子失败、不留半套。
 */
export const createTemplate = async (
  store: TemplateStore,
  input: TemplateInput,
): Promise<Template> => {
  const templateId = createNodeId();
  const version = 1;
  // 不变量：模板 version === schemaVersion（节点据此记录所用模板版本）
  const layers = buildLayers(templateId, version, version, input);
  await writeLayers(store, layers);
  return { templateId, templateName: normalizeTemplateName(input), version, layers };
};

/**
 * 默认节点模板 seed（内置「档案」）。
 * init 首次种子化与「确保默认收件箱」无模板兜底共用此 seed——保证任何工作区里
 * 新建文件总能找到可绑定的三层模板，绝不因缺模板而无法落入收件箱 L3。
 */
export const DEFAULT_NODE_TEMPLATE_SEED: TemplateInput = {
  templateName: "档案",
  layers: {
    1: { name: "档案库", fields: [] },
    2: {
      name: "案卷",
      fields: [
        { key: "category", label: "分类", type: "select", options: ["行政", "项目", "合同", "其他"] },
        { key: "date", label: "日期", type: "date" },
        { key: "status", label: "状态", type: "select", options: ["在办", "归档"] },
      ],
    },
    3: {
      name: "文件",
      fields: [
        { key: "summary", label: "摘要", type: "textarea" },
        { key: "source", label: "来源", type: "text" },
      ],
    },
  },
};

/**
 * 内置默认模板种子（PRD §FR-TPL-3 / O-3 已关闭）。
 * 首次初始化写入；之后与用户模板完全平级（可编辑/删除）。
 * templateName 用于设置 UI / 新建节点入口辨认模板；L1/L2/L3 名仍各自定义节点层级类型。
 */
const BUILTIN_TEMPLATE_SEEDS: TemplateInput[] = [
  DEFAULT_NODE_TEMPLATE_SEED,
  {
    templateName: "项目",
    layers: {
      1: { name: "项目集", fields: [] },
      2: {
        name: "项目",
        fields: [
          { key: "owner", label: "负责人", type: "text" },
          { key: "progress", label: "进度", type: "select", options: ["规划", "进行", "完成", "暂停"] },
          { key: "deadline", label: "截止", type: "date" },
          { key: "budget", label: "预算", type: "number" },
        ],
      },
      3: {
        name: "资料",
        fields: [
          { key: "kind", label: "类型", type: "select", options: ["需求", "设计", "会议", "交付", "其他"] },
          { key: "note", label: "备注", type: "textarea" },
        ],
      },
    },
  },
  {
    templateName: "资料",
    layers: {
      1: { name: "资料库", fields: [] },
      2: {
        name: "主题",
        fields: [
          { key: "domain", label: "领域", type: "text" },
          { key: "importance", label: "重要度", type: "select", options: ["低", "中", "高"] },
        ],
      },
      3: {
        name: "条目",
        fields: [
          { key: "tags", label: "标签", type: "text" },
          { key: "read", label: "已读", type: "boolean" },
        ],
      },
    },
  },
];

/**
 * 内置「日历」模板种子 —— 日历专属整理箱（L1 `_日历`/L2 年/L3 月）的模板链。
 * 不进 BUILTIN_TEMPLATE_SEEDS（init 的目录级 guard 会让已初始化的 workspace 拿不到它），
 * 由前端 nodes store 在首次打开日历时按需 createTemplate；三层均为纯组织层、无扩展字段。
 */
export const CALENDAR_TEMPLATE_SEED: TemplateInput = {
  templateName: "日历",
  layers: {
    1: { name: "日历库", fields: [] },
    2: { name: "年", fields: [] },
    3: { name: "月", fields: [] },
  },
};

/**
 * 首次使用初始化：`.eidon/templates/` 不存在时写入内置种子；已存在则 no-op。
 * 目录级 guard 保证「再开不重复初始化」且「删过的内置模板不复活」。
 */
export const initWorkspaceTemplates = async (
  store: TemplateStore,
): Promise<{ initialized: boolean; templateIds: string[] }> => {
  if (await store.exists(EIDON_TEMPLATES_DIR)) {
    return { initialized: false, templateIds: [] };
  }
  const templateIds: string[] = [];
  for (const seed of BUILTIN_TEMPLATE_SEEDS) {
    const created = await createTemplate(store, seed);
    templateIds.push(created.templateId);
  }
  return { initialized: true, templateIds };
};

/** 取某模板指定版本（默认最新）的三层；不存在或该版本不完整返回 null。 */
export const getTemplate = (
  store: TemplateStore,
  templateId: string,
  version?: number,
): Promise<Template | null> => readTemplateVersion(store, templateId, version);

/** 列出某模板已有版本号（升序）。版本不完整的文件集也会显示，getTemplate 可用于判定能否打开。 */
export const listTemplateVersions = async (
  store: TemplateStore,
  templateId: string,
): Promise<number[]> => {
  const versions = new Set<number>();
  for (const entry of await store.listDir(templateDir(templateId))) {
    if (entry.isDir) continue;
    const meta = parseTemplateLayerFileName(entry.name);
    if (meta) versions.add(meta.version);
  }
  return [...versions].sort((a, b) => a - b);
};

/**
 * 版本化不可变编辑：读最新版 → 以 version+1 写新版本三层文件，旧版本文件原样不动。
 * 模板 version 即节点记录的 schemaVersion（两者同步递增）；旧节点按其旧 schemaVersion 继续有效。
 */
export const editTemplate = async (
  store: TemplateStore,
  templateId: string,
  input: TemplateInput,
): Promise<Template> => {
  const current = await readTemplateVersion(store, templateId);
  if (!current) throw new Error(`template not found: ${templateId}`);
  const nextInput = {
    ...input,
    templateName: input.templateName?.trim() || current.templateName,
  };
  const version = current.version + 1;
  const layers = buildLayers(templateId, version, version, nextInput);
  await writeLayers(store, layers);
  return { templateId, templateName: normalizeTemplateName(nextInput), version, layers };
};

/**
 * 删除一套模板（移除其全部版本文件）→ 进入孤儿模板态。
 * 节点 `node.json.fields` 是裸键值（阶段0 已定），不依赖模板、删后不丢。
 * 不动 `.eidon/templates/` 父目录，故再 init 不会复活被删模板（写一次性 guard，见 initWorkspaceTemplates）。
 */
export const deleteTemplate = async (
  store: TemplateStore,
  templateId: string,
): Promise<void> => {
  await store.remove(templateDir(templateId));
};

/** 列出所有模板（各取最新版本的三层），按 templateId 稳定排序。 */
export const listTemplates = async (
  store: TemplateStore,
): Promise<Template[]> => {
  const templateIds = (await store.listDir(EIDON_TEMPLATES_DIR))
    .filter((e) => e.isDir)
    .map((e) => e.name)
    .sort();

  const templates: Template[] = [];
  for (const templateId of templateIds) {
    const template = await readTemplateVersion(store, templateId);
    if (template) templates.push(template);
  }
  return templates;
};

/** 列出无法解析为完整三层【节点】模板的目录，供设置 UI 做恢复/删除入口。 */
export const listInvalidTemplates = async (
  store: TemplateStore,
): Promise<InvalidTemplate[]> => {
  const templateIds = (await store.listDir(EIDON_TEMPLATES_DIR))
    .filter((e) => e.isDir)
    .map((e) => e.name)
    .sort();

  const invalid: InvalidTemplate[] = [];
  for (const templateId of templateIds) {
    const entries = await store.listDir(templateDir(templateId));
    const hasTemplateFiles = entries.some((entry) => !entry.isDir && parseTemplateLayerFileName(entry.name));
    if (!hasTemplateFiles) {
      invalid.push({ templateId, reason: "no template layer files found" });
      continue;
    }
    const template = await readTemplateVersion(store, templateId);
    if (!template) invalid.push({ templateId, reason: "latest version is incomplete or invalid" });
  }
  return invalid;
};
