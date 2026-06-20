/**
 * shared/models/ai —— AI 接入点的纯类型（占位）。
 * 错误类与占位实现见 backend/domain/ai（AiNotConnectedError / runChatLoop / isAiAvailable）。
 * 历史背景见 AGENTS.md §6 / ADR-0018/0019。
 */

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
