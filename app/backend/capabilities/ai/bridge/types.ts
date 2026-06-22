/**
 * capabilities/ai/bridge/types —— 桥接适配器统一接口（纯 node；参考 HanaAgent `lib/bridge`）。
 *
 * 每个平台适配器把外部 IM 收发统一为 EIDON 语义：入站经 `onMessage` 回调，状态经 `onStatus`，
 * 出站经 `sendText`。适配器内部自管平台细节（飞书长连重连 / 微信 context_token 缓存）。
 * **禁 import electron / Pi SDK**——编排（找 Agent 会话、prompt）在 services/ai-service。
 */
import type { BridgePlatform } from "@shared/contracts";
import type { BridgeRuntimeState } from "@shared/models";

/** 一条入站附件（P3 媒体；P1 仅预留字段，暂不产出/消费）。 */
export interface BridgeInboundAttachment {
  type: "image" | "file" | "video";
  /** 平台引用（微信=加密 query param + aes_key 的 JSON），下载时回传给适配器。 */
  platformRef: string;
  mimeType?: string;
  filename?: string;
  size?: number;
}

/** 一条入站消息（文本 + 可选附件）。 */
export interface BridgeInboundMessage {
  platform: BridgePlatform;
  /** 回发目标（飞书=chat_id；微信=对端 ilink_user_id）。 */
  chatId: string;
  userId: string;
  senderName: string;
  text: string;
  isGroup: boolean;
  /** 入站媒体附件（P3）。 */
  attachments?: BridgeInboundAttachment[];
}

/** 适配器实例。可选方法（typing/canReply）按平台能力实现，不支持则省略。 */
export interface BridgeAdapter {
  start(): Promise<void>;
  stop(): Promise<void>;
  /** 回发文本（微信由适配器内部用最近 context_token；无可回复上下文时抛错）。 */
  sendText(chatId: string, text: string): Promise<void>;
  /** 是否可主动回复该会话（微信受 24h context_token 窗口约束）。 */
  canReply?(chatId: string): boolean;
  /** 发送「正在输入」状态（best-effort；微信经 iLink typing_ticket）。 */
  sendTyping?(chatId: string): Promise<void>;
  /** 清除「正在输入」状态（best-effort）。 */
  clearTyping?(chatId: string): Promise<void>;
  /** 下载并解密一条入站媒体附件（platformRef 来自 {@link BridgeInboundAttachment}）。 */
  downloadMedia?(platformRef: string): Promise<Buffer>;
  /** 主动发送一段媒体（图片走原生图、其余走文件）；需在可回复窗口内。 */
  sendMedia?(chatId: string, data: Buffer, opts: { mime?: string; filename?: string }): Promise<void>;
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
