/**
 * shared/models/ai —— AI 接入点的纯类型（占位）。
 * 错误类与占位实现见 backend/domain/ai（AiNotConnectedError / runChatLoop / isAiAvailable）。
 * 历史背景见 AGENTS.md §6 / ADR-0018/0019。
 */
import type {
  ModelRef,
  ModelMeta,
  ThinkingLevel,
  AgentVisibility,
  AgentConfig,
  BridgePlatform,
  CronJobType,
} from "../contracts";

/** 新建定时任务入参（IPC）。 */
export type CronJobInput = {
  label?: string;
  type: CronJobType;
  /** at=ISO 时刻；every=间隔分钟；cron=5 段表达式。 */
  schedule: string;
  prompt: string;
};

/** 编辑定时任务补丁（IPC）。 */
export type CronJobPatch = {
  label?: string;
  type?: CronJobType;
  schedule?: string;
  prompt?: string;
  enabled?: boolean;
};
// 便捷再导出：磁盘契约定义的 AI 标量类型也从 @shared/models 出口（同一类型，非重复定义），
// 使 AI 子系统四层只需从一处 import 全部 wire 类型。
export type {
  ModelRef,
  ThinkingLevel,
  ModelParams,
  AgentVisibility,
  AgentConfig,
  BridgePlatform,
  BridgeBinding,
  CronJob,
  CronJobType,
} from "../contracts";

/** 上游 API 的报文格式。接入新 provider 时可扩展字符串字面量。 */
export type ApiFormat = "anthropic" | "openai" | "ollama" | (string & {});

/** 一条对话消息（与主流 chat API 的 message 同形）。 */
export type ChatMessage = {
  role: "system" | "user" | "assistant" | (string & {});
  content: string;
};

/** Provider 静态配置（未来由设置层提供）。 */
export type AiProviderConfig = {
  provider: string;
  apiFormat: ApiFormat;
  model: string;
  baseUrl?: string | null;
};

/** 流式回调事件。 */
export type StreamEvent =
  | { type: "text"; text: string }
  | { type: "done"; fullText: string }
  | { type: "error"; error: string };

export type StreamHandler = (event: StreamEvent) => void;

/** 一次聊天调用的完整请求。requestId 供取消（cancel）通道使用。 */
export type ChatLoopRequest = AiProviderConfig & {
  messages: ChatMessage[];
  requestId: string;
};

export type ChatLoopResult = {
  text: string;
  tokensIn?: number;
  tokensOut?: number;
};

/* ─────────────────────────────────────────────────────────────────────────
 * AI-Native 子系统 wire/UI 类型（camelCase；frontend/bridge/backend 皆 import）。
 * 磁盘形状（AgentConfig / ProvidersFile / CronJob / Channel）在 shared/contracts/ai。
 * ──────────────────────────────────────────────────────────────────────── */

/** provider 列表项（设置面板「模型提供商」用）。configured=已配 API key。 */
export type ProviderInfo = {
  id: string;
  label: string;
  configured: boolean;
  enabled: boolean;
  baseUrl: string | null;
  /** 上游报文格式覆盖（`null` = 用前端目录/pi 默认）；供应商详情「API 类型」下拉读写。 */
  api: string | null;
  /** 自定义请求头（两栏 provider 详情可编辑）。 */
  headers: Record<string, string>;
  /** 已添加模型的逐模型元数据覆盖（key=模型 id）；供应商详情「已添加模型」列表用。 */
  models: Record<string, ModelMeta>;
};

/** 可选模型项（由 pi-ai 的 Model 投影出的 wire 形状）。 */
export type ModelInfo = {
  provider: string;
  id: string;
  name: string;
  reasoning: boolean;
  contextWindow: number;
  input: ("text" | "image")[];
};

/** Agent 摘要（列表 / 团队花名册 / @agent 选择器用）。 */
export type AgentSummary = {
  id: string;
  name: string;
  description: string;
  avatar: string | null;
  /** null = 继承全局默认模型。 */
  model: ModelRef | null;
  visibility: AgentVisibility;
  activatableByAgents: boolean;
};

