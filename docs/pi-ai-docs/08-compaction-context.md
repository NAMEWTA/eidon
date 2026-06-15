# 08 — 压缩与上下文管理

> 源文件: `packages/coding-agent/docs/compaction.md`
> 相关: [03-Agent 运行时](./03-pi-agent-core.md) | [07-事件系统](./07-event-system.md)

## 概述

长会话会耗尽上下文窗口。pi 提供自动和手动的上下文压缩机制，通过 LLM 生成的摘要保留关键信息。

## 触发条件

自动压缩触发：**contextTokens > contextWindow - reserveTokens**

- `reserveTokens` 默认 16384
- `keepRecentTokens` 默认 20000（保留不纳入摘要的最近 token 数）

```json
// ~/.pi/agent/settings.json 或 .pi/settings.json
{
  "compaction": {
    "enabled": true,
    "reserveTokens": 16384,
    "keepRecentTokens": 20000
  }
}
```

手动触发：`/compact [custom instructions]`

## 压缩流程

### 基本流程

```
1. 从最新消息向前遍历 → 累计 token 估计 → 达到 keepRecentTokens 阈值 → 找到切割点
2. 收集上一次保留边界到切割点之间的消息
3. 调用 LLM 生成结构化摘要（如有上一次摘要，作为迭代上下文传入）
4. 保存 CompactionEntry {
     summary: string,
     firstKeptEntryId: string,
     tokensBefore: number,
     details: { readFiles: string[], modifiedFiles: string[] }
   }
5. 重新加载会话：摘要 + 从 firstKeptEntryId 开始的消息
```

### 切割点规则

**允许的切割点**：用户消息、助手消息、BashExecution、自定义消息（custom_message, branch_summary）

**不允许的切割点**：工具结果（必须与对应的工具调用保持在一起）

### 重复压缩与 Split Turn

**迭代边界处理**：重复压缩时摘要范围从上次的 `firstKeptEntryId` 开始，而非从 CompactionEntry 本身。如果该 ID 在路径中丢失，回退到上次压缩后的下一个条目。

**Split Turn**：当一个 turn 超过 `keepRecentTokens` 预算时，切割点落在 turn 中间的助手消息处。Pi 生成两份摘要并合并：
1. 历史摘要（之前的上下文）
2. Turn 前缀摘要（该 turn 的早期部分）

## 摘要格式

统一使用 Markdown 结构：

```markdown
## Goal
## Constraints & Preferences
## Progress (Done / In Progress / Blocked)
## Key Decisions
## Next Steps
## Critical Context
<read-files>
<modified-files>
```

### 消息序列化

通过 `serializeConversation()` 将消息转为文本，格式：

```
[User]: 用户输入
[Assistant thinking]: 内部推理
[Assistant]: 回复文本
[Assistant tool calls]: read(path="foo.ts"); edit(path="bar.ts", ...)
[Tool result]: 工具输出（截断至 2000 字符）
```

**关键**：使用 `[Role]:` 前缀防止模型将其视为待继续的对话。工具结果截断至 2000 字符，超出部分替换为截断标记。

### 累积文件追踪

文件操作从以下来源提取并累积：
- 被摘要消息中的工具调用
- 上一次压缩或分支摘要的 `details`

这使得文件追踪跨多次压缩或嵌套分支摘要持续累积。

## 分支摘要

在 `/tree` 导航切换分支时触发：

```
1. 找到新旧位置的公共祖先
2. 从旧叶子节点回退到公共祖先
3. 按 token 预算包含消息
4. 调用 LLM 生成摘要
5. 追加 BranchSummaryEntry { summary, fromId, details }
```

## 自定义压缩（扩展 API）

### `session_before_compact` 事件

