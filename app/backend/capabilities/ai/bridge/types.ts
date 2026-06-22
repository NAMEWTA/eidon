/**
 * capabilities/ai/bridge/types —— 桥接适配器统一接口（纯 node；参考 HanaAgent `lib/bridge`）。
 *
 * 每个平台适配器把外部 IM 收发统一为 EIDON 语义：入站经 `onMessage` 回调，状态经 `onStatus`，
 * 出站经 `sendText`。适配器内部自管平台细节（飞书长连重连 / 微信 context_token 缓存）。
 * **禁 import electron / Pi SDK**——编排（找 Agent 会话、prompt）在 services/ai-service。
 */
import type { BridgePlatform } from "@shared/contracts";
import type { BridgeRuntimeState } from "@shared/models";

/** 一条入站消息（已抽取为纯文本）。 */
export interface BridgeInboundMessage {
  platform: BridgePlatform;
  /** 回发目标（飞书=chat_id；微信=对端 ilink_user_id）。 */
  chatId: string;
  userId: string;
  senderName: string;
  text: string;
  isGroup: boolean;
}

/** 适配器实例。 */
export interface BridgeAdapter {
  start(): Promise<void>;
  stop(): Promise<void>;
  /** 回发文本（微信由适配器内部用最近 context_token；无可回复上下文时抛错）。 */
  sendText(chatId: string, text: string): Promise<void>;
}

/** 适配器构造依赖（由 service 注入）。 */
export interface BridgeAdapterDeps {
  /** 平台凭证（飞书 appId/appSecret；微信 botToken/baseUrl）。 */
  creds: Record<string, string>;
  onMessage: (msg: BridgeInboundMessage) => void;
  onStatus: (state: BridgeRuntimeState, error?: string) => void;
  /** 运行态数据目录（微信 cursor/context 持久化根；= aiHome/bridge）。 */
  dataDir: string;
}

export type { BridgeRuntimeState };