/** 新建 Agent 的入参。 */
export type CreateAgentInput = {
  name: string;
  description?: string;
  /** 身份简介正文（写 identity.md）；省略用默认。 */
  persona?: string;
  /** 意识正文（写 ishiki.md，详细人格）。 */
  ishiki?: string;
  model?: ModelRef | null;
  visibility?: AgentVisibility;
  activatableByAgents?: boolean;
  /** 源人格模板键（可选）。 */
  yuan?: string | null;
};

/**
 * 编辑 Agent 的补丁（仅传需改字段）。人格相关正文走同目录 markdown：
 * `persona`→identity.md（身份简介）、`ishiki`→ishiki.md（意识）、`pinned`→pinned.md（置顶）、
 * `experienceText`→experience.md（经验正文）、`experienceEnabled`→config.experience.enabled。
 */
export type UpdateAgentPatch = {
  name?: string;
  description?: string;
  persona?: string;
  ishiki?: string;
  pinned?: string;
  experienceText?: string;
  experienceEnabled?: boolean;
  /** 头像（data URL 或文件名）；`null` 清除。 */
  avatar?: string | null;
  yuan?: string | null;
  model?: ModelRef | null;
  thinkingLevel?: ThinkingLevel;
  temperature?: number | null;
  visibility?: AgentVisibility;
  activatableByAgents?: boolean;
  channelsEnabled?: boolean;
  tools?: { enabled: string[]; disabled: string[] };
  skills?: { enabled: string[] };
};

/** Agent 完整资料（编辑用）：config + 各人格相关正文（identity/ishiki/经验/置顶）。 */
export type AgentDetail = {
  config: AgentConfig;
  /** identity.md（身份简介）。 */
  persona: string;
  /** ishiki.md（意识）。 */
  ishiki: string;
  /** experience.md（经验正文）。 */
  experience: string;
  /** pinned.md（置顶记忆）。 */
  pinned: string;
};

/** 工具项（全局工具管理 + per-agent 开关）。 */
export type ToolInfo = {
  name: string;
  /** 简述（来自内置工具集）。 */
  description: string;
  /** 全局是否启用。 */
  enabled: boolean;
};

/** Skill 项（ResourceLoader 发现；composer `/skill:` 菜单用）。 */
export type SkillInfo = {
  name: string;
  description: string;
};

/**
 * Agent 后台活动（cron 完成 / agent 主动 notify / 子 Agent 调用）→ 经 `eidon:agent-activity` 推送。
 * 渲染层据此弹 Toast + 系统通知（关窗隐藏到托盘时渲染进程仍存活，故仍可回灌）。
 */
export type AgentActivity = {
  kind: "cron" | "notify" | "subagent";
  agentId: string;
  agentName: string;
  /** 标题（任务标签 / 通知标题）。 */
  label: string;
  status: "success" | "error";
  /** 结果/正文摘要（已截断）。 */
  summary: string;
  /** true=发系统通知；false=仅应用内 Toast。 */
  notify: boolean;
  at: string;
};

/**
 * 会话权限档（工具门控的真相源；运行时可切换，见 backend/domain/ai/tool-gate）。
 *  - `operate`   完整权限：所有工具直接执行。
 *  - `auto`      自动审核：副作用工具自动执行，但工具卡片显式呈现（默认档）。
 *  - `ask`       操作前询问：副作用工具执行前暂停、等用户在对话内批准。
 *  - `read_only` 只读模式：拒绝一切副作用工具，并把原因回灌给模型。
 */
export type SessionPermissionMode = "operate" | "auto" | "ask" | "read_only";

/** 会话状态快照（经 `eidon:ai-session` 推送给渲染层）。 */
export type AiSessionState = {
  sessionId: string;
  agentId: string;
  model: ModelRef | null;
  thinkingLevel: ThinkingLevel;
  isStreaming: boolean;
  messageCount: number;
  /** 当前会话的工具权限档。 */
  permissionMode: SessionPermissionMode;
};

