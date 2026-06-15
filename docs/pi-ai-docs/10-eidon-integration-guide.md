# 10 — Eidon AI Agent 集成指南

> 基于对 [pi monorepo](https://github.com/earendil-works/pi) 的深度调研。
> **Eidon 技术栈**：Tauri 2 + React 19 + Rust | 三层【代码】= `src(React UI) → core(TS 业务核心) → src-tauri(Rust 能力壳)`
>
> **前置状态**：原 SoloMD AI·Agent·Recipes 已物理删除（ADR-0018/0019）。
> `core/ai/` 仅留接口占位（类型 + `AiNotConnectedError` + `isAiAvailable()=false`）。
> 本指南描述如何在此占位上重建双模式 AI Agent。

---

## 〇、当前起点：core/ai 占位契约

```typescript
// app/core/ai/index.ts — 已存在，需替换实现（保留类型签名）
export type ApiFormat = "anthropic" | "openai" | "ollama" | (string & {});
export type ChatMessage = { role: string; content: string };
export type AiProviderConfig = {
  provider: string; apiFormat: ApiFormat; model: string; baseUrl?: string | null;
};
export type StreamEvent =
  | { type: "text"; text: string }
  | { type: "done"; fullText: string }
  | { type: "error"; error: string };
export type StreamHandler = (event: StreamEvent) => void;
export type ChatLoopRequest = AiProviderConfig & { messages: ChatMessage[]; requestId: string };
export type ChatLoopResult = { text: string; tokensIn?: number; tokensOut?: number };

export const isAiAvailable = (): boolean => false;     // ← 需翻转为 true
export const runChatLoop = async (request, onEvent) => { throw new AiNotConnectedError(); };
export const cancelChat = async (requestId) => {};      // ← 需替换实现
```

**硬约束（AGENTS.md §2.1 / §4.1 / §4.3）**:
- `core/ai/` 属 core 层，**禁 import React / Zustand / 任何 UI 框架**
- 如需 Rust 能力（密钥存储、HTTP 透传），**只能**经 `core/bridge/` 新增 typed wrapper
- 前端只能 import `core/ai/index.ts` 暴露的公共 API
- 三层【代码】单向依赖 `src → core → src-tauri` 不可反向
- ESLint `no-restricted-imports` + `eslint-plugin-boundaries` 机器强制

---

## 一、目标架构（对齐 Eidon 三层【代码】）

```
app/src (React UI)               app/core (TS 业务核心)            app/src-tauri (Rust)
─────────────────                ──────────────────────            ──────────────────

┌──────────────────────┐        ┌──────────────────────┐        ┌───────────────────┐
│  ChatPanel.tsx        │        │  core/ai/             │        │  src/ai/ (可选)    │
│  InlineSuggest.tsx    │import  │  ├─ agent.ts          │invoke  │  ├─ proxy.rs      │
│  AIContextMenu.tsx    │──────→ │  ├─ provider.ts       │──────→ │  └─ keychain.rs   │
│  AICommandPalette.tsx │        │  ├─ tools/            │        └───────────────────┘
│  AITriggerButton.tsx  │        │  │   ├─ read-node.ts  │
│  stores/aiStore.ts    │        │  │   ├─ search-kb.ts  │        ┌───────────────────┐
└──────────────────────┘        │  │   └─ export-rpt.ts  │        │  editor/file_ops  │
                                │  ├─ compaction.ts     │        │  knowledge/search  │
┌──────────────────────┐        │  ├─ scheduler.ts      │        │  git/git_history   │
│  triggers/            │        │  └─ event-bus.ts      │        └───────────────────┘
│  ├─ scheduler.ts      │import  └──────────┬───────────┘          ↑ 复用现有 Rust 能力
│  ├─ button-actions.ts │                   │
│  └─ event-handlers.ts │        ┌──────────▼───────────┐
└──────────────────────┘        │  core/bridge/         │
                                │  └─ ai.ts (新增)       │  ← 唯一可调 Tauri API
                                └──────────────────────┘
```

**落点规则**（AGENTS.md §4.1）:
| 新增内容 | 落点 |
|---------|------|
| AI 对话核心、Provider、工具、压缩 | `core/ai/` 下新建文件 |
| Tauri 命令 wrapper（密钥、HTTP 透传） | `core/bridge/` 新增 typed wrapper |
| Rust 侧能力（如需） | `src-tauri/src/ai/` + 在 `lib.rs`/`runner.rs` 各加 `#[path]` |
| React UI 组件 | `app/src/components/` |
| Zustand store | `app/src/stores/` |

---

## 二、core/ai/ 实现方案（借鉴 pi-agent-core）

### 2.1 整体文件结构

```
app/core/ai/
├── index.ts              # 公共 API（已有占位，扩展签名）
├── agent.ts              # EidonAgent 类（借鉴 pi 的 Agent 类）
├── provider.ts           # LLM Provider 实现（借鉴 pi-ai 的 getModel+stream）
├── types.ts              # 扩展类型：AgentMessage、AgentTool、AgentEvent 等
├── compaction.ts         # 上下文压缩（借鉴 pi 的 compaction 策略）
├── tools/                # Eidon 专属工具
│   ├── index.ts
│   ├── read-node.ts      # 读取节点内容
│   ├── search-kb.ts      # 搜索知识库
│   ├── get-workspace.ts  # 获取 workspace 概览
│   ├── linked-nodes.ts   # 获取关联节点
│   └── export-report.ts  # 导出报告
├── scheduler.ts          # 定时任务调度（借鉴 heartbeat 模式）
├── event-bus.ts          # 事件总线（借鉴 pi.on + pi.events）
└── __tests__/            # 纯 Node 下单测（无 UI 依赖）
    ├── agent.test.ts
    ├── provider.test.ts
    ├── tools.test.ts
    └── compaction.test.ts
```

### 2.2 EidonAgent 类（核心 — 借鉴 pi-agent-core 的 Agent 类）

```typescript
// app/core/ai/agent.ts
// 属 core 层：禁 import React/Zustand/@tauri-apps/api

import type { ChatMessage, ChatLoopRequest, StreamHandler } from "./index";
import type { AgentTool, AgentEvent, AgentConfig, ThinkingLevel } from "./types";
import { EventBus } from "./event-bus";

export class EidonAgent {
  // —— 借鉴 pi 的 AgentState ——
  private _systemPrompt: string;
  private _model: AiProviderConfig;
  private _thinkingLevel: ThinkingLevel;
  private _tools: AgentTool[];
  private _messages: ChatMessage[];
  private _isStreaming: boolean = false;

  // —— 借鉴 pi 的事件订阅 ——
  private eventBus = new EventBus<AgentEvent>();
  private steeringQueue: ChatMessage[] = [];
  private followUpQueue: ChatMessage[] = [];

  // —— 借鉴 pi 的上下文转换桥 ——
  private transformContext?: (messages: ChatMessage[], signal: AbortSignal) => Promise<ChatMessage[]>;
  private convertToLlm?: (messages: ChatMessage[]) => ChatMessage[];

  // —— 借鉴 pi 的双队列模式 ——
  steeringMode: "one-at-a-time" | "all" = "one-at-a-time";
  followUpMode: "one-at-a-time" | "all" = "one-at-a-time";
  toolExecution: "parallel" | "sequential" = "parallel";

  constructor(config: AgentConfig) {
    this._systemPrompt = config.initialState.systemPrompt;
    this._model = config.initialState.model;
    this._thinkingLevel = config.initialState.thinkingLevel ?? "medium";
    this._tools = config.initialState.tools ?? [];
    this._messages = config.initialState.messages ?? [];
    this.transformContext = config.transformContext;
    this.convertToLlm = config.convertToLlm;
  }

  // ===== 提示（借鉴 pi 的 agent.prompt / agent.continue）=====

  /** 发送用户消息并启动 Agent 循环 */
  async prompt(text: string): Promise<void> {
    this._messages.push({ role: "user", content: text });
    await this._runLoop();
  }

  /** 从当前位置继续（不添加新消息） */
  async continue(): Promise<void> {
    const lastMsg = this._messages[this._messages.length - 1];
    if (!lastMsg || lastMsg.role === "assistant") {
      throw new Error("Last message must be user or toolResult to continue");
    }
    await this._runLoop();
  }

  // ===== 控制（借鉴 pi 的 abort / reset / steer / followUp）=====

  abort(): void { /* 取消当前 LLM 请求 */ }
  reset(): void { this._messages = []; }
  steer(message: ChatMessage): void { this.steeringQueue.push(message); }
  followUp(message: ChatMessage): void { this.followUpQueue.push(message); }

  // ===== 事件订阅（借鉴 pi 的 agent.subscribe）=====

  subscribe(handler: (event: AgentEvent) => void): () => void {
    return this.eventBus.on("*", handler);
  }

  // ===== 内部循环（借鉴 pi 的 Agent Loop）=====

  private async _runLoop(): Promise<void> {
    this._isStreaming = true;
    this.eventBus.emit({ type: "agent_start" });

    try {
      let shouldContinue = true;
      while (shouldContinue && this._isStreaming) {
        // 1. 上下文转换
        let ctx = [...this._messages];
        if (this.transformContext) {
          ctx = await this.transformContext(ctx, new AbortSignal()); // TODO: 真实 AbortSignal
        }
        if (this.convertToLlm) {
          ctx = this.convertToLlm(ctx);
        }

        // 2. LLM 调用
        this.eventBus.emit({ type: "turn_start", turnIndex: 0 });
        const response = await this._callLLM(ctx);
        this._messages.push({ role: "assistant", content: response.text });
        this.eventBus.emit({ type: "turn_end", message: response });

        // 3. 检查是否需要更多工具调用或继续
        shouldContinue = false; // 简化：单轮

        // 4. 处理 steering / followUp 队列
        if (this.steeringQueue.length > 0) {
          const msg = this.steeringMode === "all"
            ? this.steeringQueue.splice(0)
            : [this.steeringQueue.shift()!];
          this._messages.push(...msg);
          shouldContinue = true;
        }
      }
    } finally {
      this._isStreaming = false;
      this.eventBus.emit({ type: "agent_end" });

      // followUp: agent 结束后排队
      if (this.followUpQueue.length > 0) {
        const msg = this.followUpMode === "all"
          ? this.followUpQueue.splice(0)
          : [this.followUpQueue.shift()!];
        this._messages.push(...msg);
        await this._runLoop(); // 递归触发新一轮
      }
    }
  }

  private async _callLLM(messages: ChatMessage[]): Promise<{ text: string }> {
    // 调用 provider.ts 的流式接口，emit message_update 事件
    // ...
    return { text: "" };
  }

  // ===== 状态访问器 =====
  get messages(): ChatMessage[] { return this._messages; }
  get isStreaming(): boolean { return this._isStreaming; }
  get systemPrompt(): string { return this._systemPrompt; }
  set systemPrompt(value: string) { this._systemPrompt = value; }
}
```

### 2.3 消息类型 vs LLM 消息（借鉴 pi 的 AgentMessage 分层）

```typescript
// app/core/ai/types.ts
// 借鉴 pi 的 AgentMessage 扩展机制

/** Eidon 内部的扩展消息类型 */
export type EidonMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; toolCalls?: ToolCall[] }
  | { role: "toolResult"; toolCallId: string; toolName: string; content: string; isError?: boolean }
  | { role: "workspace-context"; data: WorkspaceSnapshot }   // 自定义：不发给 LLM
  | { role: "ui-event"; eventType: string; payload: unknown }; // 自定义：仅 UI 使用

/** Agent 工具定义（借鉴 pi 的 AgentTool） */
export interface AgentTool<Params = Record<string, unknown>> {
  name: string;
  label?: string;
  description: string;
  parameters: Record<string, unknown>; // 简化：用 zod 替代 TypeBox
  executionMode?: "parallel" | "sequential";
  execute: (
    toolCallId: string,
    params: Params,
    signal: AbortSignal,
    onUpdate?: (update: unknown) => void,
  ) => Promise<{
    content: { type: "text"; text: string }[];
    details?: Record<string, unknown>;
    terminate?: boolean;
  }>;
}

/** Agent 事件类型（借鉴 pi 的事件系统） */
export type AgentEvent =
  | { type: "agent_start" }
  | { type: "agent_end" }
  | { type: "turn_start"; turnIndex: number }
  | { type: "turn_end"; message: ChatMessage; toolResults?: ToolResult[] }
  | { type: "message_update"; delta: string }
  | { type: "tool_execution_start"; toolCallId: string; toolName: string }
  | { type: "tool_execution_update"; toolCallId: string; update: unknown }
  | { type: "tool_execution_end"; toolCallId: string; result?: unknown; isError?: boolean };
```

---

## 三、交互式 AI 模式（类似 GitHub Copilot）

> **落点**: 前端组件在 `app/src/components/`，调用 `core/ai/` 的 `EidonAgent`。

### 3.1 对话面板

```typescript
// app/src/components/AIChatPanel.tsx — React 组件
// 通过 core/ai/index.ts 使用 Agent

import { EidonAgent } from "@/core/ai/agent";
import { useAIStore } from "@/stores/aiStore";

function AIChatPanel() {
  const [streamingText, setStreamingText] = useState("");
  const agent = useRef<EidonAgent>();

  useEffect(() => {
    const a = new EidonAgent({
      initialState: {
        systemPrompt: buildSystemPrompt(), // 含 L1/L2/L3 上下文
        model: currentProviderConfig(),
        tools: eidonTools,
      },
      transformContext: injectWorkspaceContext, // 注入活跃节点/最近变更
      convertToLlm: filterUIMessages,           // 过滤 ui-event 等
    });

    // 借鉴 pi：事件订阅驱动 UI
    a.subscribe((event) => {
      if (event.type === "message_update") {
        setStreamingText(prev => prev + event.delta);
      }
    });

    agent.current = a;
    return () => { a.abort(); };
  }, []);

  const handleSend = async (text: string) => {
    setStreamingText("");
    await agent.current?.prompt(text);
  };

  // 渲染...
}
```

### 3.2 上下文注入（借鉴 pi 的 transformContext）

每次 LLM 调用前注入 Eidon workspace 上下文——这是最关键的集成点。

```typescript
// app/core/ai/context.ts — 属 core 层，禁 UI 框架

export async function injectWorkspaceContext(
  messages: ChatMessage[],
  signal: AbortSignal,
): Promise<ChatMessage[]> {
  // 由于 core/ 禁 @tauri-apps/api，实际数据由调用方传入或
  // 通过 core/bridge/ 获取。这里展示注入逻辑。

  const ctx: string[] = [];

  // 1. 当前 workspace 概览
  ctx.push(`## Current Workspace`);
  ctx.push(`- L1 nodes: ${workspaceInfo.l1Count}`);
  ctx.push(`- L2 nodes: ${workspaceInfo.l2Count}`);
  ctx.push(`- L3 nodes: ${workspaceInfo.l3Count}`);
  ctx.push(`- Total files: ${workspaceInfo.totalFiles}`);

  // 2. 当前活跃节点（编辑器聚焦的）
  if (activeNode) {
    ctx.push(`\n## Active Node: [${activeNode.level}] ${activeNode.name}`);
    ctx.push(`Tags: ${activeNode.tags?.join(", ") || "none"}`);
    ctx.push(`Content:\n${activeNode.content}`);
  }

  // 3. 最近修改（前 10 个节点）
  if (recentNodes.length > 0) {
    ctx.push(`\n## Recently Modified`);
    for (const n of recentNodes) {
      ctx.push(`- [${n.level}] ${n.name}`);
    }
  }

  // 4. 用户选中的文本/节点
  if (userSelection) {
    ctx.push(`\n## User Selection\n${userSelection}`);
  }

  // 注入为 system 消息（放在历史之前）
  return [
    { role: "system", content: ctx.join("\n") },
    ...messages,
  ];
}
```

### 3.3 命令面板 + 右键菜单

```typescript
// app/src/composables/useAICommands.ts
// 注册 AI 命令到 Eidon 的命令系统

