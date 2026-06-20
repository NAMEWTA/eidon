// renderer 全局：preload 经 contextBridge 暴露的 `window.eidon`（迁移后唯一的 main 接缝）。
// 类型来自 shared/ipc，确保 channel 名 / 请求体 / 响应体 / 事件 payload 端到端对齐。
import type { EidonApi } from "@shared/ipc";

declare global {
  interface Window {
    eidon: EidonApi;
  }
}

export {};
