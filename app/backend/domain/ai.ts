/**
 * EIDON AI 接入点（占位实现 + 错误类）。类型契约见 shared/models/ai。
 *
 * 原 SoloMD 的 AI·Agent·Recipes 子系统已整块物理删除（见 ADR-0018/0019），本模块仅保留
 * 占位实现：翻转 isAiAvailable、实现 runChatLoop 即接入。接入步骤见同目录 ai-README.md。
 */
import type {
  ChatLoopRequest,
  ChatLoopResult,
  StreamHandler,
} from "@shared/models";

/** 「AI 未接入」错误：占位实现统一抛此错，调用方可 instanceof 识别。 */
export class AiNotConnectedError extends Error {
  constructor() {
    super(
      "AI is not connected in EIDON. See backend/domain/ai-README.md for the extension contract.",
    );
    this.name = "AiNotConnectedError";
  }
}

/** 能力探测：接入实现后翻转为 true。UI 据此隐藏/禁用一切 AI 入口。 */
export const isAiAvailable = (): boolean => false;

/**
 * 唯一聊天入口（签名沿用原 runChatLoop）。未接入时立即抛 {@link AiNotConnectedError}。
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
