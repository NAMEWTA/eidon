/**
 * EIDON AI 接入点（占位）。
 *
 * 原 SoloMD 的 AI·Agent·Recipes 子系统已整块物理删除（见工程层 ADR-0019，
 * 范围决策见 ADR-0018），本模块仅保留未来接入任意 AI provider 所需的最小
 * 接口契约。接入步骤与历史实现的找回路径见本目录 `README.md`。
 *
 * 约束（与 AGENTS.md §2.1 一致）：本模块属 core 层，禁止 import 任何 UI
 * 框架；如需 Rust 能力，经 `core/bridge/` 新增 typed wrapper，不在此直连。
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
  /** Provider 标识，如 "openai" / "anthropic" / "ollama" / 自定义。 */
  provider: string;
  apiFormat: ApiFormat;
  model: string;
  /** 自定义 API 端点；空值时由实现取该 apiFormat 的默认 base URL。 */
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

/** 「AI 未接入」错误：占位实现统一抛此错，调用方可 instanceof 识别。 */
export class AiNotConnectedError extends Error {
  constructor() {
    super(
      "AI is not connected in EIDON. See core/ai/README.md for the extension contract.",
    );
    this.name = "AiNotConnectedError";
  }
}

/** 能力探测：接入实现后翻转为 true。UI 据此隐藏/禁用一切 AI 入口。 */
export const isAiAvailable = (): boolean => false;

/**
 * 唯一聊天入口（签名沿用原 runChatLoop）。
 * 未接入时立即抛 {@link AiNotConnectedError}。
 */
export const runChatLoop = async (
  _request: ChatLoopRequest,
  _onEvent: StreamHandler,
): Promise<ChatLoopResult> => {
  throw new AiNotConnectedError();
};

/** 取消进行中的请求（按 requestId）。未接入时为 no-op。 */
export const cancelChat = async (_requestId: string): Promise<void> => {
  // 占位：无进行中的请求可取消。
};