export function useAICommands(agent: EidonAgent) {
  return [
    {
      id: "ai:summarize-selection",
      label: "AI: 总结选中内容",
      condition: (ctx) => !!ctx.selectedText,
      handler: (ctx) => agent.prompt(`总结以下内容：\n\n${ctx.selectedText}`),
    },
    {
      id: "ai:explain-node",
      label: "AI: 解释当前节点",
      condition: (ctx) => !!ctx.activeNode,
      handler: (ctx) => agent.prompt(
        `解释节点 [${ctx.activeNode.level}] ${ctx.activeNode.name}：\n${ctx.activeNode.content}`
      ),
    },
    {
      id: "ai:translate-zh-en",
      label: "AI: 翻译为英文",
      condition: (ctx) => !!ctx.selectedText,
      handler: (ctx) => agent.prompt(
        `Translate to English:\n\n${ctx.selectedText}`
      ),
    },
    {
      id: "ai:cjk-proofread",
      label: "AI: CJK 校对",
      condition: (ctx) => !!ctx.activeNode,
      handler: (ctx) => agent.prompt(
        `校对以下文本的中日韩字符和标点：\n\n${ctx.activeNode.content}`
      ),
    },
  ];
}
```

### 3.4 @mention 文件/节点引用

```typescript
// 用户在对话中输入 @node:xxx → 自动替换为节点内容
function resolveMention(mention: string): string {
  if (mention.startsWith("@node:")) {
    const node = workspaceStore.getNodeById(mention.slice(6));
    return node ? `--- ${node.name} [${node.level}] ---\n${node.content}\n---` : mention;
  }
  if (mention === "@workspace") {
    return buildWorkspaceSummary();
  }
  return mention;
}
```

---

## 四、触发式 AI 模式（自动化）

> **落点**: `core/ai/scheduler.ts`（纯逻辑）+ `app/src/stores/aiStore.ts`（触发入口）。

### 4.1 按钮触发

```typescript
// app/src/components/AITriggerBar.tsx
// 工具栏中的 AI 触发按钮

