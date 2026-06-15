import { z } from "zod";

/**
 * 节点身份：26 字符 Crockford base32 ULID（排除 I/L/O/U）。
 * 生成与校验逻辑在 `core/shared/id`（createNodeId/isNodeId）；此处只钉死磁盘上的字符串形状。
 */
export const NodeIdSchema = z
  .string()
  .regex(/^[0-9A-HJKMNP-TV-Z]{26}$/, "must be a 26-char Crockford base32 ULID");
export type NodeId = z.infer<typeof NodeIdSchema>;

/**
 * 三层【节点】层级：物理深度唯一确定 L1/L2/L3（深度=层级铁律，见 AGENTS.md §3.1 / ADR-0013）。
 * 第 4 层起为自由文件夹（无身份），不在节点契约范围。
 */
export const LevelSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export type Level = z.infer<typeof LevelSchema>;

/** 字段值：6 类模板字段（text/textarea/number/date/select/boolean）落盘后的标量取值。 */
export const FieldValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);
export type FieldValue = z.infer<typeof FieldValueSchema>;

/**
 * `.node/node.json` 形状（磁盘契约单一事实源，见 ADR-0014）。
 * - 元字段（固定、用户不可增删）：id / templateId / level / type / schemaVersion / createdAt / flags。
 * - 扩展字段（模板定义、可懒迁移）：fields。
 * - 前向预留（本期空值）：references —— 为后续链接能力零成本衔接（缺省即解析为 []）。
 *
 * references/flags 设默认值：缺字段的最小 node.json（旧写入器/手改/删缓存重建）仍能解析。
 */
export const NodeSchema = z.object({
  id: NodeIdSchema,
  templateId: z.string().min(1),
  level: LevelSchema,
  type: z.string().min(1),
  schemaVersion: z.number().int().positive(),
  createdAt: z.string().datetime(),
  fields: z.record(z.string(), FieldValueSchema).default({}),
  references: z.array(z.string()).default([]),
  flags: z.record(z.string(), z.boolean()).default({}),
});
export type Node = z.infer<typeof NodeSchema>;
