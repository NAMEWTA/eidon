/**
 * provider-catalog —— 供应商展示目录（前端纯静态元数据）。
 *
 * key = pi-ai `getProviders()` 的 provider id（实测 35 个）；值含展示名 / 默认 baseUrl /
 * 默认 api 报文格式 / 分组（oauth/coding/api）/ 品牌图标 key。
 * 供应商详情的「Base URL / API 类型」默认值、左栏分组与图标都据此派生（后端只回传已保存的 api 覆盖）。
 * 默认 url/api 取自 pi-ai 内置模型表（registerBuiltInApiProviders 后 ModelRegistry 投影）。
 */
export type ProviderCategory = 'oauth' | 'coding' | 'api';

export interface ProviderCatalogEntry {
  label: string;
  labelZh?: string;
  /** 默认 baseUrl（占位/回退；用户可覆盖）。 */
  url: string;
  /** 默认 api 报文格式（pi 内置）。 */
  api: string;
  category: ProviderCategory;
  /** provider-icons 的 key；缺省用首字母兜底。 */
  icon?: string;
}

export const PROVIDER_CATALOG: Record<string, ProviderCatalogEntry> = {
  // ── OAuth ──
  'openai-codex': { label: 'ChatGPT (Codex Plus/Pro)', labelZh: 'ChatGPT Plus/Pro', url: 'https://chatgpt.com/backend-api', api: 'openai-codex-responses', category: 'oauth', icon: 'openai' },
  'github-copilot': { label: 'GitHub Copilot', url: 'https://api.individual.githubcopilot.com', api: 'openai-completions', category: 'oauth' },

  // ── Coding Plan ──
  'kimi-coding': { label: 'Kimi Coding Plan', url: 'https://api.kimi.com/coding', api: 'anthropic-messages', category: 'coding', icon: 'kimi' },
  'zai-coding-cn': { label: 'Zhipu GLM Coding Plan', labelZh: '智谱 GLM Coding Plan', url: 'https://open.bigmodel.cn/api/coding/paas/v4', api: 'openai-completions', category: 'coding', icon: 'zhipu' },
  'xiaomi-token-plan-cn': { label: 'Xiaomi MiMo Token Plan', labelZh: '小米 MiMo Token Plan (国内)', url: 'https://token-plan-cn.xiaomimimo.com/v1', api: 'openai-completions', category: 'coding', icon: 'xiaomimimo' },
  'xiaomi-token-plan-ams': { label: 'Xiaomi MiMo Token Plan (AMS)', url: 'https://token-plan-ams.xiaomimimo.com/v1', api: 'openai-completions', category: 'coding', icon: 'xiaomimimo' },
  'xiaomi-token-plan-sgp': { label: 'Xiaomi MiMo Token Plan (SGP)', url: 'https://token-plan-sgp.xiaomimimo.com/v1', api: 'openai-completions', category: 'coding', icon: 'xiaomimimo' },

  // ── API ──
  'anthropic': { label: 'Anthropic', url: 'https://api.anthropic.com', api: 'anthropic-messages', category: 'api' },
  'openai': { label: 'OpenAI', url: 'https://api.openai.com/v1', api: 'openai-responses', category: 'api', icon: 'openai' },
  'google': { label: 'Google Gemini', url: 'https://generativelanguage.googleapis.com/v1beta', api: 'google-generative-ai', category: 'api', icon: 'gemini' },
  'google-vertex': { label: 'Google Vertex AI', url: 'https://{location}-aiplatform.googleapis.com', api: 'google-vertex', category: 'api', icon: 'gemini' },
  'deepseek': { label: 'DeepSeek', url: 'https://api.deepseek.com', api: 'openai-completions', category: 'api', icon: 'deepseek' },
  'moonshotai': { label: 'Moonshot (Kimi)', url: 'https://api.moonshot.ai/v1', api: 'openai-completions', category: 'api', icon: 'moonshot' },
  'moonshotai-cn': { label: 'Moonshot 月之暗面 (国内)', url: 'https://api.moonshot.cn/v1', api: 'openai-completions', category: 'api', icon: 'moonshot' },
  'zai': { label: 'Z.AI (GLM)', url: 'https://api.z.ai/api/coding/paas/v4', api: 'openai-completions', category: 'api', icon: 'zhipu' },
  'minimax': { label: 'MiniMax', url: 'https://api.minimax.io/anthropic', api: 'anthropic-messages', category: 'api', icon: 'minimax' },
  'minimax-cn': { label: 'MiniMax (国内)', url: 'https://api.minimaxi.com/anthropic', api: 'anthropic-messages', category: 'api', icon: 'minimax' },
  'xiaomi': { label: 'Xiaomi MiMo', labelZh: '小米 MiMo', url: 'https://api.xiaomimimo.com/v1', api: 'openai-completions', category: 'api', icon: 'xiaomimimo' },
  'groq': { label: 'Groq', url: 'https://api.groq.com/openai/v1', api: 'openai-completions', category: 'api', icon: 'groq' },
  'mistral': { label: 'Mistral', url: 'https://api.mistral.ai', api: 'mistral-conversations', category: 'api', icon: 'mistral' },
  'openrouter': { label: 'OpenRouter', url: 'https://openrouter.ai/api/v1', api: 'openai-completions', category: 'api', icon: 'openrouter' },
  'fireworks': { label: 'Fireworks', url: 'https://api.fireworks.ai/inference', api: 'anthropic-messages', category: 'api', icon: 'fireworks' },
  'xai': { label: 'xAI (Grok)', url: 'https://api.x.ai/v1', api: 'openai-completions', category: 'api' },
  'cerebras': { label: 'Cerebras', url: 'https://api.cerebras.ai/v1', api: 'openai-completions', category: 'api' },
  'together': { label: 'Together AI', url: 'https://api.together.ai/v1', api: 'openai-completions', category: 'api' },
  'nvidia': { label: 'NVIDIA NIM', url: 'https://integrate.api.nvidia.com/v1', api: 'openai-completions', category: 'api' },
  'huggingface': { label: 'Hugging Face', url: 'https://router.huggingface.co/v1', api: 'openai-completions', category: 'api' },
  'amazon-bedrock': { label: 'Amazon Bedrock', url: 'https://bedrock-runtime.us-east-1.amazonaws.com', api: 'bedrock-converse-stream', category: 'api' },
  'azure-openai-responses': { label: 'Azure OpenAI', url: '', api: 'azure-openai-responses', category: 'api' },
  'vercel-ai-gateway': { label: 'Vercel AI Gateway', url: 'https://ai-gateway.vercel.sh', api: 'anthropic-messages', category: 'api' },
  'cloudflare-ai-gateway': { label: 'Cloudflare AI Gateway', url: 'https://gateway.ai.cloudflare.com/v1', api: 'anthropic-messages', category: 'api' },
  'cloudflare-workers-ai': { label: 'Cloudflare Workers AI', url: 'https://api.cloudflare.com/client/v4', api: 'openai-completions', category: 'api' },
  'ant-ling': { label: 'Ant Ling', labelZh: '蚂蚁百灵', url: 'https://api.ant-ling.com/v1', api: 'openai-completions', category: 'api' },
  'opencode': { label: 'OpenCode Zen', url: 'https://opencode.ai/zen/v1', api: 'openai-completions', category: 'api' },
  'opencode-go': { label: 'OpenCode Zen Go', url: 'https://opencode.ai/zen/go/v1', api: 'openai-completions', category: 'api' },
};