const triggerActions = [
  {
    label: "整理知识库",
    icon: "FolderOrganize",
    action: (agent) => agent.prompt(
      "分析当前 workspace 的知识库结构：\n" +
      "1. 检查所有 L1/L2/L3 节点的链接完整性\n" +
      "2. 标记孤立节点（没有任何关联的节点）\n" +
      "3. 建议新的 L2→L3 或 L1→L2 关联\n" +
      "4. 检查节点层级是否正确"
    ),
  },
  {
    label: "总结当前 L2",
    icon: "Summarize",
    condition: (ctx) => ctx.activeNode?.level === "L2",
    action: async (agent, ctx) => {
      const children = await workspaceStore.getChildNodes(ctx.activeNode.id);
      agent.prompt(
        `为 L2 节点 "${ctx.activeNode.name}" 生成结构化总结：\n` +
        `内容：${ctx.activeNode.content}\n` +
        `子节点 (${children.length})：${children.map(c => c.name).join(", ")}\n\n` +
        `输出：1) 主题摘要 2) 知识结构图 3) 关联建议`
      );
    },
  },
  {
    label: "生成月度报告",
    icon: "Report",
    action: async (agent) => {
      const stats = await getMonthlyStats();
      agent.prompt(
        `生成本月知识库工作报告：\n` +
        `新增节点: ${stats.newNodes} | 修改: ${stats.modified} | ` +
        `新增关联: ${stats.newLinks}\n\n` +
        `请生成：工作摘要、重要变更、知识库健康度评估、下月建议`
      );
    },
  },
];
```

### 4.2 定时触发（借鉴 heartbeat 模式）

```typescript
// app/core/ai/scheduler.ts — 属 core 层，纯逻辑
// 注意：定时器实际由前端/Tauri 管理，这里提供调度逻辑

