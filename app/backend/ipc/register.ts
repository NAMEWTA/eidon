/**
 * backend/ipc/register.ts — IPC 注册层。
 *
 * 每个 handler 按通道维度强类型（请求体/响应体由 shared/ipc 的 IpcContract 收窄）。
 * 启动期据 ALL_CHANNELS 穷尽校验：漏接任一通道即抛错（当前 85 通道，含 nodes/templates/todos/
 * consistency 数据域，见 ADR-0025）。
 */
import { ipcMain } from "electron";
import { ALL_CHANNELS, type Channel, type Req, type Res } from "@shared/ipc";

export type IpcHandlers = {
  [C in Channel]?: (req: Req<C>) => Promise<Res<C>> | Res<C>;
};

/**
 * 注册一组 handler，逐条 ipcMain.handle，并校验覆盖全部通道（启动期穷尽性校验）。
 * 缺任一通道即抛错（启动期暴露漏接），避免渲染层调用悬空通道才发现。
 */
export function registerIpcHandlers(handlers: IpcHandlers): void {
  const missing: Channel[] = [];
  for (const channel of ALL_CHANNELS) {
    const handler = handlers[channel] as ((req: unknown) => unknown) | undefined;
    if (!handler) {
      missing.push(channel);
      continue;
    }
    // ipcMain.handle 同通道只能注册一次；重复注册先移除旧的（dev 热重载友好）。
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel, (_event, req: unknown) => handler(req));
  }
  if (missing.length > 0) {
    throw new Error(`IPC handlers missing for channels: ${missing.join(", ")}`);
  }
}
