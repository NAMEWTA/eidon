# 06 — 扩展 API 完整参考

> 源文件: `packages/coding-agent/docs/extensions.md`
> 相关: [07-事件系统](./07-event-system.md)

## 扩展基本结构

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  // 注册工具、命令、快捷键、事件处理器...
}

// 支持异步工厂——pi 在启动继续前等待完成
export default async function (pi: ExtensionAPI) {
  // 适合：获取远程配置、发现模型等一次性初始化
}
```

### 发现路径

| 路径 | 范围 |
|------|------|
| `~/.pi/agent/extensions/*.ts` | 全局 |
| `~/.pi/agent/extensions/*/index.ts` | 全局（子目录） |
| `.pi/extensions/*.ts` | 项目 |
| `.pi/extensions/*/index.ts` | 项目（子目录） |

通过 jiti 加载——TypeScript 无需编译即可运行。

## ExtensionAPI 方法全集

### `pi.registerTool(definition)` — 注册 LLM 可调用工具

```typescript
pi.registerTool({
  name: "my_tool",
  label: "My Tool",
  description: "Does something useful",
  parameters: Type.Object({
    path: Type.String({ description: "File path" }),
    action: Type.String({ description: "Action to perform" }),
  }),
  executionMode: "parallel",          // 可选，覆盖全局设置
  promptSnippet: "my_tool(path, action) — does something useful",
  promptGuidelines: [
    "Use my_tool when the user asks for X.",
    "Always provide both path and action.",
  ],

  async execute(toolCallId, params, signal, onUpdate, ctx) {
    // signal: AbortSignal — 用于取消操作
    // onUpdate: (update) => void — 流式更新

    const result = await doSomething(params);

    return {
      content: [{ type: "text", text: result }],
      details: { /* 调试信息 */ },
      terminate: false,  // true → 跳过后续 LLM 调用
    };
  },
});
```

**覆盖内置工具**: 使用相同名称注册即可。渲染器如省略则回退到内置。

### `pi.registerCommand(name, options)` — 注册 / 命令

```typescript
pi.registerCommand("stats", {
  description: "Show project statistics",
  async handler(args, ctx) {
    // ctx: ExtensionCommandContext
    const stats = await computeStats(ctx.cwd);
    ctx.ui.notify(`Files: ${stats.files}, Lines: ${stats.lines}`, "info");
  },
  // 可选：Tab 补全
  getArgumentCompletions(prefix) {
    return ["--verbose", "--json"].filter(s => s.startsWith(prefix));
  },
});
```

同名命令自动加数字后缀：`/review:1`, `/review:2`。

### `pi.registerShortcut(shortcut, options)` — 注册快捷键

```typescript
pi.registerShortcut("ctrl+g", {
  description: "Generate tests",
  async handler(ctx) {
    // ...
  },
});
```

### `pi.registerFlag(name, options)` — CLI 参数

```typescript
pi.registerFlag("verbose", {
  description: "Enable verbose logging",
  type: "boolean",
  default: false,
});

// 使用
const verbose = pi.getFlag("verbose");
```

### `pi.registerProvider(name, config)` — 注册模型提供商

```typescript
pi.registerProvider("my-service", {
  baseUrl: "https://api.my-service.com/v1",
  apiKey: process.env.MY_API_KEY,
  api: "openai-completions",
  models: [
    { id: "my-model-v1", name: "My Model V1", contextWindow: 128000, ... }
  ],
  // 可选：自定义 streaming
  streamSimple: myCustomStreamFn,
  // 可选：OAuth 支持
  oauth: { ... },
});
```

- Factory 函数中的调用排队到 runner 初始化后应用
- 启动后的调用立即生效，无需 `/reload`
- `pi.unregisterProvider(name)` 移除并恢复被覆盖的内置模型

### `pi.sendMessage(message, options?)` — 注入自定义消息

```typescript
pi.sendMessage({
  customType: "my_event",
  content: "Something happened",
  display: "🔔 Event",   // TUI 中的显示文本
  details: { ... },
}, {
  deliverAs: "steer",    // "steer" | "followUp" | "nextTurn"
  triggerTurn: true,     // 立即触发 agent 处理
});
```

### `pi.appendEntry(customType, data?)` — 持久化扩展状态

不参与 LLM 上下文，仅存在于会话文件中。在 `session_start` 中通过迭代 `ctx.sessionManager.getEntries()` 重建。

### 对话控制

```typescript
pi.sendUserMessage("Generate a report", { deliverAs: "steer" });
pi.setSessionName("My Task");
pi.getSessionName();
pi.setLabel(entryId, "important");    // 在 /tree 中添加书签
pi.setLabel(entryId, undefined);      // 清除标签
```

### 工具管理

```typescript
pi.getActiveTools();           // 当前激活的工具列表
pi.getAllTools();              // 所有可用工具（含 sourceInfo）
pi.setActiveTools(["read", "edit", "my_tool"]);
```

### 模型控制

```typescript
pi.setModel(getModel("anthropic", "claude-sonnet-4-20250514"));
pi.getThinkingLevel();
pi.setThinkingLevel("high");
```

### 其他

```typescript
pi.exec("ls", ["-la"], { cwd: "/path", signal, timeout: 5000 });
// → { stdout, stderr, code, killed }