export interface ScheduledTask {
  id: string;
  name: string;
  /** cron 表达式，如 "0 9 * * *"（每天 9:00） */
  cron: string;
  /** 任务提示词 */
  prompt: string;
  /** 是否启用 */
  enabled: boolean;
}

export class AIScheduler {
  private tasks: ScheduledTask[] = [];
  private onTrigger: (task: ScheduledTask) => Promise<void>;

  constructor(onTrigger: (task: ScheduledTask) => Promise<void>) {
    this.onTrigger = onTrigger;
  }

  registerTask(task: ScheduledTask): void {
    this.tasks.push(task);
  }

  /** 检查并触发到期的任务（由前端定时器/Tauri 定时器调用） */
  async tick(): Promise<void> {
    const now = new Date();
    for (const task of this.tasks) {
      if (!task.enabled) continue;
      if (this._cronMatches(task.cron, now)) {
        await this.onTrigger(task);
      }
    }
  }

  private _cronMatches(cron: string, date: Date): boolean {
    // 简化版 cron 匹配；生产环境使用 cron-parser
    return false;
  }
}

// 预置任务模板
export const presetTasks: ScheduledTask[] = [
  {
    id: "daily-summary",
    name: "每日工作总结",
    cron: "0 18 * * *",
    enabled: false,
    prompt: "总结今日 workspace 的变更：新增/修改节点、重要内容变更。",
  },
  {
    id: "weekly-review",
    name: "每周知识库周报",
    cron: "0 17 * * 5",
    enabled: false,
    prompt: "生成本周知识库周报：增长趋势、热门主题、知识盲区、需重构节点。",
  },
  {
    id: "monthly-report",
    name: "月度知识库报告",
    cron: "0 9 1 * *",
    enabled: false,
    prompt: "生成本月知识库月报：关键指标、内容质量、改进建议。",
  },
  {
    id: "orphan-check",
    name: "孤立节点检查",
    cron: "0 10 * * 1",
    enabled: false,
    prompt: "扫描知识库中无关联的节点，建议删除或建立关联。",
  },
];
```

### 4.3 事件驱动触发（借鉴 pi 的 pi.on 事件系统）

```typescript
// app/core/ai/event-bus.ts — 属 core 层

