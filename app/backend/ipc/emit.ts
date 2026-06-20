/**
 * main → renderer 推送事件出口。
 *
 * 能力层（watcher / workspace-index / menu / close-guard）经此发事件，
 * 不直接持有窗口引用；main/index.ts 在创建窗口时注入目标 webContents。
 */
import type { BrowserWindow } from "electron";
import type { EidonEventName, EidonEventPayload } from "@shared/ipc";

let targetWindow: BrowserWindow | null = null;

/** main/index.ts 创建/销毁窗口时调用，注入推送目标。 */
export function setEventTarget(win: BrowserWindow | null): void {
  targetWindow = win;
}

/** 向 renderer 推送一个 typed 事件（窗口未就绪时静默丢弃）。 */
export function emitEvent<E extends EidonEventName>(
  event: E,
  payload: EidonEventPayload<E>,
): void {
  if (!targetWindow || targetWindow.isDestroyed()) return;
  targetWindow.webContents.send(event, payload);
}
