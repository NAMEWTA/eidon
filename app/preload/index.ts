/**
 * preload/index.ts — contextBridge：renderer ↔ main 的唯一接缝（迁移 M1 骨架）。
 *
 * 现阶段只暴露最小通用面（invoke / on）。M2 把类型换成 shared/ipc 的 EidonApi，
 * M3/M5 起 renderer 改用 window.eidon 调用真实 IPC 通道。
 *
 * 安全：sandbox:true 下 preload 必须是 CJS（见 electron.vite.config.ts），
 * 只暴露可序列化函数，绝不把 ipcRenderer / Node 对象本身越过 contextBridge。
 */
import { contextBridge, ipcRenderer, webUtils } from "electron";
import type { EidonApi } from "@shared/ipc";

// 运行时实现按通用签名编写（泛型在运行时被擦除）；类型契约由 renderer 侧
// `src/global.d.ts` 的 `window.eidon: EidonApi` 端到端强制。
const api = {
  /** 请求/响应：转发到 main 的 ipcMain.handle（M3 前未注册的通道会 reject —— 预期）。 */
  invoke(channel: string, req?: unknown): Promise<unknown> {
    return ipcRenderer.invoke(channel, req);
  },
  /** 主进程推送事件订阅；返回退订函数。 */
  on(channel: string, cb: (payload: unknown) => void): () => void {
    const listener = (_event: unknown, payload: unknown): void => cb(payload);
    ipcRenderer.on(channel, listener as Parameters<typeof ipcRenderer.on>[1]);
    return () =>
      ipcRenderer.removeListener(
        channel,
        listener as Parameters<typeof ipcRenderer.removeListener>[1],
      );
  },
  /** 拖入文件 → 绝对路径（webUtils.getPathForFile，sandbox 下唯一拿到磁盘路径的途径）。 */
  getPathForFile(file: File): string {
    return webUtils.getPathForFile(file);
  },
};

contextBridge.exposeInMainWorld("eidon", api as unknown as EidonApi);
