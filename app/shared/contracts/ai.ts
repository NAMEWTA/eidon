import { z } from "zod";

/**
 * AI-Native 子系统的磁盘契约「单一事实源」（见 ADR-0005/0014）。
 *
 * 这些形状落在**全局** AI 主目录 `~/.eidon/`（决策 Q1：Agent 是跨工作区常驻助手）：
 *  - `~/.eidon/agents/{id}/config.json`       单个 Agent 配置（{@link AgentConfigSchema}）
 *  - `~/.eidon/agents/{id}/cron-jobs.json`    单个 Agent 的定时任务（{@link CronJobsFileSchema}）
 *  - `~/.eidon/providers.json`                模型提供商配置 + 全局默认模型（{@link ProvidersFileSchema}）
 *  - `~/.eidon/auth.json`                     凭证（gitignored；{@link AuthFileSchema}）—— EIDON 自管，
 *                                             不复用 pi SDK 的 auth.json 格式；运行期经 `setRuntimeApiKey` 注入。
 *  - `~/.eidon/channels.json`                 多 Agent 群聊频道（{@link ChannelsFileSchema}）
 *  - `~/.eidon/bridge.json`                   平台桥接绑定（{@link BridgeBindingsFileSchema}）；凭证在 auth.json 的 bridge 段
 *  - `~/.eidon/agents/{id}/{ishiki,experience,pinned}.md`  意识/经验/置顶记忆正文（随 config.json 同目录，便于 diff/备份）
 *
 * 全字段带 `.default(...)`：最小文件 / 手改 / 旧写入器仍能解析（满足「可重建」铁律，AGENTS.md §5）。
 * 改形状先改本文件 + `fixtures/contracts/`，再改解析（机器强制，见 AGENTS.md §4.2）。
 */

/**
 * Agent / Cron job / Channel 身份 ULID（与 `contracts/node.ts` 的 `NodeIdSchema` 同形）。
 * 两处独立持有正则以维持 shared 为纯叶子（见 `utils/id.ts` 的同款注释）。
 */
export const AiIdSchema = z
  .string()
  .regex(/^[0-9A-HJKMNP-TV-Z]{26}$/, "must be a 26-char Crockford base32 ULID");
export type AiId = z.infer<typeof AiIdSchema>;

/** 推理强度：与 pi-ai 的 `ThinkingLevel` 对齐，额外含 `off`（关闭思考）。 */
export const ThinkingLevelSchema = z.enum([
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
]);
export type ThinkingLevel = z.infer<typeof ThinkingLevelSchema>;

/** 模型引用：pi 的复合键 `provider + 模型 id`（如 `anthropic` / `claude-sonnet-4-6`）。 */
export const ModelRefSchema = z.object({
  provider: z.string().min(1),
  id: z.string().min(1),
});
export type ModelRef = z.infer<typeof ModelRefSchema>;

/** 生成参数：每 Agent 默认值，用户可在单次会话临时覆盖。 */
export const ModelParamsSchema = z.object({
  thinkingLevel: ThinkingLevelSchema.default("medium"),
  temperature: z.number().min(0).max(2).nullable().default(null),
});
export type ModelParams = z.infer<typeof ModelParamsSchema>;

/**
 * Agent 可见性（「是否允许被其他 Agent 激活调用」开关的真相源）：
 *  - `public`  = 出现在团队花名册，可被其他 Agent 发现并作为子 Agent 调用（受 `activatableByAgents` 再约束）。
 *  - `private` = 仅用户直接对话，不进入花名册、不可被委派。
 */
export const AgentVisibilitySchema = z.enum(["public", "private"]);
export type AgentVisibility = z.infer<typeof AgentVisibilitySchema>;

/**
 * 单个 Agent 的 `config.json`。人格相关正文不在此处，存同目录 markdown（参考 HanaAgent「Agent=文件夹」）：
 *  - `identity.md`   身份简介（短，也进团队花名册）
 *  - `ishiki.md`     意识（详细人格/语气/行为，系统提示主体；含 `{{userName}}/{{agentName}}` 模板）
 *  - `experience.md` 经验（分类 markdown，`# 类目` + 编号条目；受 `experience.enabled` 门控）
 *  - `pinned.md`     置顶记忆（自由 markdown 列表，永不衰减，直接注入上下文）
 */