const isZh = (): boolean => {
  if (typeof document === 'undefined') return true;
  return (document.documentElement.lang || 'zh').startsWith('zh');
};

/** 展示名（按当前语言优先 labelZh）；未在目录的 provider 回退原 id。 */
export function providerLabel(id: string, fallbackLabel?: string): string {
  const e = PROVIDER_CATALOG[id];
  if (!e) return fallbackLabel || id;
  return isZh() && e.labelZh ? e.labelZh : e.label;
}

/** 分组（未命中默认 api）。 */
export function providerCategory(id: string): ProviderCategory {
  return PROVIDER_CATALOG[id]?.category ?? 'api';
}

/** 目录默认 api 报文格式（未命中返回 openai-completions 兜底）。 */
export function providerDefaultApi(id: string): string {
  return PROVIDER_CATALOG[id]?.api ?? 'openai-completions';
}

/** 目录默认 baseUrl（未命中空串）。 */
export function providerDefaultUrl(id: string): string {
  return PROVIDER_CATALOG[id]?.url ?? '';
}

/** 分组顺序与中文标题（左栏分组标签用）。 */
export const CATEGORY_ORDER: ProviderCategory[] = ['oauth', 'coding', 'api'];
export const CATEGORY_LABEL: Record<ProviderCategory, string> = {
  oauth: 'OAuth',
  coding: 'Coding Plan',
  api: 'API',
};

/** API 类型下拉选项（与 pi-ai 报文格式对齐；可编辑保存）。 */
export const API_FORMAT_OPTIONS: { value: string; label: string }[] = [
  { value: 'openai-completions', label: 'OpenAI Compatible' },
  { value: 'openai-responses', label: 'OpenAI Responses' },
  { value: 'anthropic-messages', label: 'Anthropic Messages' },
  { value: 'google-generative-ai', label: 'Google Gemini' },
  { value: 'google-vertex', label: 'Google Vertex' },
  { value: 'mistral-conversations', label: 'Mistral' },
  { value: 'openai-codex-responses', label: 'ChatGPT Codex (Plus/Pro)' },
  { value: 'azure-openai-responses', label: 'Azure OpenAI' },
  { value: 'bedrock-converse-stream', label: 'Amazon Bedrock' },
];