/**
 * 历史会话摘要（`ai:listSessions` 返回；投影自 pi 的 `SessionInfo`）。
 * 供「标题栏历史浮层」列出可续聊的会话。
 */
export type AiSessionSummary = {
  /** 会话持久化文件绝对路径（续聊时回传给 `ai:loadSession`）。 */
  sessionFile: string;
  id: string;
  /** 展示标题：用户命名 `name` 优先，否则取首条消息截断。 */
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
};

/**
 * 历史消息 wire 形状（`ai:loadSession` 返回，供渲染层重建对话视图）。
 * 与 store 的 ChatMessage/ChatPart 同形（store 的 tool part 额外带运行期 `approval` 字段）。
 */
export type ChatPartWire =
  | { type: "text"; text: string }
  | { type: "thinking"; text: string }
  | {
      type: "tool";
      toolCallId: string;
      toolName: string;
      args?: unknown;
      result: string;
      isError: boolean;
      done: boolean;
    };

export type ChatMessageWire = {
  id: string;
  role: "user" | "assistant";
  parts: ChatPartWire[];
  agentName?: string;
};

/* ─────────────────────────────────────────────────────────────────────────
 * 多平台桥接（P4）wire 类型（飞书 + 微信官方 iLink）。
 * 磁盘形状（BridgeBinding / BridgeBindingsFile）在 shared/contracts/ai；凭证在 auth.json 的 bridge 段。
 * ──────────────────────────────────────────────────────────────────────── */

/** 单平台运行态。 */
export type BridgeRuntimeState = "idle" | "connecting" | "online" | "error" | "disconnected";

/** 单平台状态快照（经 `eidon:bridge-status` 推送 + `bridge:status` 返回）。 */
export type BridgeStatus = {
  platform: BridgePlatform;
  agentId: string | null;
  enabled: boolean;
  /** 是否已存凭证（飞书 appId/appSecret 已填；微信已扫码登录）。 */
  configured: boolean;
  state: BridgeRuntimeState;
  error: string | null;
};

/** 外部平台入站提示（经 `eidon:bridge-inbound` 推送，仅供 UI 感知，不含正文）。 */
export type BridgeInbound = {
  platform: BridgePlatform;
  agentId: string;
  userId: string;
  preview: string;
};

/** 微信扫码登录态（经 `eidon:bridge-wechat-qr` 推送）。 */
export type WechatLoginState = {
  status: "pending" | "waiting" | "scanned" | "confirmed" | "expired" | "error";
  /** 二维码 data URL（base64 PNG）；status=pending/waiting 时有。 */
  qrDataUrl?: string;
  error?: string;
};

/**
 * 流式事件 wire 形状（经 `eidon:ai-stream` 由 main 推送给渲染层）。
 * backend 订阅 pi 的 `AgentSessionEvent` 后投影为此扁平联合，渲染层据 `kind` 增量拼装 UI。
 */
export type AiStreamEvent =
  | { kind: "message_start"; sessionId: string; agentName?: string }
  | { kind: "text_delta"; sessionId: string; delta: string }
  | { kind: "thinking_delta"; sessionId: string; delta: string }
  // tool_start 携带工具入参 args（pi 的 tool_execution_start 已带，供前端展开查看）。
  | { kind: "tool_start"; sessionId: string; toolCallId: string; toolName: string; args?: unknown }
  | { kind: "tool_update"; sessionId: string; toolCallId: string; chunk: string }
  // tool_end 携带最终结果 result（pi 的 tool_execution_end 已带，截断后透传）。
  | { kind: "tool_end"; sessionId: string; toolCallId: string; isError: boolean; result?: string }
  // tool_approval：ask 档下副作用工具执行前请求用户批准（前端在工具卡片内出批准/拒绝）。
  | { kind: "tool_approval"; sessionId: string; toolCallId: string; toolName: string; args?: unknown }
  | { kind: "message_end"; sessionId: string }
  | { kind: "done"; sessionId: string }
  | { kind: "error"; sessionId: string; message: string };
