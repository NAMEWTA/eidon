/**
 * backend/capabilities/ai/provider-probe —— 连通性测试 + 模型发现（纯 node fetch，无 electron）。
 *
 * 对 OpenAI 兼容 / Anthropic / Google 端点发只读请求：`testProvider` 校验凭证/可达，
 * `fetchModels` 拉取模型 id 列表。供应商详情「连通性测试」与「读取模型」按钮用。
 * 仅 `node:*`/出站 fetch + shared，遵四层边界（AGENTS.md §2.1）。
 */
import { outboundFetch } from "./net";

export interface ProbeInput {
  baseUrl: string;
  api: string;
  apiKey?: string;
  headers?: Record<string, string>;
}

const TIMEOUT_MS = 9000;

const trimSlash = (u: string): string => u.replace(/\/+$/, "");

/** 据 api 格式拼 models 端点 + 鉴权头。 */
function modelsRequest(input: ProbeInput): { url: string; headers: Record<string, string> } {
  const base = trimSlash(input.baseUrl);
  const extra = input.headers ?? {};
  const key = input.apiKey?.trim();
  if (input.api === "google-generative-ai") {
    const url = key ? `${base}/models?key=${encodeURIComponent(key)}` : `${base}/models`;
    return { url, headers: { ...extra } };
  }
  if (input.api === "anthropic-messages") {
    return {
      url: `${base}/models`,
      headers: {
        ...(key ? { "x-api-key": key } : {}),
        "anthropic-version": "2023-06-01",
        ...extra,
      },
    };
  }
  // openai-completions / openai-responses / 其它 OpenAI 兼容端点
  return {
    url: `${base}/models`,
    headers: { ...(key ? { Authorization: `Bearer ${key}` } : {}), ...extra },
  };
}

async function getJson(
  url: string,
  headers: Record<string, string>,
): Promise<{ ok: boolean; data: unknown }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await outboundFetch(url, { method: "GET", headers, signal: ctrl.signal });
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      /* 非 JSON 响应：忽略正文，仅看状态码 */
    }
    return { ok: res.ok, data };
  } finally {
    clearTimeout(timer);
  }
}

const asString = (v: unknown): string | null => (typeof v === "string" ? v : null);

/** 从端点响应里抽取模型 id 列表（兼容 OpenAI `data[]` / 数组 `models[]` / Google `models[].name`）。 */
function extractIds(api: string, data: unknown): string[] {
  if (!data || typeof data !== "object") return [];
  const obj = data as Record<string, unknown>;
  if (api === "google-generative-ai") {
    const arr = Array.isArray(obj.models) ? obj.models : [];
    return arr
      .map((m) => {
        const name = m && typeof m === "object" ? asString((m as Record<string, unknown>).name) : null;
        return name ? name.replace(/^models\//, "") : null;
      })
      .filter((x): x is string => !!x);
  }
  const arr = Array.isArray(obj.data) ? obj.data : Array.isArray(obj.models) ? obj.models : [];
  return arr
    .map((m) => {
      if (typeof m === "string") return m;
      if (m && typeof m === "object") return asString((m as Record<string, unknown>).id);
      return null;
    })
    .filter((x): x is string => !!x);
}

/** 连通性测试：对 models 端点发只读请求，2xx 即视为通。 */
export async function testProvider(input: ProbeInput): Promise<boolean> {
  if (!input.baseUrl?.trim()) return false;
  try {
    const { url, headers } = modelsRequest(input);
    const { ok } = await getJson(url, headers);
    return ok;
  } catch {
    return false;
  }
}

/** 读取模型：返回端点发现的模型 id 列表（失败/无返回为空，去重）。 */
export async function fetchModels(input: ProbeInput): Promise<string[]> {
  if (!input.baseUrl?.trim()) return [];
  try {
    const { url, headers } = modelsRequest(input);
    const { ok, data } = await getJson(url, headers);
    if (!ok) return [];
    return [...new Set(extractIds(input.api, data))];
  } catch {
    return [];
  }
}
