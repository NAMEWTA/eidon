# 09 — 自动化/触发式工作流模式

> 参考项目: [pi-chat](https://github.com/earendil-works/pi-chat), [pi-agent-extensions](https://github.com/zach-source/pi-agent-extensions)

## 概述

pi 生态提供了多种自动化、事件驱动和定时触发的 Agent 运行模式。这对 Eidon 的「触发式 AI 交互」设计（按钮点击、定时任务、事件驱动自动执行）具有直接参考价值。

## 模式一：Heartbeat — Cron 式定时任务

来自 `zach-source/pi-agent-extensions` 的 `heartbeat.ts`：

```
heartbeat.md 文件 → 周期性检查 → 唤醒 Agent 执行任务
```

**工作原理**:
1. 扩展读取 `heartbeat.md`（或类似文件）中的任务描述
2. 按固定间隔（如每 5 分钟、每小时）检查
3. 触发 Agent 执行任务
4. Agent 可更新 `heartbeat.md` 标记完成状态

**Eidon 适配**:
```
定时检查 → 触发条件满足？
  ├── 每天 9:00 → 自动生成昨日工作总结
  ├── 每周五 17:00 → 自动整理本周知识库变更
  ├── 每月 1 日 → 自动生成月度报告
  └── 自定义 cron → 自定义任务
```

## 模式二：pi-chat — 事件驱动的多通道 Agent

### 架构

```
┌──────────────────────────────────────────────┐
│                 pi-chat 主进程                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Discord  │  │ Telegram │  │   ...     │   │
│  │ Channel  │  │ Channel  │  │           │   │
│  └────┬─────┘  └────┬─────┘  └──────────┘   │
│       │              │                        │
│  ┌────▼──────────────▼─────────────────────┐ │
│  │         Gondolin VM (每连接独立)         │ │
│  │  /workspace/ ← 频道工作目录              │ │
│  │  /shared/    ← 账户共享目录              │ │
│  │  内置工具: read, write, edit, bash       │ │
│  └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

### 核心特性

| 特性 | 实现 |
|------|------|
| 沙箱隔离 | Gondolin 微 VM（Alpine Linux），每频道独立 |
| 触发方式 | 用户在 Discord/Telegram 发消息 → Agent 自动响应 |
| 持久记忆 | `/shared/memory.md`（账户级）+ `/workspace/memory.md`（频道级） |
| Skills 自动发现 | 每轮交互注入 skills 列表，Agent 按需读取 |
| Worker 编排 | tmux 管理多 Agent 进程，`/chat-spawn-all` 批量启动 |
| 状态监控 | 每 15 秒写入状态快照到 `~/.pi/agent/chat/worker-status/` |

### 远程控制命令

用户可在聊天中发送（无需提及 bot）：

| 命令 | 效果 |
|------|------|
| `stop` | 中止当前轮次 |
| `status` | 显示模型、用量、上下文 |
| `compact` | 触发上下文压缩 |
| `new` | 启动新 pi 会话 |

### Worker 编排

```bash
/chat-spawn-all            # 批量启动所有频道
/chat-spawn-all --restart  # 重启
/chat-workers              # 显示所有 worker 状态
/chat-open-all             # 平铺 tmux 仪表盘
/chat-kill-all             # 终止所有 worker
```

### 安全机制

- **双层加密密钥**: 配置层（HTTP hooks 替换占位符，Agent 永远看不到真实密钥）+ 运行时（RSA-OAEP + AES-256-GCM 加密交换）
- **沙箱隔离**: 每频道独立 VM

## 模式三：AgentHarness — Phase 状态机 + Hook 系统

### Phase 状态机

```
idle ──→ turn ──→ idle
idle ──→ compaction ──→ idle
idle ──→ branch_summary ──→ idle
idle ──→ retry ──→ idle
```

**操作约束**:
- `prompt` / `compact` / `navigateTree` — 必须在 idle 状态
- `steer` / `followUp` / `abort` — 允许在 turn 中调用
- `setModel` / `setTools` 等 setter — 任何时候允许，但只影响下一个 turn

### Turn Snapshot（双层状态）

```
Harness Config (最新设置)
  → createTurnState() → Turn Snapshot (冻结快照)
    → agentLoop 使用 snapshot 执行整个 turn
```

这确保运行时配置变更不会污染正在进行的 LLM 调用。

### Hook 系统

| Hook | 触发点 | 用途 |
|------|--------|------|
| `beforeToolCall` | 参数验证后、执行前 | 拒绝/修改参数/审计 |
| `afterToolCall` | 执行后、`tool_execution_end` 前 | 修改结果/强制终止 |
| `before_provider_request` | LLM 请求发出前 | 修改 stream options/注入 secrets |
| `before_provider_payload` | Payload 序列化前 | 修改最终 payload |
| `after_provider_response` | 响应回到 agent 前 | 审计/记账 |

## 模式四：Steering & Follow-up — 中断与追加

```typescript
// 用户点击"停下解释"按钮
agent.steer({ role: "user", content: "Stop and explain what you're doing" });

// 用户点击"然后写测试"按钮
agent.followUp({ role: "user", content: "Now write tests for all functions" });
```

**队列模式**:
- `steeringMode: "one-at-a-time"` — 每次只投递一条 steering 消息
- `steeringMode: "all"` — 清空队列
- `followUpMode: "one-at-a-time"` / `"all"` — 同上

**Eidon 应用**:
- Steer: 用户在 agent 运行中点"暂停并解释"按钮
- Follow-up: 用户在 agent 完成后点"继续优化"按钮

## 模式五：Session 生命周期自动化

### 事件驱动的自动化

```typescript
// 会话启动时自动注入上下文
pi.on("session_start", async (event, ctx) => {
  const workspaceInfo = await analyzeWorkspace(ctx.cwd);
  // 注入到系统提示
});

// 工具调用时自动审计
pi.on("tool_call", async (event, ctx) => {
  await logToAuditTrail(event);
});

// 会话关闭时自动生成摘要
pi.on("session_shutdown", async (event, ctx) => {
  if (event.reason === "quit") {
    await generateSessionSummary(ctx.sessionManager);
  }
});
```

### 自动 Compaction

```typescript
pi.on("session_before_compact", async (event, ctx) => {
  // 使用自己的模型和策略生成摘要
  const summary = await customSummarize(event.preparation.messagesToSummarize);
  return {
    compaction: {
      summary,
      firstKeptEntryId: event.preparation.firstKeptEntryId,
      tokensBefore: event.preparation.tokensBefore,
    }
  };
});
```

## 模式六：多 Agent 编排

来自 `pi-agent-extensions` 的 `submodule-launcher.ts`：

```
多 Agent 编排
  ├── tmux workers (进程级并行)
  ├── cron scheduling (定时触发)
  ├── webhook triggers (事件驱动)
  ├── auto-recovery (崩溃恢复)
  └── Docker sandboxing (隔离)
```

## Eidon 触发式 AI 的设计蓝图

### 触发条件类型

| 触发类型 | pi 参考模式 | Eidon 实现 |
|----------|-----------|-----------|
| **按钮点击** | pi-chat 远程命令 (`stop`, `status`) | 工具栏按钮 → Agent API 调用 |
| **定时任务** | Heartbeat 扩展 (cron) | Tauri 定时器 / cron 表达式 |
| **文件变更** | `tool_call` 事件 | 文件系统 watcher → Agent 触发 |
| **应用事件** | pi 生命周期事件 | Eidon 事件总线 → Agent 触发 |
| **用户命令** | `/` 命令系统 | 命令面板 / 右键菜单 |
| **Git 事件** | 可自定义扩展 | Git hooks (commit, push, merge) |
| **日程触发** | Heartbeat + calendar | 日历事件 → Agent 触发 |

### 自动化任务示例

```
┌─────────────────────────────────────────────────────────┐
│  触发条件              →  Agent 任务                     │
├─────────────────────────────────────────────────────────┤
│  点击"整理知识库"按钮   →  分析当前 workspace，归纳 L1/L2/L3  │
│  每天 18:00 定时       →  生成今日工作总结                 │
│  新建 L2 节点事件       →  自动建议标签和关联 L1            │
│  每月 1 日定时          →  生成月度知识库报告               │
│  选中文本 + 右键菜单    →  总结/翻译/校对该文本             │
│  Git commit 事件       →  自动生成 changelog              │
│  知识库文件变更         →  自动更新 workspace 索引          │
└─────────────────────────────────────────────────────────┘
```

## Eidon 集成要点

1. **Heartbeat 模式最直接**：用 Tauri 的定时器 + Agent API 实现定时触发
2. **事件总线是核心**：借鉴 pi 的 `pi.on()` 模式，为 Eidon 构建全局事件总线，Agent 作为事件消费者
3. **双队列模式**：steering（中断）+ follow-up（追加）对于交互式 Agent 体验至关重要
4. **Phase 状态机**：借鉴 `idle → turn → idle` 保证操作原子性
5. **Worker 编排**：如果 Eidon 未来需要多个独立 Agent 实例（如每个 workspace 一个），pi-chat 的 tmux worker 模式可参考
6. **不需要 Gondolin VM**：Eidon 是 Tauri 2 桌面应用，已有操作系统级进程隔离
