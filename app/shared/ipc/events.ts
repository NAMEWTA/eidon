/**
 * shared/ipc/events.ts — main → renderer 推送事件。
 *
 * 通道名保留 `eidon:*` 前缀（`//` 仅历史装饰，Electron 通道名是普通字符串）。
 * main 侧用 `webContents.send(name, payload)` 发送；renderer 经 `window.eidon.on(name, cb)` 订阅。
 */
import type {
  AgentActivity,
  AiSessionState,
  AiStreamEvent,
  BridgeInbound,
  BridgeStatus,
  WechatLoginState,
} from "../models";

export interface EidonEventMap {
  /** 原生菜单项点击 → 菜单项 id（renderer 内部据此分发命令）。 */
  "eidon:menu": string;
  /** 窗口关闭请求（带未存内容时由 main 触发，renderer 确认后调 shell:forceClose）。 */
  "eidon:close-requested": void;
  /** 磁盘上文件被外部修改（已去抖 + 自写抑制）→ 文件绝对路径。 */
  "eidon:file-changed": string;
  /** 工作区索引更新 → 来源标记 "init" | "rescan" | "watch"。 */
  "eidon:index-updated": string;
  /** AI 流式事件（text/thinking/tool 增量 + done/error；按 sessionId 分发）。 */
  "eidon:ai-stream": AiStreamEvent;
  /** AI 会话状态快照（model/isStreaming/messageCount 变化时推送）。 */
  "eidon:ai-session": AiSessionState;
  /** Agent 后台活动（cron 完成 / 主动 notify）→ 渲染层弹 Toast + 系统通知。 */
  "eidon:agent-activity": AgentActivity;
  /** 平台桥接连接态变化（每平台一条）。 */
  "eidon:bridge-status": BridgeStatus;
  /** 外部平台入站消息提示（仅用于 UI 感知）。 */
  "eidon:bridge-inbound": BridgeInbound;
  /** 微信扫码登录态（QR + 状态）。 */
  "eidon:bridge-wechat-qr": WechatLoginState;
}

export type EidonEventName = keyof EidonEventMap;
export type EidonEventPayload<E extends EidonEventName> = EidonEventMap[E];

/** 事件通道名常量（避免裸字符串散落）。 */
export const EIDON_EVENT = {
  menu: "eidon:menu",
  closeRequested: "eidon:close-requested",
  fileChanged: "eidon:file-changed",
  indexUpdated: "eidon:index-updated",
} as const satisfies Record<string, EidonEventName>;
