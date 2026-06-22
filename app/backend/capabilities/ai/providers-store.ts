/**
 * backend/capabilities/ai/providers-store —— `~/.eidon/providers.json` + `auth.json` IO（纯 node）。
 *
 * providers.json = provider 开关 + baseUrl + 全局默认模型；auth.json = provider→API key（敏感，0o600）。
 * 二分存储：凭证单独落 auth.json，便于备份时排除、权限收紧（参考 pi 的 auth/models 分离）。
 */
import {
  AuthFileSchema,
  ProviderConfigSchema,
  ProvidersFileSchema,
  type AuthFile,
  type ModelMeta,
  type ProviderConfig,
  type ProvidersFile,
} from "@shared/contracts";

import { authPath, providersPath } from "./paths";
import { readJson, writeJson } from "./store";

/** 某 provider 的完整默认配置（缺省时的兜底）。 */
const defaultProviderConfig = (): ProviderConfig => ProviderConfigSchema.parse({});

const emptyProviders = (): ProvidersFile => ({
  version: 1,
  defaultModel: null,
  providers: {},
});

const emptyAuth = (): AuthFile => ({ version: 1, keys: {}, bridge: {} });

export const readProviders = (): Promise<ProvidersFile> =>
  readJson(ProvidersFileSchema, providersPath(), emptyProviders());

export const writeProviders = (data: ProvidersFile): Promise<ProvidersFile> =>
  writeJson(ProvidersFileSchema, providersPath(), data);

export const readAuth = (): Promise<AuthFile> =>
  readJson(AuthFileSchema, authPath(), emptyAuth());

/** 凭证文件权限收紧到仅属主可读写。 */
export const writeAuth = (data: AuthFile): Promise<AuthFile> =>
  writeJson(AuthFileSchema, authPath(), data, 0o600);

/** 设置某 provider 的 API key（空串=清除）。 */
export async function setApiKey(provider: string, apiKey: string): Promise<void> {
  const auth = await readAuth();
  const keys = { ...auth.keys };
  if (apiKey.trim()) {
    keys[provider] = apiKey.trim();
  } else {
    delete keys[provider];
  }
  await writeAuth({ ...auth, keys });
}

/** 已配置 API key 的 provider 名集合（供「是否可用 / 列模型」判定）。 */
export async function configuredProviders(): Promise<Set<string>> {
  const auth = await readAuth();
  return new Set(Object.keys(auth.keys).filter((p) => auth.keys[p]?.trim()));
}

/** 合并更新某 provider 的非凭证配置（enabled/baseUrl/api/headers）。 */
export async function setProviderConfig(
  provider: string,
  patch: Partial<Pick<ProviderConfig, "enabled" | "baseUrl" | "api" | "headers">>,
): Promise<void> {
  const file = await readProviders();
  const prev = file.providers[provider] ?? defaultProviderConfig();
  const next: ProviderConfig = {
    ...prev,
    ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
    ...(patch.baseUrl !== undefined ? { baseUrl: patch.baseUrl } : {}),
    ...(patch.api !== undefined ? { api: patch.api } : {}),
    ...(patch.headers !== undefined ? { headers: patch.headers } : {}),
  };
  await writeProviders({ ...file, providers: { ...file.providers, [provider]: next } });
}

/** 写入某 provider 下单个模型的元数据覆盖（逐模型编辑面板）。 */
export async function setModelMeta(
  provider: string,
  modelId: string,
  meta: ModelMeta,
): Promise<void> {
  const file = await readProviders();
  const prev = file.providers[provider] ?? defaultProviderConfig();
  const models = { ...prev.models, [modelId]: meta };
  await writeProviders({
    ...file,
    providers: { ...file.providers, [provider]: { ...prev, models } },
  });
}

/** 删除某 provider 下单个模型的元数据条目（已添加模型列表移除一项）。 */
export async function removeModelMeta(provider: string, modelId: string): Promise<void> {
  const file = await readProviders();
  const prev = file.providers[provider];
  if (!prev || !(modelId in prev.models)) return;
  const models = { ...prev.models };
  delete models[modelId];
  await writeProviders({
    ...file,
    providers: { ...file.providers, [provider]: { ...prev, models } },
  });
}

/** 删除某 provider 配置（自定义 provider 移除）。 */
export async function removeProvider(provider: string): Promise<void> {
  const file = await readProviders();
  if (!(provider in file.providers)) return;
  const providers = { ...file.providers };
  delete providers[provider];
  await writeProviders({ ...file, providers });
}
