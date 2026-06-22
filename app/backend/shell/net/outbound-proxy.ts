/**
 * backend/shell/net/outbound-proxy —— 出站请求的「代理感知」装配（electron 允许层）。
 *
 * 把能力层的 {@link outboundFetch} 注入为基于 Electron `net.fetch` 的实现：
 *  - `net.fetch` 走 Chromium 网络栈，**默认跟随系统代理**（打包后 Finder 启动也覆盖）；
 *  - 若检测到环境变量代理（dev 终端启动常见：HTTP(S)_PROXY），显式 `session.setProxy`
 *    注入到默认 session，使 Chromium 按环境代理走（macOS 默认只读系统代理、不读 env）。
 *
 * 详见 `capabilities/ai/net.ts` 头注释（修复微信 iLink 扫码「网络错误」的根因层）。
 */
import { net, session } from "electron";

import { setOutboundFetch } from "../../capabilities/ai/net";

/** 按优先级取第一个非空环境变量代理值。 */
function envProxy(keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key];
    if (value && value.trim()) return value.trim();
  }
  return "";
}

/** 由环境变量推导 Electron proxyRules / proxyBypassRules（仅 http/https，覆盖本场景）。 */
function envProxyConfig(): { proxyRules: string; proxyBypassRules: string } | null {
  const httpProxy = envProxy(["HTTP_PROXY", "http_proxy", "ALL_PROXY", "all_proxy"]);
  const httpsProxy = envProxy(["HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy", "ALL_PROXY", "all_proxy"]);
  if (!httpProxy && !httpsProxy) return null;

  const rules: string[] = [];
  if (httpProxy) rules.push(`http=${httpProxy}`);
  if (httpsProxy) rules.push(`https=${httpsProxy}`);

  // 本地回环强制直连（dev server / 本地服务），再并入 NO_PROXY。
  const bypass = new Set(["localhost", "127.0.0.1", "::1"]);
  for (const entry of envProxy(["NO_PROXY", "no_proxy"]).split(/[\s,]+/)) {
    if (entry.trim()) bypass.add(entry.trim());
  }
  return { proxyRules: rules.join(";"), proxyBypassRules: [...bypass].join(",") };
}

/**
 * 在 `app.whenReady` 后调用：装配代理感知的出站 fetch。
 * 必须在 `startEnabledBridges()` 之前调用，确保桥接首个请求即走代理。
 */
export async function installOutboundProxy(): Promise<void> {
  const envConfig = envProxyConfig();
  if (envConfig) {
    try {
      await session.defaultSession.setProxy({
        proxyRules: envConfig.proxyRules,
        proxyBypassRules: envConfig.proxyBypassRules,
      });
    } catch {
      // setProxy 失败不致命：net.fetch 仍会回退到系统代理。
    }
  }
  // 否则保持默认（Chromium 跟随系统代理）。
  setOutboundFetch((url, init) => net.fetch(url, init as Parameters<typeof net.fetch>[1]));
}
