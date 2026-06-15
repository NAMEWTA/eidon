# 07 — 事件系统与生命周期

> 源文件: `packages/coding-agent/docs/extensions.md`
> 相关: [03-Agent 运行时](./03-pi-agent-core.md) | [06-扩展 API](./06-extensions-api.md)

## 概述

pi 的事件系统贯穿两层：
1. **Agent 核心层**（`pi-agent-core`）: `agent.subscribe()` — 运行时事件
2. **扩展层**（`pi-coding-agent`）: `pi.on()` — 生命周期钩子

## Agent 核心层事件

通过 `agent.subscribe((event, signal) => {...})` 订阅：

| 事件 | 说明 |
|------|------|
| `agent_start` | Agent 开始处理 |
| `agent_end` | 最终事件（本 run 不再有新事件） |
| `turn_start` | 新一轮开始（一次 LLM 调用 + 工具执行） |
| `turn_end` | 轮次结束（含 assistant 消息 + tool results） |
| `message_start` | 任何消息开始（user/assistant/toolResult） |
| `message_update` | 仅 assistant，含增量 delta |
| `message_end` | 消息完成 |
| `tool_execution_start` | 工具开始执行 |
| `tool_execution_update` | 工具流式输出 |
| `tool_execution_end` | 工具执行完成 |

**关键行为规则**:
- 订阅者按注册顺序被串行 `await`（顺序保证）
- assistant `message_end` 是 barrier——完成后才开始工具预检
- `agent_end` 事件后循环不再发出事件，但 `waitForIdle()` 和 `prompt()` 等待所有 `agent_end` 订阅者完成后才 resolve
- 在并行模式下工具并发执行，但 toolResult 消息按 assistant 源顺序持久化

## 扩展层事件（完整清单）

通过 `pi.on(event, handler)` 订阅，handler 接收 `(event, ctx: ExtensionContext)`。

### 启动与信任

| 事件 | 触发时机 | Handler 可返回 |
|------|----------|---------------|
| `project_trust` | 信任决策前（仅用户/全局扩展可用） | `{ trusted: "yes" \| "no" \| "undecided", remember?: boolean }` |
| `session_start` | 会话加载/启动后 | `{ reason, previousSessionFile? }` |
| `resources_discover` | session_start 后 | `{ reason: "startup" \| "reload" }` — 返回 `{ skillPaths, promptPaths, themePaths }` 添加动态资源路径 |

### Agent 循环事件

| 事件 | 触发时机 | 关键 Payload | 可返回 |
|------|----------|-------------|--------|
| `input` | 原始用户输入，展开前 | `{ text, images, source, streamingBehavior }` | `{ action: "continue" \| "transform" \| "handled" }` |
| `before_agent_start` | Agent 循环前 | `{ prompt, images, systemPrompt, systemPromptOptions }` | 注入消息或修改 systemPrompt |
| `agent_start` | 每次 prompt 开始时 | — | — |
| `agent_end` | 每次 prompt 结束时 | `{ messages }` | — |
| `turn_start` | 每轮开始时 | `{ turnIndex, timestamp }` | — |
| `turn_end` | 每轮结束时 | `{ turnIndex, message, toolResults }` | — |
| `message_start` | 消息开始时 | — | — |
| `message_update` | 流式增量 | — | — |
| `message_end` | 消息完成时 | — | `{ message }` 替换消息（须保持相同 role） |
| `context` | 每次 LLM 调用前 | `{ messages }` | `{ messages: filtered }` 修改上下文 |
| `before_provider_request` | HTTP 请求发出前 | `{ payload }` | 替换请求 payload |
| `after_provider_response` | HTTP 响应后 | `{ status, headers }` | — |

### 工具生命周期事件

| 事件 | 触发时机 | 关键 Payload | 可返回 |
|------|----------|-------------|--------|
| `tool_call` | 工具执行前 — **可阻止** | `{ toolName, toolCallId, input }` | `{ block: true, reason? }` 或就地修改 `input` |
| `tool_execution_start` | 工具开始执行 | `{ toolCallId, toolName, args }` | — |
| `tool_execution_update` | 工具流式更新 | — | — |
| `tool_execution_end` | 工具完成 | `{ toolCallId, toolName, result?, isError? }` | — |
| `tool_result` | 执行后 — **可修改** | `{ toolName, content, details, isError }` | 返回部分补丁（可链式） |

### 会话导航事件

| 事件 | 触发时机 | 可用于 |
|------|----------|--------|
| `session_before_switch` | `/new` 或 `/resume` 前 | 返回 `{ cancel: true }` 阻止 |
| `session_before_fork` | `/fork` 或 `/clone` 前 | 返回 `{ cancel: true }` 或 `{ skipConversationRestore }` |
| `session_shutdown` | 会话运行时拆卸 | `{ reason: "quit" \| "reload" \| "new" \| "resume" \| "fork", targetSessionFile? }` |
| `session_before_compact` | 压缩前 | 取消或提供自定义摘要 |
| `session_compact` | 压缩后 | — |
| `session_before_tree` | `/tree` 导航前 | 取消或提供自定义摘要 |
| `session_tree` | `/tree` 导航后 | — |

