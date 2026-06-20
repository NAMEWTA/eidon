/**
 * shared/ipc/events.ts — main → renderer 推送事件。
 *
 * 通道名保留 `eidon:*` 前缀（`//` 仅历史装饰，Electron 通道名是普通字符串）。
 * main 侧用 `webContents.send(name, payload)` 发送；renderer 经 `window.eidon.on(name, cb)` 订阅。
 */

export interface EidonEventMap {
  /** 原生菜单项点击 → 菜单项 id（renderer 内部据此分发命令）。 */
  "eidon:menu": string;
  /** 窗口关闭请求（带未存内容时由 main 触发，renderer 确认后调 shell:forceClose）。 */
  "eidon:close-requested": void;
  /** 磁盘上文件被外部修改（已去抖 + 自写抑制）→ 文件绝对路径。 */
  "eidon:file-changed": string;
  /** 工作区索引更新 → 来源标记 "init" | "rescan" | "watch"。 */
  "eidon:index-updated": string;
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