pi.getCommands();  // 所有可用 / 命令
pi.events.on("custom", handler);  // 扩展间通信
pi.events.emit("custom", data);
```

## ExtensionContext

### UI 方法

```typescript
// 对话框（支持超时倒计时）
ctx.ui.select("Pick one:", ["A", "B"], { timeout: 30000, signal });
ctx.ui.confirm("Title", "Are you sure?", { timeout, signal });
ctx.ui.input("Label:", "placeholder", { timeout, signal });
ctx.ui.editor("Edit:", "prefilled content");

// 状态与通知
ctx.ui.notify("Done!", "info");       // "info" | "warning" | "error"
ctx.ui.setStatus("id", "text");       // 持久状态（footer）
ctx.ui.setStatus("id", undefined);    // 清除

// Widget（编辑器上方/下方）
ctx.ui.setWidget("my-widget", ["Line 1", "Line 2"]);
ctx.ui.setWidget("my-widget", undefined);
ctx.ui.setWidget("below", lines, { placement: "belowEditor" });

// Footer 定制
ctx.ui.setFooter((tui, theme) => {
  return new TruncatedText("Custom footer", (s) => theme.fg("muted", s));
});
ctx.ui.setFooter(undefined);  // 恢复默认

// 编辑器控制
ctx.ui.setEditorText("new text");
ctx.ui.getEditorText();
ctx.ui.pasteToEditor("pasted text");

// 工作指示器
ctx.ui.setWorkingMessage("Thinking...");
ctx.ui.setWorkingIndicator({ frames: ["⠋","⠙","⠹","⠸"], intervalMs: 80 });
ctx.ui.setWorkingVisible(true);

// 工具输出折叠
ctx.ui.setToolsExpanded(true);
ctx.ui.getToolsExpanded();

// 标题
ctx.ui.setTitle("pi - my-project");

