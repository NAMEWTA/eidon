/**
 * capabilities/ai/bridge/manager —— 平台适配器注册表（数据驱动；新增平台只补此表 + 一个适配器）。
 */
import type { BridgePlatform } from "@shared/contracts";

import { createFeishuAdapter } from "./feishu-adapter";
import { createWechatAdapter } from "./wechat-adapter";
import type { BridgeAdapter, BridgeAdapterDeps } from "./types";

const FACTORIES: Record<BridgePlatform, (deps: BridgeAdapterDeps) => BridgeAdapter> = {
  feishu: createFeishuAdapter,
  wechat: createWechatAdapter,
};

/** 本期支持的平台（飞书 + 微信官方 iLink）。 */
export const BRIDGE_PLATFORMS: BridgePlatform[] = ["feishu", "wechat"];

/** 按平台构造适配器。 */
export function createAdapter(platform: BridgePlatform, deps: BridgeAdapterDeps): BridgeAdapter {
  return FACTORIES[platform](deps);
}
