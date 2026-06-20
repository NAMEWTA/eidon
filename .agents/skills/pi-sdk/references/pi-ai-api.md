# @earendil-works/pi-ai — 模型通信层 SDK 完整 API 参考

> 数据源：[packages/ai/](https://github.com/earendil-works/pi/tree/main/packages/ai)
> 版本依据：README + src/index.ts + src/base.ts + src/types.ts + src/stream.ts

## 入口点

| 入口路径 | 说明 |
|---------|------|
| `@earendil-works/pi-ai` | 全量包，自动注册所有内置 provider 懒加载包装 |
| `@earendil-works/pi-ai/base` | 最小入口，不自动注册 transport，需手动 `register()` |
| `@earendil-works/pi-ai/oauth` | OAuth 登录和 token 管理 |

## 模型发现 API

| 函数 | 签名 | 功能 |
|------|------|------|
| `getModel` | `(provider: KnownProvider, modelId: string) => Model` | 按 provider+modelId 获取类型化模型（IDE 自动补全 provider 和 modelId） |
| `getModels` | `(provider: KnownProvider) => Model[]` | 获取某 provider 下所有可用模型 |
| `getProviders` | `() => string[]` | 获取所有已注册 provider 名称 |
| `getImageModel` | `(provider: string, modelId: string) => ImagesModel` | 获取图像生成模型 |
| `getImageModels` | `(provider: string) => ImagesModel[]` | 列出图像生成模型 |
| `getImageProviders` | `() => string[]` | 列出支持图像生成的 provider |

## 核心生成 API

### 流式

```typescript
stream<TApi extends Api>(
  model: Model<TApi>,
  context: Context,
  options?: ProviderStreamOptions
): AssistantMessageEventStream

streamSimple<TApi extends Api>(
  model: Model<TApi>,
  context: Context,
  options?: SimpleStreamOptions
): AssistantMessageEventStream
```

### 非流式

```typescript
complete<TApi extends Api>(
  model: Model<TApi>,
  context: Context,
  options?: ProviderStreamOptions
): Promise<AssistantMessage>

completeSimple<TApi extends Api>(
  model: Model<TApi>,
  context: Context,
  options?: SimpleStreamOptions
): Promise<AssistantMessage>
```

`complete`/`completeSimple` 内部调用流式方法后取 `.result()`，等价于 `stream(...).result()`。

### 图像生成

```typescript
generateImages(
  model: ImagesModel,
  input: ImagesContext,
  options?: ImagesOptions
): Promise<AssistantImages>
```

## 流式事件类型（`AssistantMessageEvent`）

| 事件 type | 携带字段 | 触发时机 |
|-----------|---------|---------|
| `start` | `partial: AssistantMessage` | 流开始 |
| `text_start` | `contentIndex, partial` | 文本块开始 |
| `text_delta` | `delta: string, contentIndex, partial` | 文本增量 |
| `text_end` | `content: string, contentIndex, partial` | 文本块完成 |
| `thinking_start` | `contentIndex, partial` | 思考块开始 |
| `thinking_delta` | `delta: string, contentIndex, partial` | 思考增量 |
| `thinking_end` | `content: string, contentIndex, partial` | 思考块完成 |
| `toolcall_start` | `contentIndex, partial` | 工具调用开始 |
| `toolcall_delta` | `delta: string, contentIndex, partial`（参数增量解析） | 工具参数流式 |
| `toolcall_end` | `toolCall: { id, name, arguments }, partial` | 工具调用完成 |
| `done` | `reason: StopReason, message: AssistantMessage` | 流完成 |
| `error` | `reason: "error"\|"aborted", error: AssistantMessage` | 错误/中止 |

事件流有 `.result(): Promise<AssistantMessage>` 方法。

## 验证 & 环境

| 函数 | 签名 | 功能 |
|------|------|------|
| `validateToolCall` | `(tools: Tool[], toolCall: {name, arguments}) => Record<string, unknown>` | TypeBox schema 验证工具参数 |
| `getEnvApiKey` | `(provider: string) => string \| undefined` | 环境变量读取 API key |

## OAuth 函数（`@earendil-works/pi-ai/oauth`）

| 函数 | 签名 |
|------|------|
| `loginAnthropic` | `(callbacks: OAuthLoginCallbacks) => Promise<OAuthCredentials>` |
| `loginOpenAICodex` | `(callbacks: OAuthLoginCallbacks) => Promise<OAuthCredentials>` |
| `loginGitHubCopilot` | `(callbacks: OAuthLoginCallbacks) => Promise<OAuthCredentials>` |
| `loginGeminiCli` | `(callbacks: OAuthLoginCallbacks) => Promise<OAuthCredentials>` |
| `refreshOAuthToken` | `(provider, credentials) => Promise<OAuthCredentials>` |
| `getOAuthApiKey` | `(provider, credentialsMap) => { newCredentials, apiKey } \| null` |

## Faux Provider（测试）

| 函数 | 功能 |
|------|------|
| `registerFauxProvider` | 注册内存 provider，返回 `{ setResponses, appendResponses, getModel, unregister, state, models }` |
| `fauxAssistantMessage` | 创建预设助理回复 |
| `fauxText` | 构建文本内容块 `{ type: "text", text }` |
| `fauxThinking` | 构建思考内容块 `{ type: "thinking", thinking }` |
| `fauxToolCall` | 构建工具调用块 `{ type: "toolCall", id, name, arguments }` |

## Provider 注册（`@earendil-works/pi-ai/base`）

每个 transport 导出 `register()` 函数。内置 API：

| API 标识符 | 对应 Provider |
|-----------|-------------|
| `anthropic-messages` | Anthropic |
| `openai-completions` | OpenAI / xAI / Groq / Cerebras / DeepSeek / 等 |
| `openai-responses` | OpenAI Responses API |
| `openai-codex-responses` | OpenAI Codex (ChatGPT Plus/Pro) |
| `azure-openai-responses` | Azure OpenAI |
| `google-generative-ai` | Google Gemini |
| `google-vertex` | Google Vertex AI |
| `mistral-conversations` | Mistral |
| `bedrock-converse-stream` | Amazon Bedrock |

用法示例：
```typescript
import { registerAnthropic } from "@earendil-works/pi-ai/base";
registerAnthropic();
```

## 核心类型

### `Context`
```typescript
interface Context {
  systemPrompt?: string;
  messages: Message[];       // UserMessage | AssistantMessage | ToolResultMessage
  tools?: Tool[];            // TypeBox schema 工具定义
}
```
完全 JSON 可序列化（含 base64 图片）。

### `Model<TApi>`
```typescript
interface Model<TApi extends Api> {
  id: string;                // 模型 ID，如 "claude-sonnet-4-6"
  name: string;              // 显示名
  api: TApi;                 // API 标识符
  provider: Provider;        // provider 名
  baseUrl: string;
  reasoning: boolean;        // 是否支持推理/思考
  thinkingLevelMap?: ThinkingLevelMap;
  input: ("text" | "image")[];
  cost: { input: number; output: number; cacheRead: number; cacheWrite: number };
  contextWindow: number;
  maxTokens: number;
  headers?: Record<string, string>;
  compat?: OpenAICompletionsCompat | OpenAIResponsesCompat | AnthropicMessagesCompat;
}
```

### `ImagesModel`
图像生成模型（`omit` reasoning/contextWindow/maxTokens/compat，增加 `output[]`）。

### `Tool`
```typescript
interface Tool<TParameters extends TSchema = TSchema> {
  name: string;
  description: string;
  parameters: TParameters;   // TypeBox schema
}
```

### `Message` 联合类型
```typescript
type Message = UserMessage | AssistantMessage | ToolResultMessage;

interface UserMessage {
  role: "user";
  content: string | (TextContent | ImageContent)[];
  timestamp: number;
}

interface AssistantMessage {
  role: "assistant";
  content: (TextContent | ThinkingContent | ToolCall)[];
  api: Api;
  provider: Provider;
  model: string;
  responseModel?: string;
  responseId?: string;
  diagnostics?: AssistantMessageDiagnostic[];
  usage: Usage;
  stopReason: StopReason;
  errorMessage?: string;
  timestamp: number;
}

interface ToolResultMessage<TDetails = any> {
  role: "toolResult";
  toolCallId: string;
  toolName: string;
  content: (TextContent | ImageContent)[];
  details?: TDetails;
  isError: boolean;
  timestamp: number;
}
```

### 内容块类型
```typescript
type TextContent = { type: "text"; text: string; textSignature?: string };
type ThinkingContent = { type: "thinking"; thinking: string; thinkingSignature?: string; redacted?: boolean };
type ImageContent = { type: "image"; data: string; mimeType: string };
type ToolCall = { type: "toolCall"; id: string; name: string; arguments: Record<string, any> };
```

### `StreamOptions`
```typescript
interface StreamOptions {
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  apiKey?: string;
  transport?: "sse" | "websocket" | "websocket-cached" | "auto";
  cacheRetention?: "none" | "short" | "long";
  sessionId?: string;
  onPayload?: (payload: unknown, model: Model<Api>) => unknown | undefined | Promise<unknown | undefined>;
  onResponse?: (response: ProviderResponse, model: Model<Api>) => void | Promise<void>;
  headers?: Record<string, string>;
  timeoutMs?: number;
  websocketConnectTimeoutMs?: number;
  maxRetries?: number;
  maxRetryDelayMs?: number;
  metadata?: Record<string, unknown>;
  env?: ProviderEnv;
}

interface SimpleStreamOptions extends StreamOptions {
  reasoning?: ThinkingLevel;        // "minimal" | "low" | "medium" | "high" | "xhigh"
  thinkingBudgets?: ThinkingBudgets;
}
```

### `Usage`
```typescript
interface Usage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cacheWrite1h?: number;
  totalTokens: number;
  cost: { input: number; output: number; cacheRead: number; cacheWrite: number; total: number };
}
```

### 枚举类型
```typescript
type StopReason = "stop" | "length" | "toolUse" | "error" | "aborted";
type ThinkingLevel = "minimal" | "low" | "medium" | "high" | "xhigh";
type ModelThinkingLevel = "off" | ThinkingLevel;
type CacheRetention = "none" | "short" | "long";
type Transport = "sse" | "websocket" | "websocket-cached" | "auto";
```

## 已知 Provider 列表（`KnownProvider`）

| Provider | 说明 |
|----------|------|
| `anthropic` | Anthropic Claude |
| `openai` | OpenAI (ChatGPT) |
| `openai-codex` | OpenAI Codex (ChatGPT Plus/Pro) |
| `azure-openai-responses` | Azure OpenAI |
| `google` | Google Gemini |
| `google-vertex` | Google Vertex AI |
| `amazon-bedrock` | AWS Bedrock |
| `mistral` | Mistral AI |
| `deepseek` | DeepSeek |
| `github-copilot` | GitHub Copilot |
| `xai` | xAI (Grok) |
| `groq` | Groq |
| `cerebras` | Cerebras |
| `openrouter` | OpenRouter |
| `vercel-ai-gateway` | Vercel AI Gateway |
| `zai` / `zai-coding-cn` | Z.AI / 智谱 |
| `ant-ling` | 蚂蚁灵码 |
| `nvidia` | NVIDIA |
| `minimax` / `minimax-cn` | MiniMax |
| `moonshotai` / `moonshotai-cn` | Moonshot (Kimi) |
| `kimi-coding` | Kimi Coding |
| `huggingface` | Hugging Face |
| `fireworks` | Fireworks AI |
| `together` | Together AI |
| `opencode` / `opencode-go` | OpenCode |
| `cloudflare-workers-ai` | Cloudflare Workers AI |
| `cloudflare-ai-gateway` | Cloudflare AI Gateway |
| `xiaomi` / `xiaomi-token-plan-cn/ams/sgp` | 小米 |

## Provider 专属选项

| Provider | 选项接口 | 关键字段 |
|----------|---------|---------|
| Anthropic | `AnthropicOptions` | `thinkingEnabled?, thinkingBudgetTokens?` |
| OpenAI Responses | `OpenAIResponsesOptions` | `reasoningEffort?: "low"\|"medium"\|"high", reasoningSummary?: "detailed"\|"concise"` |
| OpenAI Completions | `OpenAICompletionsOptions` | `reasoningEffort?: "low"\|"medium"\|"high"` |
| Google | `GoogleOptions` | `thinking: { enabled: boolean; budgetTokens: number }` |
| Mistral | `MistralOptions` | — |
| Bedrock | `BedrockOptions` | `thinkingDisplay?` |
| OpenAI Codex | `OpenAICodexResponsesOptions` | 继承 OpenAIResponsesOptions |
| Azure OpenAI | `AzureOpenAIResponsesOptions` | — |

## 兼容性控制

### `OpenAICompletionsCompat`（15 字段）
```typescript
{
  supportsStore?: boolean;
  supportsDeveloperRole?: boolean;
  supportsReasoningEffort?: boolean;
  supportsUsageInStreaming?: boolean;
  maxTokensField?: "max_completion_tokens" | "max_tokens";
  requiresToolResultName?: boolean;
  requiresAssistantAfterToolResult?: boolean;
  requiresThinkingAsText?: boolean;
  requiresReasoningContentOnAssistantMessages?: boolean;
  thinkingFormat?: "openai" | "openrouter" | "deepseek" | "together" | "zai" | "qwen"
                | "chat-template" | "qwen-chat-template" | "string-thinking" | "ant-ling";
  chatTemplateKwargs?: Record<string, ChatTemplateKwargValue>;
  openRouterRouting?: OpenRouterRouting;
  vercelGatewayRouting?: VercelGatewayRouting;
  supportsStrictMode?: boolean;
  cacheControlFormat?: "anthropic";
  sendSessionAffinityHeaders?: boolean;
}
```

### `OpenAIResponsesCompat`（3 字段）
```typescript
{
  supportsDeveloperRole?: boolean;
  sendSessionIdHeader?: boolean;
  supportsLongCacheRetention?: boolean;
}
```

### `AnthropicMessagesCompat`（6 字段）
```typescript
{
  supportsEagerToolInputStreaming?: boolean;
  supportsLongCacheRetention?: boolean;
  sendSessionAffinityHeaders?: boolean;
  supportsCacheControlOnTools?: boolean;
  supportsTemperature?: boolean;
  forceAdaptiveThinking?: boolean;
  allowEmptySignature?: boolean;
}
```

## Re-export 的 TypeBox 工具

| 导出 | 来源 | 功能 |
|------|------|------|
| `Type` | TypeBox | Schema 构建器 |
| `Static` | TypeBox | 从 schema 推断 TS 类型 |
| `TSchema` | TypeBox | Schema 类型 |
| `StringEnum` | pi-ai | Google 兼容字符串枚举（避免 anyOf/const） |

## 最小使用示例

```typescript
import { getModel, streamSimple, getProviders, getModels, registerAnthropic }
  from "@earendil-works/pi-ai/base";

// 注册 provider（base 入口需手动注册）
registerAnthropic();

// 获取模型
const model = getModel("anthropic", "claude-sonnet-4-6");

// 流式调用
const eventStream = streamSimple(model, {
  systemPrompt: "You are a helpful assistant.",
  messages: [{ role: "user", content: "Hello!", timestamp: Date.now() }]
}, { reasoning: "high" });

// 消费事件
for await (const event of eventStream) {
  if (event.type === "text_delta") {
    process.stdout.write(event.delta);
  } else if (event.type === "done") {
    console.log("Done:", event.message.usage);
  }
}
```
