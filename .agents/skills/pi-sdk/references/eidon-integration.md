# Pi SDK → EIDON 集成映射与实施指南

## EIDON 当前 AI 状态

| 文件 | 现状 | 用途 |
|------|------|------|
| `shared/models/ai.ts` | 已有类型定义（`ApiFormat`, `ChatMessage`, `AiProviderConfig`, `StreamEvent`, `StreamHandler`, `ChatLoopRequest`, `ChatLoopResult`） | 可扩展为 Pi SDK 类型别名 |
| `backend/domain/ai.ts` | Stub（`isAiAvailable()` → false, `runChatLoop()` → throw） | 集成入口点 |
| `frontend/lib/clean-ai.ts` | 文本清理工具（非 LLM） | AI 产物后处理 |
| `.nezha/worktree/ai-copilot/` | 集成方案草图 | 参考设计 |

## 四层架构集成映射

### Layering（遵循 EIDON 单向依赖：frontend → bridge → backend → shared）

```
┌─ frontend ─────────────────────────────────────────────┐
│  stores/aiStore.ts        ← session.subscribe() 事件    │
│  components/AiChat/        ← AgentSessionEvent 渲染     │
│  components/AiInline/      ← 选中文本 AI 菜单           │
│  Settings → AI Config UI   ← ai:listModels, ai:setKey   │
├─ bridge ───────────────────────────────────────────────┤
│  ipc/ai.ts                 ← eidonInvoke("ai:...")      │
├─ backend ──────────────────────────────────────────────┤
│  ipc/handlers/ai.handlers.ts  ← IPC 通道注册            │
│  services/ai-service.ts        ← 编排层                 │
│  domain/ai/                    ← Pi SDK 核心集成        │
│    ├── agent.ts          createAgentSession 封装        │
│    ├── provider.ts       ModelRegistry + AuthStorage    │
│    ├── tools/             EIDON 专属工具定义            │
│    ├── compaction.ts     自定义压缩策略                 │
│    └── scheduler.ts      定时/事件触发自动化            │
├─ shared ───────────────────────────────────────────────┤
│  models/ai.ts            扩展 Pi SDK 类型别名           │
│  ipc/channels.ts          新增 ai:* 频道                │
│  contracts/ai.ts          配置验证 schema               │
└────────────────────────────────────────────────────────┘
```

## IPC 通道设计

需在 `shared/ipc/channels.ts` 的 `IpcContract` 中新增：

| 通道 | req | res | 功能 |
|------|-----|-----|------|
| `ai:isAvailable` | `NoReq` | `boolean` | 查询 AI 是否可用 |
| `ai:listModels` | `{ provider?: string }` | `ModelInfo[]` | 列出可用模型 |
| `ai:listProviders` | `NoReq` | `ProviderInfo[]` | 列出可用 provider |
| `ai:setProviderConfig` | `{ provider, apiKey }` | `void` | 配置 API key |
| `ai:prompt` | `{ text, images? }` | `void` | 发送 prompt（事件推送结果） |
| `ai:cancel` | `NoReq` | `void` | 取消当前生成 |
| `ai:setModel` | `{ provider, modelId }` | `void` | 切换模型 |
| `ai:setThinkingLevel` | `{ level }` | `void` | 设置推理级别 |
| `ai:getSessionState` | `NoReq` | `SessionState` | 获取会话状态 |
| `ai:streamEvent` | — | — | Backend→Renderer 事件推送（非 invoke） |

**事件推送**（`emitEvent` 而非 `invoke`）：
```
eidon:ai-stream-event  →  text_delta / thinking_delta / toolcall_* / done / error
eidon:ai-session-state →  model / thinkingLevel / isStreaming / messages count
```

## EIDON 专属 AI 工具

这些工具定义在 `backend/domain/ai/tools/`，通过 Pi 的 `defineTool()` 注册为 `customTools`。

| 工具名 | 复用现有 Domain | 功能描述 |
|--------|---------------|---------|
| `read_node` | `nodes.ts` → `readNode()` | 读取节点内容 |
| `create_node` | `nodes.ts` → `createNode()` | 创建新节点 |
| `update_node` | `nodes.ts` → `updateNodeFields()` | 更新节点字段 |
| `list_nodes` | `nodes.ts` → `scanNodes()` | 列出节点树 |
| `search_kb` | `knowledge/workspace-index.ts` | 全文搜索知识库 |
| `get_backlinks` | `knowledge/workspace-index.ts` | 获取反向链接 |
| `get_tags` | `knowledge/workspace-index.ts` | 标签统计 |
| `git_status` | `git/git-client.ts` | Git 工作区状态 |
| `git_diff` | `git/diff.ts` | Git 差异 |
| `git_log` | `git/history.ts` | Git 提交历史 |
| `read_file` | `editor/file-ops.ts` | 读取任意文件 |
| `write_file` | `editor/file-ops.ts` | 写入文件 |
| `spellcheck` | `knowledge/spellcheck.ts` | 拼写检查 |
| `todos_list` | `todos.ts` | 获取待办列表 |
| `export_report` | `editor/convert.ts` + pandoc | 导出格式化报告 |