// 高级 UI
ctx.ui.custom<T>(factory, { overlay: true });     // 自定义覆盖层
ctx.ui.setEditorComponent(factory);                // 替换编辑器
ctx.ui.getEditorComponent();                       // 获取当前编辑器
ctx.ui.addAutocompleteProvider(provider);          // 添加自动补全
ctx.ui.theme;                                      // 当前主题
ctx.ui.getAllThemes();                             // 所有主题
ctx.ui.setTheme("dark");
```

### 运行时环境

```typescript
ctx.mode;         // "tui" | "rpc" | "json" | "print"
ctx.hasUI;        // true in TUI and RPC
ctx.cwd;          // 工作目录
ctx.signal;       // AbortSignal（活跃轮次中可用）
ctx.model;        // 当前模型
ctx.modelRegistry;
```

### 会话状态（只读）

```typescript
ctx.sessionManager.getEntries();       // 所有条目
ctx.sessionManager.getBranch();        // 当前分支
ctx.sessionManager.getLeafId();        // 叶子节点 ID
ctx.sessionManager.getSessionFile();   // 会话文件路径
ctx.sessionManager.getLabel(entryId);  // 标签
```

### 流程控制

```typescript
ctx.isIdle();                 // Agent 是否空闲
ctx.abort();                  // 中止当前操作
ctx.hasPendingMessages();     // 是否有排队消息
ctx.shutdown();               // 优雅关闭
ctx.compact({ instructions });// 触发压缩
ctx.getContextUsage();        // 当前上下文 token 使用量
ctx.getSystemPrompt();        // 当前系统提示
ctx.isProjectTrusted();       // 项目是否受信
```

### ExtensionCommandContext（仅 / 命令）

```typescript
ctx.getSystemPromptOptions();            // 系统提示的构建输入
ctx.waitForIdle();                       // 等待 Agent 完成
ctx.newSession({                         // 创建新会话
  parentSession: current,
  setup: (pi) => { /* 新 session 的初始化 */ },
  withSession: async (ctx) => { /* 在新 session 中执行 */ },
});
ctx.fork(entryId, {                      // Fork 会话
  position: "after",
  withSession: async (ctx) => { ... },
});
ctx.navigateTree(targetId, {             // 树导航
  summarize: true,
  customInstructions: "...",
  label: "checkpoint",
});
ctx.switchSession(sessionPath, {
  withSession: async (ctx) => { ... },
});
ctx.reload();  // 同 /reload
```

### Session 替换注意事项

`newSession()`、`fork()`、`switchSession()` 的 `withSession` 回调：
- 在旧 session 的 `session_shutdown` 之后执行
- 回调在新的 extension 实例的**外部**运行
- 旧 `pi`/二 `ctx`（session-bound 对象）已失效——使用它们会抛出异常
- 只使用传入 `withSession` 的 `ctx` 参数
- 只捕获纯数据（字符串、ID、可序列化配置）

## 状态管理最佳实践

将状态存储在工具结果的 `details` 中以支持分支：

```typescript
// 在 tool execute 中
return {
  content: [...],
  details: { myState: { version: 1, data: [...] } },
};
```

在 `session_start` 事件中重建：

```typescript
pi.on("session_start", async (event, ctx) => {
  for (const entry of ctx.sessionManager.getBranch()) {
    if (entry.type === "tool_result" && entry.toolName === "my_tool") {
      const state = entry.details?.myState;
      // 重建状态...
    }
  }
});
```

## 文件变更队列

当并发工具调用可能编辑同一文件时：

```typescript
import { withFileMutationQueue } from "@earendil-works/pi-coding-agent";

await withFileMutationQueue(absolutePath, async () => {
  // 序列化对同一文件的编辑
  await fs.promises.writeFile(absolutePath, newContent);
});
```

## 输出截断

```typescript
import { truncateHead, truncateTail, DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES } from "@earendil-works/pi-coding-agent";

const truncated = truncateTail(largeOutput, DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES);
// 默认: 50KB, 2000 行
```

## 类型安全的事件处理

```typescript
import { isToolCallEventType, isBashToolResult } from "@earendil-works/pi-coding-agent";

// 窄化 tool_call 事件类型
if (isToolCallEventType("bash", event)) {
  event.input.command; // 类型为 string
}

// 泛型版本（自定义工具）
if (isToolCallEventType<"my_tool", MyToolInput>("my_tool", event)) {
  event.input.action; // 类型安全
}

// 窄化 tool_result 事件
if (isBashToolResult(event)) {
  event.details; // 类型为 BashToolDetails
}
```

## 可导入的包

| 包 | 内容 |
|----|------|
| `@earendil-works/pi-coding-agent` | `ExtensionAPI`, `ExtensionContext`, 事件类型, `isToolCallEventType`, `isBashToolResult`, `withFileMutationQueue`, 截断工具, `keyHint`, `highlightCode`, `CustomEditor` |
| `typebox` (`@sinclair/typebox`) | `Type.Object`, `Type.String` 等 schema 定义 |
| `@earendil-works/pi-ai` | `StringEnum`（Google 兼容枚举） |
| `@earendil-works/pi-tui` | `Text`, `Component`, `matchesKey` 等 TUI 组件 |

Node.js 内置模块（`node:fs`, `node:path`）直接可用。npm 依赖需在扩展旁放置 `package.json`。

## Eidon 集成要点

1. **核心复用**：`pi.registerTool()` 的模式直接映射到 Eidon 的 AI 工具定义（读取节点、搜索、导出等）
2. **事件 Hook**：`pi.on()` 的模式映射到 Eidon 的 AI 生命周期钩子
3. **命令系统**：`pi.registerCommand()` 的模式映射到 Eidon 的 / 命令或按钮触发
4. **状态持久化**：`details` + `session_start` 重建模式映射到 Eidon 的 store（Zustand/Jotai）
5. **不直接使用 pi 的 ExtensionAPI**——Eidon 是独立应用，但设计模式完全可借鉴