export const AgentConfigSchema = z.object({
  version: z.literal(1),
  id: AiIdSchema,
  name: z.string().min(1),
  /** 一句话简介：注入团队花名册供其他 Agent 判断是否委派。 */
  description: z.string().default(""),
  /** 头像（相对 `avatars/` 的文件名或 data URL）。 */
  avatar: z.string().nullable().default(null),
  /** 默认模型；`null` = 继承 `providers.json` 的全局 `defaultModel`。 */
  model: ModelRefSchema.nullable().default(null),
  // 注意：zod v4 的 `.default(v)` 在输入缺省时**原样返回 v、不再过 schema**，故嵌套对象
  // 的整体缺省必须给出「完整」默认值（内层 `.default` 仅在该对象被显式提供时生效）。
  params: ModelParamsSchema.default({ thinkingLevel: "medium", temperature: null }),
  /** 工具白/黑名单（基于全局工具集；空 enabled = 用默认集）。 */
  tools: z
    .object({
      enabled: z.array(z.string()).default([]),
      disabled: z.array(z.string()).default([]),
    })
    .default({ enabled: [], disabled: [] }),
  /** 启用的 skill 名（per-agent；全局 skill 管理见设置）。 */
  skills: z
    .object({ enabled: z.array(z.string()).default([]) })
    .default({ enabled: [] }),
  /** 启用的命令名（per-agent）。 */
  commands: z
    .object({ enabled: z.array(z.string()).default([]) })
    .default({ enabled: [] }),
  visibility: AgentVisibilitySchema.default("private"),
  /** 二次确认开关：即便 public，也只有此值为 true 才真正允许被其他 Agent 激活为子 Agent。 */
  activatableByAgents: z.boolean().default(false),
  /** 是否参与多 Agent 群聊频道轮转。 */
  channelsEnabled: z.boolean().default(false),
  /** 经验库开关（per-agent；正文存同目录 `experience.md`）。默认关闭，避免污染上下文。 */
  experience: z
    .object({ enabled: z.boolean().default(false) })
    .default({ enabled: false }),
  /** 源人格模板键（可选；新建时的预设人格底座，如 "default"）。`null` = 无模板。 */
  yuan: z.string().nullable().default(null),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type AgentConfig = z.infer<typeof AgentConfigSchema>;

/**
 * 单个模型的用户侧元数据覆盖（逐模型编辑面板写入）：覆盖 pi-ai 内置模型表的展示名/上下文/能力。
 * 全字段可空/默认 → 仅记录用户改过的值，其余继承内置。
 */
export const ModelMetaSchema = z.object({
  /** 展示名（覆盖内置 name）。 */
  displayName: z.string().nullable().default(null),
  /** 上下文长度（token）。 */
  context: z.number().int().positive().nullable().default(null),
  /** 最大输出（token）。 */
  maxOutput: z.number().int().positive().nullable().default(null),
  /** 能力开关（覆盖内置 input/能力推断）。 */
  image: z.boolean().default(false),
  video: z.boolean().default(false),
  audio: z.boolean().default(false),
  reasoning: z.boolean().default(false),
});
export type ModelMeta = z.infer<typeof ModelMetaSchema>;

/** 单个 provider 的非凭证配置（凭证在 `auth.json`）。 */
export const ProviderConfigSchema = z.object({
  enabled: z.boolean().default(true),
  /** 自定义 baseUrl（自托管/代理网关）；`null` = 用内置默认。 */
  baseUrl: z.string().nullable().default(null),
  /**
   * 上游报文格式覆盖（如 `openai-completions` / `anthropic-messages` / `google-generative-ai`）。
   * `null` = 用前端供应商目录/pi 内置默认。供应商详情「API 类型」下拉写入。
   */
  api: z.string().nullable().default(null),
  /** 自定义请求头（如鉴权代理网关需要的额外 header）。 */
  headers: z.record(z.string(), z.string()).default({}),
  /** 逐模型元数据覆盖：模型 id → {@link ModelMeta}。 */
  models: z.record(z.string(), ModelMetaSchema).default({}),
});
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

/** `~/.eidon/providers.json`：provider 配置 + 全局默认模型。 */
export const ProvidersFileSchema = z.object({
  version: z.literal(1),
  /** 新建 Agent / Agent 未指定模型时的回退模型。 */
  defaultModel: ModelRefSchema.nullable().default(null),
  providers: z.record(z.string(), ProviderConfigSchema).default({}),
});
export type ProvidersFile = z.infer<typeof ProvidersFileSchema>;

/**
 * `~/.eidon/auth.json`（**gitignored**）：provider → API key。
 * EIDON 自管此文件；运行期读出后经 pi 的 `AuthStorage.setRuntimeApiKey` 注入内存，
 * 不依赖 pi 的 auth.json 落盘格式（保持本契约为凭证真相源）。
 */
export const AuthFileSchema = z.object({
  version: z.literal(1),
  keys: z.record(z.string(), z.string()).default({}),
  /**
   * 平台桥接凭证：platform → { 字段名: 值 }（飞书 `appId`/`appSecret`、微信 `botToken`/`baseUrl`）。
   * 与 provider API key 同处此 gitignored 文件，集中收紧权限。
   */
  bridge: z
    .record(z.string(), z.record(z.string(), z.string()))
    .default({}),
});
export type AuthFile = z.infer<typeof AuthFileSchema>;

/**
 * 定时任务类型（「何时触发」与「做什么」分离，参考 HanaAgent cron-scheduler）：
 *  - `at`    = 一次性，`schedule` 为 ISO 8601 墙钟时刻。
 *  - `every` = 周期，`schedule` 为间隔分钟数（字符串）。
 *  - `cron`  = 标准 5 段 cron 表达式。
 */
export const CronJobTypeSchema = z.enum(["at", "every", "cron"]);
export type CronJobType = z.infer<typeof CronJobTypeSchema>;

/** 单条定时任务：`prompt` = 触发时发给该 Agent 的指令。 */
export const CronJobSchema = z.object({
  id: AiIdSchema,
  label: z.string().default(""),
  type: CronJobTypeSchema,
  schedule: z.string().min(1),
  prompt: z.string().min(1),
  enabled: z.boolean().default(true),
  /** 下次触发墙钟（调度器据此判定到期；`null` 时由调度器据 type/schedule 计算）。 */
  nextRunAt: z.string().datetime().nullable().default(null),
  lastRunAt: z.string().datetime().nullable().default(null),
  createdAt: z.string().datetime(),
});
export type CronJob = z.infer<typeof CronJobSchema>;

/** `~/.eidon/agents/{id}/cron-jobs.json`：单 Agent 的定时任务集。 */
export const CronJobsFileSchema = z.object({
  version: z.literal(1),
  agentId: AiIdSchema,
  jobs: z.array(CronJobSchema).default([]),
});
export type CronJobsFile = z.infer<typeof CronJobsFileSchema>;

/** 多 Agent 群聊频道：`members` 为 Agent id 列表（参考 HanaAgent `ch_{id}.md`）。 */
export const ChannelSchema = z.object({
  id: AiIdSchema,
  name: z.string().min(1),
  members: z.array(AiIdSchema).default([]),
  createdAt: z.string().datetime(),
});
export type Channel = z.infer<typeof ChannelSchema>;

/** `~/.eidon/channels.json`：全部频道。 */
export const ChannelsFileSchema = z.object({
  version: z.literal(1),
  channels: z.array(ChannelSchema).default([]),
});
export type ChannelsFile = z.infer<typeof ChannelsFileSchema>;

/** `~/.eidon/tools.json`：全局工具管理（被禁用的内置工具名；其余默认可用）。 */
export const ToolsFileSchema = z.object({
  version: z.literal(1),
  disabled: z.array(z.string()).default([]),
});
export type ToolsFile = z.infer<typeof ToolsFileSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * 多平台桥接（P4）：把某 Agent 接到外部 IM 平台（飞书 + 微信官方 iLink + Telegram）。
 * 凭证不在此处——飞书 appId/appSecret、微信 botToken/baseUrl、Telegram token 落 `auth.json` 的 `bridge` 段。
 * ──────────────────────────────────────────────────────────────────────── */

/** 桥接平台标识（飞书 + 微信官方 iLink + Telegram；后续加平台只扩此枚举 + 适配器）。 */
export const BridgePlatformSchema = z.enum(["feishu", "wechat", "telegram"]);
export type BridgePlatform = z.infer<typeof BridgePlatformSchema>;

/** 单条平台绑定：某平台 ↔ 某 Agent。`agentId=null` 表示未绑定（该平台不可启用）。 */
export const BridgeBindingSchema = z.object({
  platform: BridgePlatformSchema,
  agentId: AiIdSchema.nullable().default(null),
  enabled: z.boolean().default(false),
  label: z.string().default(""),
});
export type BridgeBinding = z.infer<typeof BridgeBindingSchema>;

/** `~/.eidon/bridge.json`：全部平台绑定（仅非密元数据；凭证在 `auth.json`）。 */
export const BridgeBindingsFileSchema = z.object({
  version: z.literal(1),
  bindings: z.array(BridgeBindingSchema).default([]),
});
export type BridgeBindingsFile = z.infer<typeof BridgeBindingsFileSchema>;
