/**
 * capabilities/ai/bridge —— 多平台桥接能力出口（纯 node；禁 electron / Pi SDK）。
 */
export type { BridgeAdapter, BridgeAdapterDeps, BridgeInboundMessage, BridgeRuntimeState } from "./types";
export {
  readBindings,
  writeBindings,
  setBinding,
  removeBinding,
  readBridgeCreds,
  setBridgeCreds,
} from "./bridge-store";
export { createAdapter, BRIDGE_PLATFORMS } from "./manager";
export { getWechatQrcode, pollWechatQrcodeStatus } from "./wechat-login";
export {
  getBridgeSessionFile,
  setBridgeSessionFile,
  reconcileBridgeIndex,
} from "./bridge-session-index";
