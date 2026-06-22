/**
 * capabilities/ai/bridge/feishu-adapter —— 飞书官方 Bridge 适配器（纯 node，文本优先）。
 *
 * 移植自 HanaAgent `lib/bridge/feishu-adapter.ts`：用官方 `@larksuiteoapi/node-sdk` 的 `WSClient`
 * **长连接**收 `im.message.receive_v1`（dial-out 免公网），`client.im.message.create` 回发文本。
 * 本期聚焦文本收发；CardKit 实时流式卡片 / 媒体为后续扩展。
 */
import * as lark from "@larksuiteoapi/node-sdk";

import type { BridgeAdapter, BridgeAdapterDeps } from "./types";

interface FeishuReceiveEvent {
  message?: {
    chat_id?: string;
    chat_type?: string;
    message_type?: string;
    content?: string;
  };
  sender?: { sender_id?: { open_id?: string; user_id?: string } };
}

/** 从飞书 message 抽取纯文本（text 类型 content 为 JSON `{text}`；post 取其纯文本段）。 */
function extractFeishuText(message: FeishuReceiveEvent["message"]): string {
  if (!message?.content) return "";
  try {
    const parsed = JSON.parse(message.content) as { text?: string };
    if (message.message_type === "text") return parsed.text?.trim() ?? "";
    // 其余类型尽力取 text 字段。
    return typeof parsed.text === "string" ? parsed.text.trim() : "";
  } catch {
    return "";
  }
}

export function createFeishuAdapter(deps: BridgeAdapterDeps): BridgeAdapter {
  const appId = deps.creds.appId ?? "";
  const appSecret = deps.creds.appSecret ?? "";
  const client = new lark.Client({ appId, appSecret });
  let stopped = false;
  let ws: lark.WSClient | null = null;

  const dispatcher = new lark.EventDispatcher({}).register({
    "im.message.receive_v1": async (data) => {
      if (stopped) return;
      const ev = data as unknown as FeishuReceiveEvent;
      const message = ev.message;
      const text = extractFeishuText(message);
      if (!text || !message?.chat_id) return;
      const openId = ev.sender?.sender_id?.open_id ?? ev.sender?.sender_id?.user_id ?? "unknown";
      deps.onMessage({
        platform: "feishu",
        chatId: message.chat_id,
        userId: openId,
        senderName: "",
        text,
        isGroup: message.chat_type === "group",
      });
    },
  });

  return {
    async start() {
      if (!appId || !appSecret) throw new Error("飞书: 缺少 appId/appSecret");
      stopped = false;
      deps.onStatus("connecting");
      ws = new lark.WSClient({ appId, appSecret, loggerLevel: lark.LoggerLevel.warn });
      // start() 触发长连接（SDK 内部自动重连）；连上后即可收事件。
      await ws.start({ eventDispatcher: dispatcher });
      deps.onStatus("online");
    },

    async stop() {
      // lark WSClient 无公开 stop()，置标志位忽略后续事件；进程退出时连接随之释放。
      stopped = true;
      ws = null;
      deps.onStatus("disconnected");
    },

    async sendText(chatId: string, text: string) {
      await client.im.message.create({
        params: { receive_id_type: "chat_id" },
        data: {
          receive_id: chatId,
          msg_type: "text",
          content: JSON.stringify({ text }),
        },
      });
    },
  };
}
