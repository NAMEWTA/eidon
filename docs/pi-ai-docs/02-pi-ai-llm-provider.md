# 02 — pi-ai: 多提供商 LLM API

> 包名: `@earendil-works/pi-ai`
> 源码: `packages/ai/`

## 概述

统一的 LLM API 层，支持 22+ 提供商，自动模型发现、token/成本追踪、跨提供商上下文转换。
仅包含支持 tool/function calling 的模型（agentic 工作流的硬需求）。

## 核心 API

### `getModel(provider, modelId)`

返回完整类型的 `Model` 对象，IDE 有自动补全。

```typescript
import { getModel } from "@earendil-works/pi-ai";

const model = getModel("anthropic", "claude-sonnet-4-20250514");
// model.api → "anthropic-messages"
// model.contextWindow → 200000
// model.reasoning → true
// model.cost → { input: 3, output: 15, cacheRead: 0.30, cacheWrite: 3.75 } (per 1M tokens)
```

### `stream(model, context, options?)` / `complete(model, context, options?)`

```typescript
// 流式
const stream = stream(model, {
  systemPrompt: "You are helpful.",
  messages: [...],
  tools: [...]
});

for await (const event of stream) {
  // event.type: "start" | "text_delta" | "toolcall_start" | "toolcall_delta" | "done" | "error" ...
}

// 非流式
const message = await complete(model, context, options);
```

### `streamSimple()` / `completeSimple()`

高层封装，支持统一的 `reasoning` 选项：

```typescript
const stream = streamSimple(model, context, {
  reasoning: "medium",  // "minimal" | "low" | "medium" | "high" | "xhigh"
});
```

## 支持的提供商（22+）

| 提供商 | 内部 API | 环境变量 |
|--------|----------|----------|
| Anthropic | `anthropic-messages` | `ANTHROPIC_API_KEY` |
| OpenAI | `openai-completions` / `openai-responses` | `OPENAI_API_KEY` |
| Google Gemini | `google-generative-ai` | `GEMINI_API_KEY` |
| Vertex AI | `google-vertex` | `GOOGLE_CLOUD_API_KEY` |
| Azure OpenAI | `azure-openai-responses` | `AZURE_OPENAI_API_KEY` |
| OpenAI Codex | `openai-codex-responses` | OAuth |
| DeepSeek | `openai-completions` | `DEEPSEEK_API_KEY` |
| Mistral | `mistral-conversations` | `MISTRAL_API_KEY` |
| Groq | `openai-completions` | `GROQ_API_KEY` |
| xAI | `openai-completions` | `XAI_API_KEY` |
| OpenRouter | `openai-completions` | `OPENROUTER_API_KEY` |
| Amazon Bedrock | `bedrock-converse-stream` | AWS 凭据 |
| Cerebras | `openai-completions` | `CEREBRAS_API_KEY` |
| Together AI | `openai-completions` | `TOGETHER_API_KEY` |
| Fireworks | Anthropic-compatible | `FIREWORKS_API_KEY` |
| Cloudflare AI GW | `openai-completions` | `CLOUDFLARE_API_KEY` |
| Vercel AI Gateway | `openai-completions` | `AI_GATEWAY_API_KEY` |
| MiniMax | `openai-completions` | `MINIMAX_API_KEY` |
| Kimi For Coding | Anthropic-compatible | `KIMI_API_KEY` |
| Xiaomi MiMo | Anthropic-compatible | `XIAOMI_API_KEY` |
| 自定义 OpenAI 兼容 | `openai-completions` | 可配置 `baseUrl` |

### 查询函数

```typescript
import { getProviders, getModels } from "@earendil-works/pi-ai";

getProviders();           // string[] — 所有已知提供商
getModels("openai");      // 某一提供商的所有模型
getImageModels();         // 图像生成模型（独立命名空间）
```

## 事件驱动的流式输出

```typescript
for await (const event of stream) {
  switch (event.type) {
    case "start":          // 流开始
    case "text_start":     // 文本块开始（可能有多个交错的内容块）
    case "text_delta":     // 文本增量，event.delta
    case "text_end":       // 文本块结束
    case "thinking_start": // 思考块开始（推理模型）
    case "thinking_delta": // 思考内容增量
    case "thinking_end":   // 思考块结束
    case "toolcall_start": // 工具调用开始，event.toolCallId
    case "toolcall_delta": // 工具参数增量（JSON 增量）
    case "toolcall_end":   // 工具调用结束
    case "done":           // 流结束，event.message 包含完整消息
    case "error":          // 错误
  }
}
```

**关键注意**: 不同内容块的事件可以交错出现（例如 text 和 toolcall 交替），使用 `event.contentIndex` 区分。

## 自定义模型

用于本地推理服务器或非标准提供商：

```typescript
const customModel: Model<"openai-completions"> = {
  id: "llama-3.1-8b",
  api: "openai-completions",
  provider: "ollama",
  baseUrl: "http://localhost:11434/v1",
  compat: {
    supportsStore: false,
    supportsDeveloperRole: false,
    // ... 其他兼容性选项
  },
};
```

`compat` 字段用于处理各提供商的实现差异（是否支持 `store`、`developer` role、`reasoning_effort` 等）。

## 跨提供商上下文转换

消息在不同提供商间自动转换：
- 思考块 → `<thinking>` 标签文本
- 工具调用/结果 → 透传
- 可在一次对话中切换模型而不丢失上下文

## 测试: Faux Provider

```typescript
import { registerFauxProvider, fauxAssistantMessage, fauxText } from "@earendil-works/pi-ai";

registerFauxProvider("test-provider", {
  responses: [fauxAssistantMessage([fauxText("Hello!")])],
  tokensPerSecond: 50,
});
```

## OAuth 支持

```typescript
import { loginAnthropic, loginOpenAICodex, loginGitHubCopilot } from "@earendil-works/pi-ai/oauth";
```

支持 Anthropic Pro/Max、ChatGPT Plus/Pro、GitHub Copilot 的 OAuth 登录。

## Eidon 集成要点

1. **Provider 选择**: 建议同时支持 Anthropic 和 OpenAI 兼容接口（含 DeepSeek 等国内服务）
2. **自定义模型**: 如使用本地 Ollama/LM Studio 或国内 API（阿里百炼、豆包等），使用自定义 `Model` + `compat` 配置
3. **流式输出**: 使用 `stream()` + 事件循环，将 `text_delta` 推送到前端 UI
4. **工具调用**: TypeBox schema 定义参数，`toolcall_delta` 逐步接收参数 JSON
5. **错误处理**: `error` 事件 + `stopReason: "error"` 用于重试逻辑
