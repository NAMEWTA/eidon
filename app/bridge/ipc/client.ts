/**
 * bridge/ipc/client.ts — 渲染层 ↔ backend 的 typed 门面（唯一接缝 = preload 的 `window.eidon`）。
 *
 * 只提供类型安全的 `eidonInvoke<C>(channel, req)`：channel 名、请求体、响应体由 shared/ipc 的
 * IpcContract 端到端对齐。
 */
import type { Channel, Req, Res } from "@shared/ipc";

function api() {
  return window.eidon;
}

/** 类型安全通道调用。 */
export function eidonInvoke<C extends Channel>(channel: C, req: Req<C>): Promise<Res<C>> {
  return api().invoke(channel, req);
}
