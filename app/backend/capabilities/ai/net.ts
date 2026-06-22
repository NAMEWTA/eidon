/**
 * backend/capabilities/ai/net —— 可注入的「出站 HTTP」入口（纯 node，禁 electron）。
 *
 * 背景：Electron main 进程的全局 `fetch`（Node undici）**既不读环境变量代理、也不读系统代理**，
 * 在用户配了系统/本地代理（如 Clash）时直连外部接口（微信 iLink / provider 端点）会失败，
 * 表现为「网络错误」。解法是让能力层经此入口发请求，由 shell 在启动时注入一个
 * 「代理感知」的实现（基于 Electron `net.fetch`，走 Chromium 网络栈 + 系统/环境代理）。
 *
 * 注入范式与 `runtime-paths` / `ipc/emit` 一致：能力层保持 electron-free 可单测，
 * shell（唯一可 import electron 的层）在 `app.whenReady` 时调用 {@link setOutboundFetch}。
 * 未注入时回退到全局 `fetch`，保证单测与「未装配」场景仍可用。
 */

/** 出站 fetch 签名：从全局 `fetch` 派生 init/返回类型，避免依赖 DOM 的 RequestInit/Response 命名。 */
export type OutboundFetch = (
  url: string,
  init?: Parameters<typeof fetch>[1],
) => ReturnType<typeof fetch>;

let impl: OutboundFetch = (url, init) => fetch(url, init);

/** shell 启动时注入「代理感知」实现（如 Electron `net.fetch` 包装）。 */
export function setOutboundFetch(fn: OutboundFetch): void {
  impl = fn;
}

/** 能力层统一出口：发一个走当前注入实现（默认全局 fetch）的请求。 */
export const outboundFetch: OutboundFetch = (url, init) => impl(url, init);
