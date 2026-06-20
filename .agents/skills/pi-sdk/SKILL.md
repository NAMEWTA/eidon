---
name: pi-sdk
description: |
  Comprehensive reference for the @earendil-works/pi-ai and @earendil-works/pi-coding-agent SDKs.
  Use when: (1) Integrating AI/LLM capabilities into EIDON using the Pi framework, (2) Creating AgentSession-based chat/agent features, (3) Configuring AI providers/models/API keys in EIDON, (4) Defining EIDON-specific AI tools (read_node, search_kb, git_diff, etc.), (5) Implementing AI-assisted features (chat panel, inline AI menu, trigger-based automation), (6) Working with stream/complete API for model communication, (7) Setting up OAuth or API-key authentication for AI providers, (8) Any code under backend/domain/ai/ or involving pi-ai/pi-coding-agent imports.
---

# Pi SDK Reference for EIDON

Provides complete API references for both Pi SDK packages and EIDON integration guidance.

## Quick Reference

Read the relevant reference file based on your task:

| Task | Reference |
|------|-----------|
| Model communication (`stream`, `complete`, model discovery, types) | [references/pi-ai-api.md](references/pi-ai-api.md) |
| Agent sessions (`createAgentSession`, tools, events, compaction) | [references/pi-coding-agent-api.md](references/pi-coding-agent-api.md) |
| EIDON architecture mapping, IPC channels, integration phases | [references/eidon-integration.md](references/eidon-integration.md) |

## Package Relationship

```
@earendil-works/pi-ai              @earendil-works/pi-coding-agent
┌──────────────────────┐           ┌────────────────────────────┐
│ Model discovery       │           │ AgentSession (lifecycle)   │
│ stream / complete     │◄──────────│ Agent (loop + tool exec)   │
│ Tool (TypeBox schema) │  uses as  │ SessionManager (persist)   │
│ Context / Message     │  transport│ ModelRegistry (discovery)  │
│ Auth (OAuth + env)    │           │ AuthStorage (key resolve)  │
│ 33 KnownProviders     │           │ Tool factories (read/bash) │
└──────────────────────┘           │ Extensions system          │
                                   │ Compaction / Summarization  │
                                   │ ResourceLoader (skills/etc) │
                                   └────────────────────────────┘
```

- **pi-ai** = 模型通信层：发送请求、接收流式响应。无 agent 概念。
- **pi-coding-agent** = agent 会话编排层：用 pi-ai 做 transport，管理对话生命周期、工具执行循环、压缩、扩展。

## EIDON 分层约束

EIDON 代码分层：`frontend → bridge → backend(ipc→service→domain) + shared`

```
backend/domain/ai/     ← 唯一允许导入 Pi SDK 的层
  ├── agent.ts         ← createAgentSession 封装
  ├── provider.ts      ← ModelRegistry + AuthStorage
  ├── tools/*.ts       ← EIDON 专属 defineTool() 定义
  ├── compaction.ts    ← 自定义压缩（保留节点引用）
  └── scheduler.ts     ← 定时/事件触发自动化
```

**禁止**：`frontend/`、`bridge/`、`backend/ipc/`、`backend/capabilities/` 直接导入 Pi SDK。

**允许**：`backend/domain/ai/` 可导入 Pi SDK 和 `shared/models/ai.ts`。前端通过 IPC 通道（`ai:prompt` 等）间接触发 AI 功能。

## 关键入口点选择

| 场景 | 入口 |
|------|------|
| 只需模型通信（无 agent 循环） | `@earendil-works/pi-ai` |
| 需要 agent 循环 + 工具执行 | `@earendil-works/pi-coding-agent` + `@earendil-works/pi-ai` |
| Tree-shaking / 按需加载 provider | `@earendil-works/pi-ai/base` + 手动 `register*()` |
| OAuth 登录 | `@earendil-works/pi-ai/oauth` |

## 最小集成示例

```typescript
// backend/domain/ai/agent.ts
import { createAgentSession, SessionManager, AuthStorage, ModelRegistry }
  from "@earendil-works/pi-coding-agent";
import { getModel } from "@earendil-works/pi-ai";

export async function initAgent(apiKey: string) {
  const authStorage = AuthStorage.create();
  authStorage.setRuntimeApiKey("anthropic", apiKey);

  const model = getModel("anthropic", "claude-sonnet-4-6");

  const { session } = await createAgentSession({
    model,
    thinkingLevel: "high",
    sessionManager: SessionManager.inMemory(),
    authStorage,
    modelRegistry: ModelRegistry.inMemory(authStorage),
    customTools: [/* EIDON 专属工具 */],
  });

  return session;
}
```

完整 EIDON 工具定义示例见 [references/eidon-integration.md](references/eidon-integration.md)。

## Common Pitfalls

1. **event subscription lifetime** — `AgentSessionRuntime.session` 切换后指向新实例，旧订阅失效，需重新 `subscribe()`。
2. **dispose** — 窗口关闭/会话切换时必须调用 `session.dispose()` 释放后台资源。
3. **Electron sandbox** — Pi SDK 运行在 main process（backend），前端不能直接导入；通过 IPC 事件推送流式内容。
4. **compaction in EIDON** — 节点内容可能很大（几十KB），默认压缩可能丢失关键引用；需自定义 `transformContext`。
5. **API key in Electron** — 不能依赖 OAuth 自动登录（浏览器环境专用）；必须通过 IPC 传递 or 从 `auth.json`/环境变量读取。
