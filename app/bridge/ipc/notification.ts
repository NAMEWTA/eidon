/**
 * 通知桥。
 *
 * 桌面经 notify:* 通道走 main 的 Electron Notification；保持「先确权再发」「被拒静默」语义。
 */
import { eidonInvoke } from "./client";

export interface NotificationPayload {
  title: string;
  body?: string;
}

export const ensureNotificationPermission = async (): Promise<boolean> => {
  try {
    return await eidonInvoke("notify:requestPermission", {});
  } catch {
    return false;
  }
};

export const notify = async (payload: NotificationPayload): Promise<void> => {
  try {
    if (await ensureNotificationPermission()) {
      await eidonInvoke("notify:send", { title: payload.title, body: payload.body });
    }
  } catch {
    // 无通知能力 → 静默（提醒仍有 Toast + 宠物表情兜底）。
  }
};
