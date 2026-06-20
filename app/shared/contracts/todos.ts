import { z } from "zod";

import { NodeIdSchema } from "./node";

/**
 * `.node/todos.json` 形状（磁盘契约单一事实源，见 ADR-0005/0014）。
 *
 * 节点级待办清单 + 定时提醒：随节点目录移动/删除而跟随，满足「可重建/可迁移」铁律
 * （AGENTS.md §5）。**不**塞进 `node.json`：其 fields 只容 6 类标量、flags 只容布尔，
 * 装不下 todo 对象数组（见 ADR-0013 / `contracts/node.ts`）。
 *
 * id 一律复用节点身份 ULID 形状（`NodeIdSchema`）：单调递增 → 字典序=创建顺序，排序稳定、
 * 删缓存重建顺序可复现。全字段带 `.default(...)`：最小文件/手改/旧写入器仍能解析。
 */

/** 提醒重复规则：本期仅 4 种（自定义 RRULE/工作日不在范围，见计划「明确不做」）。 */
export const ReminderRepeatSchema = z.enum(["once", "daily", "weekly", "monthly"]);
export type ReminderRepeat = z.infer<typeof ReminderRepeatSchema>;

/**
 * 单条提醒：fireAt = 下次触发的墙钟时刻（ISO 8601，本地时区由序列化方决定）。
 * notified = 该次已派发标记，避免重启/重扫后重复轰炸；重复提醒触发后由调度器把 fireAt
 * 滚动到下一周期并复位 notified（见 `core/todos` 的 nextFireTime）。
 */
export const ReminderSchema = z.object({
  id: NodeIdSchema,
  fireAt: z.string().datetime(),
  repeat: ReminderRepeatSchema.default("once"),
  notified: z.boolean().default(false),
});
export type Reminder = z.infer<typeof ReminderSchema>;

/** 待办优先级：仅作 UI 排序/着色，不参与提醒调度。 */
export const TodoPrioritySchema = z.enum(["low", "normal", "high"]);
export type TodoPriority = z.infer<typeof TodoPrioritySchema>;

/** 单条待办：done=完成态；due=可选截止日（仅展示/分组，与提醒解耦）；reminders=该项的提醒列表。 */
export const TodoItemSchema = z.object({
  id: NodeIdSchema,
  text: z.string(),
  done: z.boolean().default(false),
  createdAt: z.string().datetime(),
  due: z.string().datetime().nullable().default(null),
  priority: TodoPrioritySchema.default("normal"),
  reminders: z.array(ReminderSchema).default([]),
});
export type TodoItem = z.infer<typeof TodoItemSchema>;

/**
 * 整份 `.node/todos.json`：
 * - version 固定 1（后续演进留迁移位）。
 * - nodeId 冗余存所属节点身份：便于孤儿检测与「文件被搬错目录」时核对。
 * - updatedAt 每次写盘刷新（最后修改时间）。
 */
export const NodeTodoFileSchema = z.object({
  version: z.literal(1),
  nodeId: NodeIdSchema,
  updatedAt: z.string().datetime(),
  items: z.array(TodoItemSchema).default([]),
});
export type NodeTodoFile = z.infer<typeof NodeTodoFileSchema>;
