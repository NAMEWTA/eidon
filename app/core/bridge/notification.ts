import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

/**
 * 通知桥 —— 节点级待办提醒的唯一 Tauri 出口（见 AGENTS.md §2.1：仅 bridge 可 import `@tauri-apps`）。
 *
 * 桌面（Tauri）走 `tauri-plugin-notification` 原生系统通知；web/dev（`pnpm dev:web`，无 Tauri）
 * 降级到浏览器 `Notification` API（沿用 `stores/pomodoro.ts` 的 fireNotification 范式）。
 * 两条路径都「先确权、再发」，权限被拒则静默放弃（提醒仍有 Toast + 宠物表情兜底）。
 */

export interface NotificationPayload {
  title: string;
  body?: string;
}

// Tauri v2 运行时标志：webview 注入此全局；缺失即 web/浏览器环境。
const hasTauri = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const webPermissionGranted = async (): Promise<boolean> => {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    return (await Notification.requestPermission()) === "granted";
  } catch {
    return false;
  }
};

/** 确保通知权限（首次会弹系统授权框）。返回是否已获授权。 */
export const ensureNotificationPermission = async (): Promise<boolean> => {
  if (hasTauri()) {
    try {
      let granted = await isPermissionGranted();
      if (!granted) granted = (await requestPermission()) === "granted";
      return granted;
    } catch {
      // Tauri 调用异常 → 退回 web 路径
    }
  }
  return webPermissionGranted();
};

/** 发送一条提醒通知；未授权则尝试申请，仍被拒则静默返回。 */
export const notify = async (payload: NotificationPayload): Promise<void> => {
  if (hasTauri()) {
    try {
      const granted =
        (await isPermissionGranted()) ||
        (await requestPermission()) === "granted";
      if (granted) sendNotification({ title: payload.title, body: payload.body });
      return;
    } catch {
      // 退回 web 路径
    }
  }
  try {
    if (await webPermissionGranted()) {
      new Notification(payload.title, { body: payload.body });
    }
  } catch {
    // 无通知能力（如旧浏览器）→ 静默
  }
};
