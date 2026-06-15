# 01 — Pi 架构总览

## Monorepo 结构

```
packages/
├── ai/              # @earendil-works/pi-ai          — 多提供商 LLM API
├── agent/           # @earendil-works/pi-agent-core   — Agent 运行时
├── coding-agent/    # @earendil-works/pi-coding-agent — CLI 编码代理
└── tui/             # @earendil-works/pi-tui           — 终端 UI 库
```

另有独立项目 [earendil-works/pi-chat](https://github.com/earendil-works/pi-chat) — Discord/Telegram 聊天集成。

## 三层 API 设计（核心架构）

这是 pi 最重要的架构决策。三层从低到高，逐层增加状态管理和工程化能力：

```
┌──────────────────────────────────────────────┐
│            AgentHarness (L3)                 │
│  • 磁盘持久化 (.jsonl sessions)              │
│  • Phase 状态机 (idle→turn→compaction→idle)  │
│  • Turn Snapshot (运行时配置隔离)             │
│  • Hook/扩展系统                              │
│  • Pending session writes (事件顺序保证)       │
├──────────────────────────────────────────────┤
│              Agent (L2)                      │
│  • 内存状态管理 (AgentState)                  │
│  • 多订阅者事件流                             │
│  • steer/followUp 队列 (中断/追加)            │
│  • 热替换配置 (model/tools/systemPrompt)      │
│  • transformContext / convertToLlm 桥接      │
├──────────────────────────────────────────────┤
│           agentLoop (L1)                     │
│  • 纯 async generator (零内部状态)            │
│  • 输入: messages + context + config         │
│  • 输出: AsyncIterable<AgentLoopEvent>       │
│  • 无 barrier 处理（事件不等待订阅者）         │
└──────────────────────────────────────────────┘
```

### 层级选择指南

| 场景 | 推荐层级 |
|------|----------|
| 无状态批处理、嵌入已有框架 | `agentLoop` (L1) |
| 浏览器聊天 UI、需要事件订阅 | `Agent` (L2) |
| CLI 工具、需要持久化/扩展/会话管理 | `AgentHarness` (L3) |

### Eidon 建议

**使用 L2 (Agent 类)** 作为核心运行时：
- 需要事件订阅（流式输出到 React UI）
- 需要 steer/followUp 队列（用户中途打断）
- 不需要 L3 的 JSONL 持久化（Eidon 有节点系统的 `.node/node.json` + Zustand store）
- **落点**：`app/core/ai/agent.ts`（纯 TS、框架无关、可 Node 下单测，遵守三层【代码】约束）

如有需要，可以借鉴 L3 的 Phase 状态机和 Hook 系统设计。

## 核心数据流

```
用户输入
  → Agent.prompt(text)
    → state.messages.push(userMessage)
    → transformContext(messages) — 可选：裁剪、注入外部上下文
    → convertToLlm(messages)     — 必须：过滤 UI-only 消息、转换自定义类型
    → LLM stream (via pi-ai)
    → 事件流 (agent_start → turn_start → message_start → message_update* → message_end → tool_execution* → turn_end → agent_end)
    → 订阅者处理事件
  → prompt() resolve
```

## 关键设计模式

### 1. 消息分层：AgentMessage vs LLM Message

- **AgentMessage**: 扩展的消息类型，支持自定义消息（通过 TS declaration merging）
- **LLM Message**: 标准 LLM 消息格式
- **桥接**: `convertToLlm()` 在每次 LLM 调用前将 AgentMessage 转为 LLM Message

### 2. 工具执行模式

- `parallel`（默认）：工具并发执行
- `sequential`：按顺序执行
- 可通过全局配置或单个工具的 `executionMode` 字段覆盖
- **关键规则**：如果批次中任一工具标记为 `sequential`，整个批次顺序执行

### 3. Steering & Follow-up 队列

- **Steer**: 在工具运行期间注入消息（用户中途打断）
- **Follow-up**: Agent 即将停止时追加工作（"做完这个之后再..."）
- 模式：`one-at-a-time`（默认）或 `all`

### 4. Turn Snapshot（L3 特性）

Harness 层的双层状态模型：
- **Harness Config**: 上层最新设置（getter/setter 立即生效）
- **Turn Snapshot**: 每个 turn 开始时从 config 快照，turn 内不变

这确保运行时配置变更不会污染正在进行的 LLM 调用。

## 参考

- Pi GitHub: https://github.com/earendil-works/pi
- 官网: https://pi.dev
- 文档: https://pi.dev/docs/latest
- DeepWiki: https://deepwiki.com/badlogic/pi-mono