export class EventBus<E extends Record<string, unknown>> {
  private listeners = new Map<string, Set<Function>>();

  on<K extends string>(event: K, handler: (payload: E[K]) => void): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler);
    return () => this.listeners.get(event)?.delete(handler);
  }

  async emit<K extends string>(event: K, payload: E[K]): Promise<void> {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    // 串行 await（借鉴 pi 的顺序保证）
    for (const handler of handlers) {
      await handler(payload);
    }
  }
}

// —— 应用事件类型 ——
export type EidonAppEvent = {
  "node:created": { nodeId: string; level: "L1" | "L2" | "L3"; name: string };
  "node:modified": { nodeId: string; level: string };
  "node:deleted": { nodeId: string; level: string };
  "workspace:opened": { path: string };
  "git:committed": { hash: string; message: string };
};

// —— 事件 → Agent 动作映射 ——
export function registerAIEventHandlers(agent: EidonAgent, eventBus: EventBus<EidonAppEvent>) {
  // 新建 L2 → 建议标签
  eventBus.on("node:created", async (event) => {
    if (event.level !== "L2") return;
    agent.followUp({
      role: "user",
      content: `新创建了 L2 节点 "${event.name}"。建议合适的标签和可能的关联。`,
    });
  });

  // Git commit → 自动生成 changelog 条目
  eventBus.on("git:committed", async (event) => {
    agent.followUp({
      role: "user",
      content: `基于 commit ${event.hash.slice(0,7)}: "${event.message}" 生成 changelog 条目。`,
    });
  });
}
```

---

## 五、Eidon 专属工具（Tools）

> **落点**: `core/ai/tools/`。每个工具一个文件 + `index.ts` 汇总。
> 借鉴 pi 的 `AgentTool` 接口，但用 zod 替代 TypeBox。

```typescript
// app/core/ai/tools/read-node.ts
export const readNodeTool: AgentTool = {
  name: "read_node",
  label: "Read Node",
  description: "读取知识库节点的完整内容，可选包含子节点",
  parameters: {
    nodeId: { type: "string", description: "节点 ID (ULID)" },
    includeChildren: { type: "boolean", description: "是否包含子节点", optional: true },
  },
  async execute(toolCallId, params, signal) {
    // 由于 core/ 禁 @tauri-apps/api，节点读取经 core/bridge/ 或
    // 由调用方注入的 context function 完成
    const content = await readNodeContent(params.nodeId, params.includeChildren);
    return {
      content: [{ type: "text", text: content }],
      details: { nodeId: params.nodeId },
    };
  },
};

