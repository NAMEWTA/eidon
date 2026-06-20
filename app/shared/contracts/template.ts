import { z } from "zod";

import { LevelSchema, type Level } from "./node";

/** 模板字段类型：仅 6 种（见 AGENTS.md §3.2 / ADR-0013）。 */
export const FieldTypeSchema = z.enum([
  "text",
  "textarea",
  "number",
  "date",
  "select",
  "boolean",
]);
export type FieldType = z.infer<typeof FieldTypeSchema>;

/** 单个扩展字段定义。`select` 必须携带非空 `options`。 */
export const FieldDefSchema = z
  .object({
    key: z.string().min(1),
    label: z.string().min(1),
    type: FieldTypeSchema,
    options: z.array(z.string()).optional(),
    required: z.boolean().default(false),
  })
  .superRefine((field, ctx) => {
    if (field.type === "select" && (!field.options || field.options.length === 0)) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: "select field requires non-empty options",
      });
    }
  });
export type FieldDef = z.infer<typeof FieldDefSchema>;

/**
 * 单层模板文件的磁盘形状（磁盘契约单一事实源，见 ADR-0014）。
 * 一套模板 = 同 `templateId` 的三层文件捆绑（L1/L2/L3 各一份），版本化不可变：
 * 编辑生成新 `version`、旧文件不改（旧节点按其 `schemaVersion` 继续有效）。
 * 物理存放：`.eidon/templates/{templateId}/L{n}.{name}.v{ver}.json`（用 templateLayerPath 组合）。
 */
export const TemplateLayerSchema = z.object({
  templateId: z.string().min(1),
  templateName: z.string().min(1).optional(),
  level: LevelSchema,
  name: z.string().min(1),
  version: z.number().int().positive(),
  schemaVersion: z.number().int().positive(),
  fields: z.array(FieldDefSchema),
});
export type TemplateLayer = z.infer<typeof TemplateLayerSchema>;

/** EIDON 系统区目录名（见 AGENTS.md §2.3 / ADR-0017）。 */
export const EIDON_DIR = ".eidon";
/** 模板 schema 目录（相对 workspace 根）。 */
export const EIDON_TEMPLATES_DIR = `${EIDON_DIR}/templates`;

/** 单层模板文件名构造：`L{n}.{name}.v{ver}.json`。 */
export const templateLayerFileName = (input: {
  level: Level;
  name: string;
  version: number;
}): string => `L${input.level}.${input.name}.v${input.version}.json`;

// 解析 L{n}.{name}.v{ver}.json：name 允许含点，靠尾部 .v{ver}.json 锚定回溯。
const LAYER_FILE_PATTERN = /^L([123])\.(.+)\.v(\d+)\.json$/;

/** 解析单层模板文件名；不匹配返回 null（不抛，供扫描时跳过非模板文件）。 */
export const parseTemplateLayerFileName = (
  fileName: string,
): { level: Level; name: string; version: number } | null => {
  const match = LAYER_FILE_PATTERN.exec(fileName);
  if (!match) return null;
  return {
    level: Number(match[1]) as Level,
    name: match[2],
    version: Number(match[3]),
  };
};

/** 组合单层模板文件的 workspace 相对路径。 */
export const templateLayerPath = (
  templateId: string,
  input: { level: Level; name: string; version: number },
): string =>
  `${EIDON_TEMPLATES_DIR}/${templateId}/${templateLayerFileName(input)}`;