```typescript
pi.on("session_before_compact", async (event, ctx) => {
  const { preparation, branchEntries, customInstructions, signal } = event;

  // preparation.messagesToSummarize — 待摘要消息
  // preparation.turnPrefixMessages — split turn 前缀
  // preparation.previousSummary — 上次压缩摘要
  // preparation.fileOps — 提取的文件操作
  // preparation.tokensBefore — 压缩前的 token 数
  // preparation.firstKeptEntryId — 保留消息起始位置
  // preparation.settings — 压缩设置

  // 取消压缩
  return { cancel: true };

  // 提供自定义摘要
  return {
    compaction: {
      summary: "Your summary...",
      firstKeptEntryId: preparation.firstKeptEntryId,
      tokensBefore: preparation.tokensBefore,
      details: { /* custom data */ },
    }
  };
});
```

使用自己的模型生成摘要时，可配合 `serializeConversation` 和 `convertToLlm` 将消息转为文本后调用自有模型。

### `session_before_tree` 事件

```typescript
pi.on("session_before_tree", async (event, ctx) => {
  const { preparation, signal } = event;
  // preparation.targetId, preparation.oldLeafId,
  // preparation.commonAncestorId, preparation.entriesToSummarize,
  // preparation.userWantsSummary

  if (preparation.userWantsSummary) {
    return {
      summary: {
        summary: "Your summary...",
        details: { /* custom data */ },
      }
    };
  }
});
```

## 上下文管理 API

| 函数 | 源文件 | 作用 |
|------|--------|------|
| `prepareCompaction()` | `compaction.ts` | 准备压缩数据（切割点、消息提取、文件操作） |
| `compact()` | `compaction.ts` | 执行压缩流程 |
| `collectEntriesForBranchSummary()` | `branch-summarization.ts` | 收集分支摘要条目 |
| `prepareBranchEntries()` | `branch-summarization.ts` | 按预算准备分支摘要 |
| `generateBranchSummary()` | `branch-summarization.ts` | 生成分支摘要 |
| `serializeConversation()` | `utils.ts` | 消息序列化为纯文本 |
| `convertToLlm()` | 外部导出 | AgentMessage[] → Message[] |

## 核心数据结构

```typescript
interface CompactionEntry<T = unknown> {
  type: "compaction";
  id: string;
  parentId: string;
  timestamp: number;
  summary: string;
  firstKeptEntryId: string;
  tokensBefore: number;
  fromHook?: boolean;
  details?: T;
}

interface BranchSummaryEntry<T = unknown> {
  type: "branch_summary";
  id: string;
  parentId: string;
  timestamp: number;
  summary: string;
  fromId: string;
  fromHook?: boolean;
  details?: T;
}

// 默认 details
interface CompactionDetails {
  readFiles: string[];
  modifiedFiles: string[];
}
```

## Agent 核心层的上下文转换

在 Agent 类中（L2），有两个上下文转换钩子：

```typescript
const agent = new Agent({
  // 1. transformContext: 在 convertToLlm 之前运行
  transformContext: async (messages, signal) => {
    // 裁剪旧消息、注入外部上下文
    const trimmed = messages.slice(-50); // 只保留最近 50 条
    const workspaceInfo = await fetchWorkspaceContext();
    trimmed.unshift({ role: "system", content: workspaceInfo });
    return trimmed;
  },

  // 2. convertToLlm: 必须实现，将 AgentMessage 转为 LLM Message
  convertToLlm: (messages) => {
    return messages
      .filter(m => m.role !== "notification")
      .map(m => ({ role: m.role, content: m.content }));
  },
});
```

## Eidon 集成要点

1. **压缩策略直接复用**：Eidon 的 AI 对话也需要上下文压缩。`reserveTokens` / `keepRecentTokens` 双阈值模型 + 结构化摘要格式可直接采用
2. **摘要格式适配**：将 pi 的 Markdown 摘要格式调整为 Eidon 领域（L1/L2/L3 节点结构、知识库状态等）
3. **transformContext 是关键注入点**：在每次 LLM 调用前，注入当前 workspace 的 L1/L2/L3 索引信息、用户最近操作等
4. **工具结果截断**：2000 字符 + 截断标记的策略可直接复用
5. **文件追踪**：累积文件操作追踪对 Eidon 的知识库整理场景很有用——追踪哪些节点被读取/修改
6. **Eidon 不需要分支摘要**（无 `/tree` 导航），但迭代摘要的累积模式可借鉴