// app/core/ai/tools/search-kb.ts
export const searchKBTool: AgentTool = {
  name: "search_knowledge_base",
  label: "Search Knowledge Base",
  description: "全文搜索知识库，支持按层级过滤",
  parameters: {
    query: { type: "string", description: "搜索关键词" },
    level: { type: "string", description: "L1 | L2 | L3 | all", optional: true },
    maxResults: { type: "number", description: "最大结果数", optional: true },
  },
  async execute(toolCallId, params, signal) {
    const results = await searchKnowledgeBase(params);
    return {
      content: [{ type: "text", text: formatSearchResults(results) }],
      details: { query: params.query, resultCount: results.length },
    };
  },
};

// app/core/ai/tools/get-workspace.ts
export const getWorkspaceTool: AgentTool = {
  name: "get_workspace_info",
  label: "Get Workspace Info",
  description: "获取当前 workspace 的统计概览",
  parameters: {},
  async execute() {
    const info = await getWorkspaceStats();
    return {
      content: [{ type: "text", text: formatWorkspaceInfo(info) }],
      details: info,
    };
  },
};

// app/core/ai/tools/export-report.ts
export const exportReportTool: AgentTool = {
  name: "export_report",
  label: "Export Report",
  description: "将 AI 生成的内容导出为 Markdown 报告文件到 L3 节点",
  parameters: {
    content: { type: "string", description: "报告内容 (Markdown)" },
    filename: { type: "string", description: "文件名（不含扩展名）" },
    parentL3NodeId: { type: "string", description: "目标 L3 节点 ID", optional: true },
  },
  async execute(toolCallId, params, signal) {
    const filePath = await exportReport(params);
    return {
      content: [{ type: "text", text: `报告已导出到：${filePath}` }],
      details: { filePath },
    };
  },
};

