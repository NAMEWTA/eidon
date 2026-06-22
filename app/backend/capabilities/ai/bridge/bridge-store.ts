/**
 * capabilities/ai/bridge/bridge-store —— `~/.eidon/bridge.json`（绑定）+ `auth.json` 的 bridge 段（凭证）IO。
 *
 * 绑定（platform↔agentId、enabled）是非密元数据；凭证（飞书 appSecret、微信 botToken）落 gitignored auth.json。
 */
import {
  BridgeBindingSchema,
  BridgeBindingsFileSchema,
  type BridgeBinding,
  type BridgeBindingsFile,
  type BridgePlatform,
} from "@shared/contracts";

import { bridgePath } from "../paths";
import { readAuth, writeAuth } from "../providers-store";
import { readJson, writeJson } from "../store";

const empty = (): BridgeBindingsFile => ({ version: 1, bindings: [] });

export const readBindings = (): Promise<BridgeBindingsFile> =>
  readJson(BridgeBindingsFileSchema, bridgePath(), empty());

export const writeBindings = (data: BridgeBindingsFile): Promise<BridgeBindingsFile> =>
  writeJson(BridgeBindingsFileSchema, bridgePath(), data);

/** 合并更新某平台绑定（不存在则创建）。 */
export async function setBinding(
  platform: BridgePlatform,
  patch: Partial<Pick<BridgeBinding, "agentId" | "enabled" | "label">>,
): Promise<BridgeBinding> {
  const file = await readBindings();
  const bindings = [...file.bindings];
  const i = bindings.findIndex((b) => b.platform === platform);
  const prev = i >= 0 ? bindings[i] : BridgeBindingSchema.parse({ platform });
  const next: BridgeBinding = { ...prev, ...patch };
  if (i >= 0) bindings[i] = next;
  else bindings.push(next);
  await writeBindings({ ...file, bindings });
  return next;
}

/** 移除某平台绑定。 */
export async function removeBinding(platform: BridgePlatform): Promise<void> {
  const file = await readBindings();
  await writeBindings({ ...file, bindings: file.bindings.filter((b) => b.platform !== platform) });
}

/** 读某平台凭证（缺失 → {}）。 */
export async function readBridgeCreds(platform: BridgePlatform): Promise<Record<string, string>> {
  const auth = await readAuth();
  return auth.bridge[platform] ?? {};
}

/** 写某平台凭证（空对象 = 清除）。 */
export async function setBridgeCreds(
  platform: BridgePlatform,
  creds: Record<string, string>,
): Promise<void> {
  const auth = await readAuth();
  const bridge = { ...auth.bridge };
  if (Object.keys(creds).length === 0) delete bridge[platform];
  else bridge[platform] = creds;
  await writeAuth({ ...auth, bridge });
}