### 工具定义模式

```typescript
// backend/domain/ai/tools/read-node.tool.ts
import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "@earendil-works/pi-ai";
import { readNode } from "../../nodes";

export const readNodeTool = defineTool({
  name: "read_node",
  description: "读取指定节点的完整内容（Markdown + frontmatter）",
  parameters: Type.Object({
    nodeId: Type.String({ description: "节点 ULID" }),
  }),
  execute: async (args, context) => {
    const node = await readNode(args.nodeId);
    return { node };
  },
  executionMode: "read",  // 只读工具，允许并行执行
});
```

## 四阶段集成路径

### Phase 1：Provider 连接层（可在 1-2 个迭代完成）

**目标**：能够列出模型、配置 API key。

**文件变更**：
- `shared/models/ai.ts` — 添加 `ModelInfo`, `ProviderInfo`, `AiConfig` 类型
- `backend/domain/ai/provider.ts` — `initProvider()`, `listModels()`, `listProviders()` 实现
- `backend/domain/ai/index.ts` — 重导出，翻转 `isAiAvailable()`
- `backend/ipc/handlers/ai.handlers.ts` — 新增 handler 文件
- `shared/ipc/channels.ts` — 新增 `ai:isAvailable`, `ai:listModels`, `ai:listProviders`, `ai:setProviderConfig`
- `bridge/ipc/ai.ts` — 新增 bridge wrapper
- `frontend/stores/aiStore.ts` — 新增 Zustand store
- `frontend/components/Settings/AiSettings.tsx` — Provider 配置 UI

### Phase 2：Agent 会话层（核心，2-3 个迭代）

**目标**：能发送 prompt 并收到流式回复。

**文件变更**：
- `backend/domain/ai/agent.ts` — `createSession()`, `prompt()`, `cancel()` 封装
- `backend/domain/ai/tools/*.ts` — EIDON 专属工具（先实现 3-5 个核心工具）
- `backend/domain/ai/compaction.ts` — 对话压缩（需保留节点引用）
- `backend/ipc/handlers/ai.handlers.ts` — `ai:prompt`, `ai:cancel`, `ai:setModel`, `ai:setThinkingLevel`
- `backend/ipc/emit.ts` — 新增 `eidon:ai-stream-event` 事件发射
- `shared/ipc/channels.ts` — 新增对应频道
- `shared/ipc/events.ts` — 新增 AI 事件类型
- `bridge/ipc/ai.ts` — 扩展 bridge
- `frontend/stores/aiStore.ts` — 订阅 stream 事件
- `frontend/components/AiChat/` — Chat 面板组件

### Phase 3：前端交互层（1-2 个迭代）

**目标**：完整的 AI 聊天 UI + Inline AI 菜单。

**文件变更**：
- `frontend/components/AiChat/ChatPanel.tsx` — 聊天面板
- `frontend/components/AiChat/MessageList.tsx` — 消息列表（text + thinking 折叠 + tool 展开）
- `frontend/components/AiChat/InputBox.tsx` — 输入框（支持 @节点 引用）
- `frontend/components/AiChat/ThinkingBlock.tsx` — 思考块折叠展示
- `frontend/components/AiChat/ToolCallBlock.tsx` — 工具调用展示
- `frontend/components/AiInline/` — 选中文本 AI 菜单（翻译/摘要/改写）
- `frontend/composables/useAiChat.ts` — 聊天状态管理 composable

### Phase 4：自动化 Agent（按需）

**目标**：事件驱动的后台 AI 自动化。

**文件变更**：
- `backend/domain/ai/scheduler.ts` — 定时 Agent 任务
- `backend/domain/ai/triggers.ts` — 事件驱动自动化
  - `node:created` → 建议标签
  - `node:updated` → 更新摘要
  - `git:committed` → 生成 changelog
  - `每日` → 待办回顾 + 日报草稿

## 关键约束

1. **分层纯净**：`backend/domain/ai/` 禁止导入 `electron`、`React`、`Zustand`。只能依赖 `shared/` 和 Pi SDK。
2. **IPC 通道注册**：新增通道需同步更新 `IpcContract`、`CHANNEL_PRESENCE`、`ALL_CHANNELS`，`register.ts` 启动时自动检查完备性。
3. **事件推送方向**：Renderer→Backend 走 `ipcRenderer.invoke`（请求-响应）；Backend→Renderer 走 `webContents.send` + `eidon:ai-*` 事件。
4. **会话持久化**：`SessionManager.inMemory()` 用于临时会话，`SessionManager.create(cwd)` 用于持久化。EIDON 应持久化到 workspace 的 `.eidon/ai-sessions/` 目录。
5. **对话压缩**：EIDON 节点内容可能很大，需自定义 `ResourceLoader` 注入 workspace 上下文，压缩时保留关键节点引用。
6. **Browser/Electron 差异**：Bedrock provider 和 OAuth 登录在 Electron 中可能需要特殊处理；API key 必须显式传递，不能用 OAuth 自动登录。
7. **Sandbox 兼容**：EIDON preload 已配置 `sandbox: true`。Pi SDK 运行在 main process（backend），不经过 preload。
