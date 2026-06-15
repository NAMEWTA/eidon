# 03 — pi-agent-core: Agent 运行时

> 包名: `@earendil-works/pi-agent-core`
> 源码: `packages/agent/`

## 概述

有状态的 Agent 库，提供工具执行和事件流式传输，构建在 `pi-ai` 之上。

## Agent 类（推荐使用）

### 构造函数

```typescript
import { Agent } from "@earendil-works/pi-agent-core";
import { getModel } from "@earendil-works/pi-ai";

const agent = new Agent({
  initialState: {
    systemPrompt: "You are a helpful assistant.",
    model: getModel("anthropic", "claude-sonnet-4-20250514"),
    thinkingLevel: "medium",     // "off" | "minimal" | "low" | "medium" | "high" | "xhigh"
    tools: [myTool],
    messages: [],                // 可选初始消息
  },

  // 必须：将 AgentMessage 转为 LLM Message
  convertToLlm: (messages) => {
    return messages
      .filter(m => m.role !== "notification")  // 过滤 UI-only 消息
      .map(m => ({ role: m.role, content: m.content }));
  },

  // 可选：在 convertToLlm 之前处理消息（裁剪、注入上下文）
  transformContext: async (messages, signal) => {
    // 裁剪旧消息、注入外部上下文...
    return messages;
  },

  // 工具执行模式
  toolExecution: "parallel",     // "parallel" | "sequential"

  // 中断/追加队列模式
  steeringMode: "one-at-a-time", // "one-at-a-time" | "all"
  followUpMode: "one-at-a-time", // "one-at-a-time" | "all"

  // 工具执行钩子
  beforeToolCall: async ({ toolCall, args, context }) => {
    // 返回 { block: true, reason: "..." } 阻止执行
  },
  afterToolCall: async ({ toolCall, result, isError, context }) => {
    // 返回 { terminate: true } 跳过后续 LLM 调用
  },

  // 可选：自定义 stream 函数（代理后端）
  streamFn: streamProxy,

  // 可选：Provider 缓存会话 ID
  sessionId: "session-123",

  // 可选：动态 API key
  getApiKey: async (provider) => process.env[`${provider}_API_KEY`],
});
```

### AgentState（agent.state）

| 属性 | 类型 | 说明 |
|------|------|------|
| `systemPrompt` | `string` | 系统提示词 |
| `model` | `Model<any>` | 当前模型 |
| `thinkingLevel` | `ThinkingLevel` | 思考级别 |
| `tools` | `AgentTool<any>[]` | 工具列表 |
| `messages` | `AgentMessage[]` | 消息历史 |
| `isStreaming` | `boolean` (readonly) | 是否正在流式输出 |
| `streamingMessage` | `AgentMessage` (readonly) | 当前部分助手消息 |
| `pendingToolCalls` | `ReadonlySet<string>` (readonly) | 待执行的工具调用 ID |
| `errorMessage` | `string` (readonly) | 最近的错误消息 |

### 核心方法

#### 提示

```typescript
// 发送文本
await agent.prompt("What is the capital of France?");

// 带附件（图片）
await agent.prompt("Describe this image", [
  { type: "image", data: base64String, mimeType: "image/png" }
]);

// 发送原始 AgentMessage
await agent.prompt({ role: "user", content: [{ type: "text", text: "Hello" }] });

// 继续（不添加新消息）
await agent.continue();
// 前提：上下文中最后一条消息必须是 user 或 toolResult（不能是 assistant）
```

全部返回 `Promise<void>`。

#### 控制

```typescript
agent.abort();           // 取消当前操作
await agent.waitForIdle(); // 等待完成
agent.reset();           // 重置所有状态
```

#### 中断与追加

```typescript
// Steer: 在工具运行期间注入消息
agent.steer({ role: "user", content: [{ type: "text", text: "Stop and explain first" }] });

// Follow-up: Agent 即将停止时追加工作
agent.followUp({ role: "user", content: [{ type: "text", text: "Also write tests" }] });

// 队列管理
agent.clearSteeringQueue();
agent.clearFollowUpQueue();
agent.clearAllQueues();
```

#### 事件订阅

```typescript
const unsubscribe = agent.subscribe((event, signal) => {
  switch (event.type) {
    case "agent_start":       // Agent 开始处理
    case "agent_end":         // 最终事件（本 run 不会再有事件）
    case "turn_start":        // 新一轮开始
    case "turn_end":          // 轮次结束（含 assistant 消息 + tool results）
    case "message_start":     // 任何消息开始
    case "message_update":    // 仅 assistant，含 delta
    case "message_end":       // 消息完成
    case "tool_execution_start": // 工具开始执行
    case "tool_execution_update": // 工具输出流式更新
    case "tool_execution_end":   // 工具执行完成
  }
});

// 取消订阅
unsubscribe();
```