// app/core/ai/tools/index.ts
export const eidonTools: AgentTool[] = [
  readNodeTool,
  searchKBTool,
  getWorkspaceTool,
  exportReportTool,
  // linkedNodesTool, ...
];
```

---

## 六、上下文压缩（借鉴 pi 的 compaction）

```typescript
// app/core/ai/compaction.ts — 属 core 层

interface CompactionConfig {
  enabled: boolean;
  /** 为 LLM 响应预留的 token 数 */
  reserveTokens: number;
  /** 保留不纳入摘要的最近 token 数 */
  keepRecentTokens: number;
}

const DEFAULT_COMPACTION: CompactionConfig = {
  enabled: true,
  reserveTokens: 4000,    // Eidon 默认比 pi 小（桌面应用上下文更短）
  keepRecentTokens: 12000,
};

export function shouldCompact(
  contextTokens: number,
  contextWindow: number,
  config: CompactionConfig = DEFAULT_COMPACTION,
): boolean {
  return config.enabled && contextTokens > contextWindow - config.reserveTokens;
}

/**
 * 生成结构化的上下文摘要（借鉴 pi 的摘要格式，适配 Eidon 领域）
 */
export async function generateCompactionSummary(
  messagesToSummarize: ChatMessage[],
  previousSummary?: string,
): Promise<string> {
  const prompt = [
    "Summarize the following conversation for an EIDON knowledge base agent.",
    "Focus on:",
    "- What the user is working on (nodes, workspace changes)",
    "- Key decisions made",
    "- Open questions or blocked items",
    "- Relevant nodes/files mentioned",
    "",
    previousSummary ? `Previous summary:\n${previousSummary}\n` : "",
    "## Conversation to summarize",
    serializeMessages(messagesToSummarize),
    "",
    "Output format:",
    "## Goal",
    "## Progress (Done / In Progress / Blocked)",
    "## Key Decisions",
    "## Nodes/Files Mentioned",
    "## Next Steps",
  ].join("\n");

  // 调用轻量模型生成摘要
  return await generateSummary(prompt);
}

/** 将消息序列化为文本（借鉴 pi 的 serializeConversation） */
function serializeMessages(messages: ChatMessage[]): string {
  return messages.map(m =>
    `[${m.role}]: ${m.content.slice(0, 2000)}` // 截断长内容
  ).join("\n");
}
```

---

## 七、bridge 层新增（如需 Rust 能力）

如果 Eidon 未来需要 Rust 侧的 AI 能力（密钥存储、HTTP 代理、本地模型推理）：

```typescript
// app/core/bridge/ai.ts — 唯一允许 import @tauri-apps/api 的文件
import { invoke } from "@tauri-apps/api/core";

/** 获取 OS keychain 中存储的 API key */
export async function getApiKey(provider: string): Promise<string | null> {
  return invoke("ai_get_api_key", { provider });
}

/** 存储 API key 到 OS keychain */
export async function setApiKey(provider: string, key: string): Promise<void> {
  return invoke("ai_set_api_key", { provider, key });
}
```

```rust
// app/src-tauri/src/ai/mod.rs — Rust 侧（如需）
// 在 lib.rs 加 #[path = "ai/mod.rs"] pub mod ai;
// 在 runner.rs 的 invoke_handler 注册命令

