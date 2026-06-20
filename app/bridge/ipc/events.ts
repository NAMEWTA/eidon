/**
 * main → renderer 推送事件订阅。
 *
 * 维持旧 `listen(name, cb)` 形状（返回 UnlistenFn），调用点仅改 import。
 * 通道名 `eidon:X`（历史上写作 `eidon://X`，`//` 仅装饰）。
 * `emit` 渲染层未实际用于发送（4 事件均 main→renderer）；保留 no-op 以兼容偶发 import。
 */
import type { EidonEventName, EidonEventPayload } from "@shared/ipc";

export type UnlistenFn = () => void;

/** `eidon://menu` → `eidon:menu`（去掉历史装饰 `//`）。 */
function normalize(name: string): EidonEventName {
  return name.replace("://", ":") as EidonEventName;
}

export async function listen<T = unknown>(
  event: string,
  cb: (e: { payload: T }) => void,
): Promise<UnlistenFn> {
  const channel = normalize(event);
  return window.eidon.on(channel, (payload) =>
    cb({ payload: payload as T }),
  ) as unknown as UnlistenFn;
}

/** 渲染层 → main 自定义事件：当前架构无此通路，保留 no-op。 */
export async function emit(_event: string, _payload?: unknown): Promise<void> {
  void _event;
  void _payload;
}

// 重导出事件 payload 类型工具（供需要的调用点）。
export type { EidonEventName, EidonEventPayload };