**重要**: 订阅者按注册顺序被 `await`（串行）。`agent_end` 事件意味着"循环不会再发出事件"，但 `waitForIdle()` 和 `prompt()` 在所有 `agent_end` 订阅者完成后才 resolve。

### 事件序列

**无工具调用时**:
```
agent_start → turn_start → message_start/end(user) → message_start(assistant)
→ message_update*(chunks) → message_end → turn_end → agent_end
```

**有工具调用时**:
```
agent_start → turn_start → ... → message_end(assistant, stopReason="toolUse")
→ tool_execution_start* (每个工具) → tool_execution_end*
→ message_start/end(toolResult)*
→ turn_end
→ [下一轮 turn_start (如果 LLM 需要更多工具调用)]
→ agent_end
```

**continue() 序列**: 与 prompt() 相同，但没有初始的 user message 事件。

**关键行为**:
- assistant `message_end` 是 barrier——处理完后才开始工具预检
- `beforeToolCall` 看到的状态已包含请求该工具的 assistant 消息
- `afterToolCall` 可返回 `{ terminate: true }`；仅当批次中所有工具都设置 `terminate: true` 时循环才提前停止

## AgentTool 定义

```typescript
import { Type } from "@sinclair/typebox";

interface AgentTool<Params = any> {
  name: string;
  label?: string;                    // UI 显示名
  description: string;
  parameters: TypeBox.ObjectSchema;  // 参数 schema
  executionMode?: "sequential" | "parallel"; // 覆盖全局设置

  execute: (
    toolCallId: string,
    params: Record<string, any>,
    signal: AbortSignal,
    onUpdate?: (update: any) => void
  ) => Promise<{
    content: { type: "text"; text: string }[];
    details?: Record<string, any>;
    terminate?: boolean;             // 提示跳过后续 LLM 调用
  }>;
}
```

### 错误处理

**抛出异常来标记工具失败，不要返回错误消息。** Agent 会自动捕获异常并报告给 LLM（`isError: true`）。

```typescript
// ✅ 正确
if (fileNotFound) throw new Error(`File not found: ${path}`);

// ❌ 错误
return { content: [{ type: "text", text: "Error: file not found" }] };
```

## 自定义消息类型

通过 TypeScript 声明合并扩展 AgentMessage：

```typescript
declare module "@earendil-works/pi-agent-core" {
  interface CustomAgentMessages {
    notification: {
      role: "notification";
      text: string;
      timestamp: number;
    };
  }
}
```

然后在 `convertToLlm()` 中处理自定义类型（过滤或转换为 LLM 理解的格式）。

## 思考级别与预算

| 级别 | 默认 Token 预算 |
|------|----------------|
| `minimal` | 128 |
| `low` | 512 |
| `medium` | 1024 |
| `high` | 2048 |
| `xhigh` | (无默认) |

可自定义：`agent.thinkingBudgets = { minimal: 256, low: 1024, ... }`

## 低层 API: agentLoop / agentLoopContinue

用于无状态场景或嵌入已有框架：

```typescript
import { agentLoop, agentLoopContinue } from "@earendil-works/pi-agent-core";

const stream = agentLoop(messages, context, config);
// stream: AsyncIterable<AgentLoopEvent>

for await (const event of stream) {
  // 处理事件...
}
```

**注意**: 低层 API 不等待异步事件处理完成。如需 barrier 处理（assistant message 完成后才进行工具预检），使用 `Agent` 类。

### shouldStopAfterTurn

```typescript
config: {
  shouldStopAfterTurn: async ({ message, toolResults, context, newMessages }) => {
    // 返回 true 则在 turn_end 后发射 agent_end 并停止
    return message.stopReason === "stop";
  }
}
```

## Eidon 集成要点

1. **直接使用 Agent 类**：不需要 agentLoop 的无状态模式，也不需要 AgentHarness 的 JSONL 持久化
2. **convertToLlm 是关键钩子**：在这里过滤 UI 消息、注入 Eidon 的上下文（L1/L2/L3 节点信息、workspace 状态等）
3. **transformContext 用于上下文管理**：裁剪旧消息、注入 workspace 索引信息
4. **beforeToolCall/afterToolCall 用于权限控制**：敏感操作（文件写入、网络请求）需要用户确认
5. **事件订阅驱动 UI 更新**：`message_update` → 流式显示，`tool_execution_*` → 工具状态指示器
6. **AgentTool 定义 Eidon 专属工具**：读取节点、搜索知识库、导出报告等
