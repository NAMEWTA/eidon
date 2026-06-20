# @earendil-works/pi-coding-agent — Agent 会话编排层 SDK 完整 API 参考

> 数据源：[packages/coding-agent/](https://github.com/earendil-works/pi/tree/main/packages/coding-agent)
> 版本依据：README + docs/sdk.md + src/index.ts + src/core/sdk.ts

## 入口工厂函数

| 函数 | 签名 | 功能 |
|------|------|------|
| `createAgentSession` | `(options?: CreateAgentSessionOptions) => Promise<CreateAgentSessionResult>` | **主工厂**：创建单个 AgentSession |
| `createAgentSessionRuntime` | `(createRuntime: CreateAgentSessionRuntimeFactory, options: { cwd, agentDir, sessionManager }) => Promise<AgentSessionRuntime>` | 多会话运行时（支持切换/克隆/fork） |
| `createAgentSessionFromServices` | `(options: CreateAgentSessionFromServicesOptions) => Promise<AgentSession>` | 从预构建服务创建 session（高级） |
| `createAgentSessionServices` | `(options: CreateAgentSessionServicesOptions) => Promise<AgentSessionServices>` | 只创建服务层，不创建 session |

### `CreateAgentSessionOptions`

```typescript
interface CreateAgentSessionOptions {
  cwd?: string;                     // 工作目录，默认 process.cwd()
  agentDir?: string;                // agent 配置目录，默认 "~/.pi/agent"
  authStorage?: AuthStorage;        // 认证存储
  modelRegistry?: ModelRegistry;    // 模型注册表
  model?: Model;                    // 初始模型
  thinkingLevel?: ThinkingLevel;    // 推理级别
  scopedModels?: Array<{ model: Model; thinkingLevel?: ThinkingLevel }>;
  noTools?: "all" | "builtin";      // 禁用工具
  tools?: string[];                 // 白名单工具名
  excludeTools?: string[];          // 黑名单工具名
  customTools?: ToolDefinition[];   // 自定义工具
  resourceLoader?: ResourceLoader;  // 资源加载器
  sessionManager?: SessionManager;  // 会话管理器
  settingsManager?: SettingsManager;
  sessionStartEvent?: SessionStartEvent;
}

interface CreateAgentSessionResult {
  session: AgentSession;
  extensionsResult: LoadExtensionsResult;
  modelFallbackMessage?: string;
}
```

---

## `AgentSession` — 核心会话对象

### 属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `sessionFile` | `string \| undefined` | 会话文件路径 |
| `sessionId` | `string` | 会话唯一 ID |
| `model` | `Model \| undefined` | 当前使用的模型 |
| `thinkingLevel` | `ThinkingLevel` | 当前推理级别 |
| `isStreaming` | `boolean` | 是否正在流式生成 |
| `agent` | `Agent` | 底层 Agent 实例（见下方） |

### 方法

| 方法 | 签名 | 功能 |
|------|------|------|
| `prompt` | `(text: string, options?: PromptOptions) => Promise<void>` | **主入口**：发送用户消息给 agent |
| `steer` | `(text: string) => Promise<void>` | 中途转向，改变 agent 当前行为 |
| `followUp` | `(text: string) => Promise<void>` | 追问，在 agent 完成后追加问题 |
| `subscribe` | `(listener: (event: AgentSessionEvent) => void) => () => void` | 订阅会话事件流，返回取消函数 |
| `setModel` | `(model: Model) => Promise<void>` | 切换模型 |
| `setThinkingLevel` | `(level: ThinkingLevel) => void` | 设置推理级别 |
| `cycleModel` | `() => Promise<ModelCycleResult \| undefined>` | 轮换 scopedModels 中下一个模型 |
| `cycleThinkingLevel` | `() => ThinkingLevel \| undefined` | 轮换推理级别 |
| `navigateTree` | `(targetId: string, options?: { summarize?, customInstructions?, replaceInstructions?, label? }) => Promise<{ editorText?, cancelled }>` | 导航对话树分支 |
| `compact` | `(customInstructions?: string) => Promise<CompactionResult>` | 触发对话压缩 |
| `abortCompaction` | `() => void` | 中止压缩 |
| `abort` | `() => Promise<void>` | 中止当前生成 |
| `dispose` | `() => void` | 销毁会话，释放所有资源 |

### `PromptOptions`

```typescript
interface PromptOptions {
  expandPromptTemplates?: boolean;
  images?: ImageContent[];
  streamingBehavior?: "steer" | "followUp";
  source?: InputSource;
  preflightResult?: (success: boolean) => void;
}
```

---

## `AgentSessionRuntime` — 多会话运行时

| 方法 | 功能 |
|------|------|
| `runtime.newSession()` | 创建新会话 |
| `runtime.switchSession(path)` | 切换到指定会话文件 |
| `runtime.fork(entryId, options?)` | 从对话树节点 fork 出新分支 |
| `runtime.importFromJsonl()` | 从 JSONL 文件导入会话 |
| `runtime.session` | 当前活跃的 `AgentSession`（切换后变化，需重新订阅事件） |

**⚠️ 重要**：`runtime.session` 在 `newSession`/`switchSession`/`fork` 后会指向新实例，事件订阅绑定在旧 `AgentSession` 上，切换后需重新 `subscribe`。

---

## `Agent` — 底层 Agent（`session.agent`）

### State（`agent.state`）

| 属性 | 类型 | 说明 |
|------|------|------|
| `messages` | `AgentMessage[]` | 当前消息历史 |
| `model` | `Model` | 当前模型 |
| `thinkingLevel` | `ThinkingLevel` | 当前推理级别 |
| `systemPrompt` | `string` | 系统提示词 |
| `tools` | `AgentTool[]` | 可用工具列表 |
| `streamingMessage` | `AgentMessage \| undefined` | 正在流式生成的消息 |
| `errorMessage` | `string \| undefined` | 错误信息 |

### 方法

| 方法 | 签名 | 功能 |
|------|------|------|
| `waitForIdle` | `() => Promise<void>` | 等待 agent 空闲（完成所有生成和工具执行） |

---

## 认证 & 模型管理

### `AuthStorage`

API key 解析优先级：1. 运行时覆盖（`setRuntimeApiKey`）→ 2. `auth.json` 存储 → 3. 环境变量 → 4. 回调

| 静态工厂 | 实例方法 |
|---------|---------|
| `AuthStorage.create(path?: string)` | `setRuntimeApiKey(provider: string, key: string): void` |

### `ModelRegistry`

| 静态工厂 | 实例方法 |
|---------|---------|
| `ModelRegistry.create(authStorage: AuthStorage, modelsPath?: string)` | `find(provider: string, modelId: string): Model \| undefined` |
| `ModelRegistry.inMemory(authStorage: AuthStorage)` | `getAvailable(): Promise<Model[]>` |

---

## 会话管理器 `SessionManager`

### 静态工厂

| 工厂 | 签名 | 功能 |
|------|------|------|
| `inMemory` | `(cwd?: string) => SessionManager` | 内存存储，不持久化 |
| `create` | `(cwd: string) => SessionManager` | 文件持久化存储 |
| `continueRecent` | `(cwd: string) => Promise<SessionManager>` | 继续最近会话 |
| `open` | `(path: string) => SessionManager` | 打开指定路径会话 |
| `list` | `(cwd: string) => Promise<SessionSummary[]>` | 列出当前目录会话 |
| `listAll` | `(cwd: string) => Promise<SessionSummary[]>` | 列出所有会话 |

### 实例方法

| 方法 | 功能 |
|------|------|
| `getEntries()` | 获取所有条目 |
| `getTree()` | 获取对话树结构 |
| `getPath()` | 获取当前路径条目链 |
| `getLeafEntry()` | 获取叶子条目 |
| `getEntry(id)` | 获取指定条目 |
| `getChildren(id)` | 获取子条目 |
| `getLabel(id)` | 获取条目标签 |
| `appendLabelChange(id, label)` | 添加标签变更 |
| `branch(entryId)` | 从条目分支 |
| `branchWithSummary(id, summary)` | 从条目分支并附摘要 |
| `createBranchedSession(leafId)` | 创建分支会话 |
| `buildSessionContext()` | 构建会话上下文 |

---

## 设置管理器 `SettingsManager`

| 静态工厂 | 功能 |
|---------|------|
| `SettingsManager.create(cwd?, agentDir?)` | 文件持久化设置 |
| `SettingsManager.inMemory(settings?)` | 内存设置（测试用） |

| 实例方法 | 功能 |
|---------|------|
| `applyOverrides(overrides: Partial<Settings>)` | 运行时覆盖设置 |
| `flush()` | 持久化设置到磁盘 |
| `drainErrors()` | 获取并清空错误队列 |

---

## 资源加载器

### `DefaultResourceLoader`

实现 `ResourceLoader` 接口，自动发现扩展、技能、提示模板、主题、上下文文件。

构造函数选项：`cwd`, `agentDir`, `systemPromptOverride`, `skillsOverride`, `agentsFilesOverride`, `promptsOverride`, `additionalExtensionPaths`, `extensionFactories`, `settingsManager`, `eventBus`。

| 方法 | 返回类型 |
|------|---------|
| `getExtensions()` | `Extension[]` |
| `getSkills()` | `Skill[]` |
| `getPrompts()` | `PromptTemplate[]` |
| `getThemes()` | `Theme[]` |
| `getAgentsFiles()` | `{ agentsFiles: AgentsFile[] }` |
| `reload()` | `Promise<void>` |

### 自动扫描路径

| 来源 | 路径 |
|------|------|
| 项目扩展 | `.pi/extensions/` |
| 项目技能 | `.pi/skills/`, `.agents/skills/`（cwd + 祖先直到 git root） |
| 项目提示 | `.pi/prompts/` |
| 上下文文件 | `AGENTS.md`（从 cwd 向上搜索） |
| 全局扩展 | `<agentDir>/extensions/` |
| 全局技能 | `<agentDir>/skills/`, `~/.agents/skills/` |
| 全局提示 | `<agentDir>/prompts/` |
| 设置 | `<agentDir>/settings.json`, `.pi/settings.json` |
| 自定义模型 | `<agentDir>/models.json` |
| 凭据 | `<agentDir>/auth.json` |
| 会话 | `<agentDir>/sessions/` |

---

## 工具工厂

| 函数 | 功能 | 选项类型 |
|------|------|---------|
| `createCodingTools(options?)` | 创建全部编码工具集（read+bash+edit+write+grep+find+ls） | `ToolsOptions` |
| `createReadOnlyTools(options?)` | 只读工具集（read+grep+find+ls） | `ToolsOptions` |
| `createReadTool(options?)` | 文件读取 | `ReadToolOptions` |
| `createBashTool(options?)` | Shell 执行 | `BashToolOptions` |
| `createEditTool(options?)` | 文件编辑（返回 diff + unified patch） | `EditToolOptions` |
| `createWriteTool(options?)` | 文件写入 | `WriteToolOptions` |
| `createGrepTool(options?)` | 文本搜索 | `GrepToolOptions` |
| `createFindTool(options?)` | 文件查找 | `FindToolOptions` |
| `createLsTool(options?)` | 目录列表 | `LsToolOptions` |
| `defineTool(definition)` | 定义自定义工具 | `ToolDefinition` |
| `withFileMutationQueue` | 文件变更队列包装器 | — |

### 内置工具名常量
`"read"`, `"bash"`, `"edit"`, `"write"`, `"grep"`, `"find"`, `"ls"`

默认激活（`tools` 选项未指定时）：`["read", "bash", "edit", "write"]`

---

## 扩展系统

### `ToolDefinition`
```typescript
interface ToolDefinition {
  name: string;
  description: string;
  parameters: TSchema;        // TypeBox schema
  execute: (args: any, context: ExtensionContext) => Promise<any>;
  executionMode?: ToolExecutionMode;
}
```

### `ExtensionFactory`
```typescript
type ExtensionFactory = (api: ExtensionAPI) => void;
```

### `ExtensionAPI`
扩展工厂函数的参数类型，提供：
- 工具注册
- 斜杠命令注册
- 事件订阅（`agent_start`, `agent_end`, `turn_end`, `session_*`, `tool_*`）
- UI 扩展（widget, dialog, autocomplete, message renderer）
- 终端输入处理
- 项目信任处理

### 核心扩展类型
`Extension`, `ExtensionRuntime`, `ExtensionContext`, `ExtensionContextActions`,
`ExtensionCommandContext`, `ExtensionCommandContextActions`, `ExtensionEvent`,
`LoadExtensionsResult`, `SlashCommandInfo`, `SlashCommandSource`, `RegisteredTool`,
`RegisteredCommand`, `ExtensionHandler`, `ExtensionActions`, `ExtensionShortcut`,
`ExtensionFlag`, `ExtensionError`, `ExtensionUIContext`, `ExtensionUIDialogOptions`,
`ExtensionWidgetOptions`, `WidgetPlacement`, `MessageRenderer`, `MessageRenderOptions`

### EventBus
```typescript
createEventBus(): { eventBus: EventBus; controller: EventBusController }
```

---

## AgentSessionEvent 事件类型

| 事件 type | 携带数据 | 用途 |
|-----------|---------|------|
| `message_update` | `assistantMessageEvent`（含 text_delta/thinking_delta 等子事件） | 流式 UI 渲染 |
| `tool_execution_start` | `toolName: string` | 工具执行进度提示 |
| `tool_execution_update` | 工具输出流内容 | 实时工具输出展示 |
| `tool_execution_end` | `isError: boolean` | 工具执行结果 |
| `message_start` | — | 新消息开始 |
| `message_end` | — | 消息完成 |
| `agent_start` | — | Agent 开始处理 prompt |
| `agent_end` | `messages` | Agent 处理完成 |
| `turn_start` | — | 一轮 LLM 响应+工具调用开始 |
| `turn_end` | `message, toolResults` | 一轮完成 |
| `queue_update` | `steering, followUp` | 排队状态更新 |
| `compaction_start` | — | 对话压缩开始 |
| `compaction_end` | — | 对话压缩完成 |
| `auto_retry_start` | — | 自动重试开始 |
| `auto_retry_end` | — | 自动重试完成 |

---

## 对话压缩

| 导出 | 功能 |
|------|------|
| `compact(options)` | 执行对话压缩 |
| `generateSummary(options)` | 生成摘要 |
| `generateBranchSummary(options)` | 生成分支摘要 |
| `findCutPoint(messages, maxTokens)` | 查找截断点 |
| `calculateContextTokens(messages)` | 计算上下文 token 数 |
| `estimateTokens(text)` | 估算 token 数 |
| `serializeConversation(messages)` | 序列化对话 |
| `shouldCompact(messages, maxTokens)` | 判断是否需要压缩 |
| `DEFAULT_COMPACTION_SETTINGS` | 默认压缩设置常量 |

---

## 运行模式

| 模式 | 入口 | 用途 |
|------|------|------|
| Interactive（TUI） | `new InteractiveMode(runtime, options).run()` | 全功能终端 UI |
| Print（单次） | `runPrintMode(runtime, { mode, initialMessage, messages })` | 单次发送，打印结果退出 |
| RPC（进程集成） | `runRpcMode(runtime)` | stdin/stdout JSON-RPC 模式 |
| RPC Client（客户端） | `new RpcClient(options)` | 从外部进程连接 RPC 模式 |

---

## 最小使用示例

```typescript
import { createAgentSession, SessionManager, AuthStorage, ModelRegistry }
  from "@earendil-works/pi-coding-agent";
import { getModel } from "@earendil-works/pi-ai";

// 1. 创建服务
const authStorage = AuthStorage.create();
authStorage.setRuntimeApiKey("anthropic", process.env.ANTHROPIC_API_KEY!);
const model = getModel("anthropic", "claude-sonnet-4-6");

// 2. 创建 session
const { session } = await createAgentSession({
  model,
  thinkingLevel: "high",
  sessionManager: SessionManager.inMemory(),
  authStorage,
  modelRegistry: ModelRegistry.inMemory(authStorage),
  noTools: "all", // 不使用内置工具，纯对话
});

// 3. 订阅事件（渲染到 UI）
const unsubscribe = session.subscribe((event) => {
  switch (event.type) {
    case "message_update":
      // event.assistantMessageEvent.type === "text_delta" → 追加文本
      break;
    case "tool_execution_start":
      console.log("执行工具:", event.toolName);
      break;
    case "agent_end":
      console.log("完成，消息数:", event.messages.length);
      break;
  }
});

// 4. 发送 prompt
await session.prompt("请帮我分析这个项目的架构");

// 5. 清理
unsubscribe();
session.dispose();
```