### 模型事件

| 事件 | 触发时机 | 说明 |
|------|----------|------|
| `model_select` | 模型变更 | `{ model, previousModel, source: "set" \| "cycle" \| "restore" }` |
| `thinking_level_select` | 思考级别变更 | `{ level, previousLevel }` — 仅通知 |

### 用户 Bash

| 事件 | 触发时机 | 关键 Payload |
|------|----------|-------------|
| `user_bash` | `!` / `!!` 命令 | `{ command, excludeFromContext, cwd }` — 返回自定义 `operations` 或 `{ result }` |

## 关键 Hook 详解

### `project_trust` — 信任决策 Hook

在项目受信决策前触发。可用于实现自定义信任策略：

```typescript
pi.on("project_trust", async (event, ctx) => {
  // event.projectDir, event.settings, event.extensions, event.skills, ...
  if (isKnownSafeProject(event.projectDir)) {
    return { trusted: "yes", remember: true };
  }
  return { trusted: "undecided" }; // 让 pi 默认逻辑处理
});
```

### `tool_call` — 工具阻断 Hook

最强的权限控制点。在工具参数验证后、执行前触发：

```typescript
pi.on("tool_call", async (event, ctx) => {
  if (event.toolName === "bash") {
    // 检查命令是否安全
    if (isDangerous(event.input.command)) {
      const allowed = await ctx.ui.confirm("Warning", "Allow this command?");
      if (!allowed) return { block: true, reason: "User denied" };
    }
  }
});
```

### `context` — 上下文修改 Hook

在每次 LLM 调用前触发，可裁剪或注入消息：

```typescript
pi.on("context", async (event, ctx) => {
  const currentMessages = event.messages;
  // 裁剪到最近 N 条消息
  const trimmed = trimMessages(currentMessages, maxTokens);
  return { messages: trimmed };
});
```

### `before_agent_start` — 启动注入 Hook

```typescript
pi.on("before_agent_start", async (event, ctx) => {
  // 注入当前 workspace 信息
  const workspaceContext = await buildWorkspaceContext(ctx.cwd);
  event.systemPrompt += `\n\n## Current Workspace\n${workspaceContext}`;
  // 可注入初始消息
  // event.messages.push(...)
});
```

## 完整生命周期流程

### 一次 prompt() 调用的完整流程

```
用户输入 "Hello"
  → input 事件 (可 transform/handle)
  → before_agent_start 事件 (可注入/修改)
  → Agent Loop 开始
    → turn_start
      → context 事件 (修改上下文)
      → before_provider_request (修改请求)
      → LLM 调用
      → after_provider_response
      → message_start (user)
      → message_end (user)
      → message_start (assistant)
      → message_update* (流式增量)
      → message_end (assistant)
      → [如有工具调用]
        → tool_call 事件 (每个工具，可 block)
        → tool_execution_start (每个工具)
        → tool_execution_update* (流式输出)
        → tool_execution_end (每个工具)
        → tool_result 事件 (可修改结果)
        → message_start/end (toolResult)
    → turn_end
    → [如需要更多工具调用，开始新的 turn]
  → Agent Loop 结束
  → agent_end
```

### 会话生命周期

```
启动 → project_trust → session_start → resources_discover → [用户交互循环] → session_shutdown
                              ↑                                                      ↓
                              └──────────── reload / new / resume / fork ─────────────┘
```

## 错误处理策略

- 扩展错误被记录但不中止 agent
- `tool_call` 事件中的错误会**阻止工具执行**（fail-safe）
- 工具 `execute` 中的错误通过**抛出异常**来传达（`isError: true`）
- "返回一个值永远不会设置错误标志，无论你包含什么属性"

## Eidon 集成要点

1. **双事件层模式**：Eidon 应设计类似的两层事件——Agent 运行时事件（订阅者模式）+ 应用生命周期事件（Hook 模式）
2. **权限控制**：`tool_call` + `block: true` 模式直接适用——敏感操作（文件写入、网络请求、代码执行）需要用户确认
3. **上下文注入**：`before_agent_start` 和 `context` 事件是最关键的集成点——注入当前 workspace 状态、L1/L2/L3 节点信息、用户偏好
4. **会话管理**：`session_start` / `session_shutdown` 模式映射到 Eidon 的 workspace 生命周期
5. **事件顺序**：订阅者串行 await 模式对于 Eidon 的中间件/插件系统很有参考价值