#[tauri::command]
async fn ai_get_api_key(provider: String) -> Result<Option<String>, String> {
    // 复用现有 keyring crate（已被 git/crypto.rs 使用）
    let service = format!("eidon-ai-{}", provider);
    keyring::Entry::new(&service, "default")
        .map(|e| e.get_password().ok())
        .map_err(|e| e.to_string())
}
```

**原则（AGENTS.md §4.3）**：优先在 core 层处理，仅必要时加 Rust 原子命令。

---

## 八、实现路线图（对齐 Eidon 数据层建设进度）

### 阶段 1：核心 Agent 运行时（对接现有 core/ai/ 占位）

- [ ] `core/ai/provider.ts` — 实现 Anthropic + OpenAI 兼容 provider 请求构造与流解析
- [ ] `core/ai/agent.ts` — 实现 `EidonAgent` 类（借鉴 pi 的 Agent）
- [ ] `core/ai/types.ts` — 扩展 AgentMessage、AgentTool、AgentEvent 类型
- [ ] `core/ai/index.ts` — 替换 `runChatLoop` 为真实实现，翻转 `isAiAvailable()`
- [ ] `core/ai/__tests__/agent.test.ts` — 纯 Node 单测
- [ ] `app/src/components/AIChatPanel.tsx` — 对话面板 UI
- [ ] `app/src/stores/aiStore.ts` — Zustand store（管理 Agent 实例、消息历史）

### 阶段 2：Eidon 专属工具 + 上下文注入

- [ ] `core/ai/tools/` — read_node、search_kb、get_workspace、linked_nodes、export_report
- [ ] `core/ai/context.ts` — `injectWorkspaceContext`（L1/L2/L3 上下文注入）
- [ ] `core/ai/compaction.ts` — 上下文压缩
- [ ] `app/src/composables/useAICommands.ts` — AI 命令面板/右键菜单集成

### 阶段 3：触发式自动化

- [ ] `core/ai/scheduler.ts` — 定时任务调度器
- [ ] `core/ai/event-bus.ts` — 事件总线
- [ ] `app/src/components/AITriggerBar.tsx` — 触发按钮工具栏
- [ ] 事件驱动：node:created → 建议标签，git:committed → changelog

### 阶段 4：高级功能（可选）

- [ ] Skills 系统（借鉴 agentskills.io）
- [ ] 会话分支（借鉴 pi 的 JSONL session + /tree）
- [ ] AI 设置面板（模型选择、token 预算、触发条件）
- [ ] 多 provider 支持（DeepSeek、Ollama 本地模型等）

---

## 九、关键设计决策

| 决策 | 建议 | 理由 |
|------|------|------|
| 直接依赖 pi 包？ | **否** | Eidon 是 Tauri 桌面应用，有自己的三层架构和约束；pi 面向 Node.js CLI |
| Agent 运行时位置？ | `core/ai/agent.ts` | 属 core 层，框架无关、可单测、UI 不可直调 Tauri |
| Provider 实现？ | `core/ai/provider.ts` | 纯 TS HTTP 调用，不依赖 Tauri（除非需 Rust HTTP 透传）|
| 密钥存储？ | OS keychain via `core/bridge/` | 复用现有 keyring crate（已被 git/crypto.rs 使用）|
| 工具执行模式？ | 默认 parallel，关键工具 sequential | 读操作并发提速，写操作序列化保证一致性 |
| 权限控制？ | `beforeToolCall` hook + UI 确认弹窗 | 借鉴 pi 的 tool_call 事件 + block，但在 React UI 层做弹窗 |
| 定时器？ | Tauri 侧或前端 setInterval → scheduler.tick() | 前端简易方案先用 setInterval，后续可迁移到 Tauri timer |
| 上下文注入？ | transformContext 双层桥 | 分离关注点：裁剪/注入 vs 格式转换 |

---

## 十、参考资源

- [pi GitHub](https://github.com/earendil-works/pi) — 主仓库（60k+ star）
- [pi-chat GitHub](https://github.com/earendil-works/pi-chat) — 自动化 Discord/Telegram 集成
- [pi-agent-extensions](https://github.com/zach-source/pi-agent-extensions) — 社区扩展（heartbeat, worker 编排）
- [pi.dev/docs](https://pi.dev/docs/latest) — 官方文档
- [DeepWiki: pi-mono](https://deepwiki.com/badlogic/pi-mono) — 技术深度文档
- [Agentskills.io](https://agentskills.io) — Skills 标准
- Eidon ADR-0018/0019 — AI 子系统删除决策
- Eidon ADR-0001/0006/0007/0009 — 三层【代码】架构与扩展规范
