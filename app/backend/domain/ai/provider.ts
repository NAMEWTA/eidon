/**
 * backend/domain/ai/provider —— Pi SDK 的模型/凭证适配（唯一可 import Pi SDK 的层之一）。
 *
 * 用一组 provider→key 构造**内存** AuthStorage + ModelRegistry（不落 pi 的 auth.json；
 * EIDON 凭证真相源在 `capabilities/ai` 的 auth.json，由 service 读出后注入）。
 * 仅依赖 Pi SDK + shared，不 import 任何 EIDON capability（四层边界，见 AGENTS.md §2.1）。
 */
import { AuthStorage, ModelRegistry } from "@earendil-works/pi-coding-agent";
import { getProviders, type Api, type Model } from "@earendil-works/pi-ai";

import type { ModelInfo, ModelRef } from "@shared/models";

/** provider→API key 注入内存 AuthStorage，并建对应 ModelRegistry。 */
export function buildRegistry(apiKeys: Record<string, string>): {
  authStorage: AuthStorage;
  registry: ModelRegistry;
} {
  const authStorage = AuthStorage.inMemory();
  for (const [provider, key] of Object.entries(apiKeys)) {
    if (key?.trim()) authStorage.setRuntimeApiKey(provider, key.trim());
  }
  return { authStorage, registry: ModelRegistry.inMemory(authStorage) };
}

const toInfo = (m: Model<Api>): ModelInfo => ({
  provider: m.provider,
  id: m.id,
  name: m.name,
  reasoning: m.reasoning,
  contextWindow: m.contextWindow,
  input: m.input,
});

/** 已配置凭证的可用模型（registry.getAvailable 已按 auth 过滤）。 */
export function listAvailableModels(apiKeys: Record<string, string>): ModelInfo[] {
  return buildRegistry(apiKeys).registry.getAvailable().map(toInfo);
}

/** 全部内置模型（不论是否配 key）；可按 provider 过滤。供「未配 key 也能浏览模型」。 */
export function listAllModels(provider?: string): ModelInfo[] {
  const registry = ModelRegistry.inMemory(AuthStorage.inMemory());
  const models = registry.getAll();
  const filtered = provider ? models.filter((m) => m.provider === provider) : models;
  return filtered.map(toInfo);
}

/** 所有已知 provider 名（pi 内置 33+）。 */
export const listProviderNames = (): string[] => getProviders();

/** 在 registry 中解析 ModelRef → pi Model（找不到返回 undefined）。 */
export function resolveModel(
  registry: ModelRegistry,
  ref: ModelRef | null,
): Model<Api> | undefined {
  if (!ref) return undefined;
  return registry.find(ref.provider, ref.id);
}
