# core/ai — AI 接入占位

> **现状：本目录只有接口契约，没有任何 AI 实现。** `isAiAvailable()` 恒为
> `false`，`runChatLoop()` 立即抛 `AiNotConnectedError`。

## 历史

原 SoloMD 的 AI·Agent·Recipes 子系统（18 家 provider 目录、SSE/JSON-Lines
流解析、Rust 侧 `ai_proxy` HTTP 透传、OS keychain 密钥管理、Ollama 本地检测、
Agent 工具集、Recipe 自动化、REST/MCP/capture 集成、RAG 本地语义索引）已于
本次重构**整块物理删除**：

- 范围决策：工程层 ADR-0018（AI·Agent·Recipes 不在 EIDON 范围）；
- 处置决策：工程层 ADR-0019（从「保留不挂载」升级为「物理删除 + 接口占位」）；
- 找回路径：完整实现保存在 git 历史中（删除发生在 `refactor/eidon-base` 分支，
  检索提交信息 "remove AI subsystem" 或查看本文件的首次引入提交的父提交）。

注意：`src/lib/clean-ai.ts`（清理粘贴文本中的智能引号/em-dash/隐形字符）是
纯本地文本工具，不属于 AI 子系统，仍然保留。

## 接口契约（`index.ts`）

| 导出 | 语义 |
|------|------|
| `AiProviderConfig` | provider 标识 + 报文格式 + 模型 + 可选 baseUrl |
| `ChatMessage` / `ChatLoopRequest` | 对话消息与一次调用的完整请求（含 `requestId` 供取消） |
| `StreamEvent` / `StreamHandler` | 流式回调：`text` 增量 → `done`（带全文）/ `error` |
| `runChatLoop(request, onEvent)` | 唯一聊天入口；返回最终文本与可选 token 统计 |
| `cancelChat(requestId)` | 取消进行中的请求 |
| `isAiAvailable()` | 能力探测；UI 必须据此隐藏/禁用一切 AI 入口 |
| `AiNotConnectedError` | 未接入时的统一错误 |

## 未来接入步骤（对齐 AGENTS.md §4.1 / §4.3）

1. **本目录**实现 provider 请求构造与流解析（纯 TypeScript、零 UI 框架依赖、
   可在 Node 下单测），替换 `runChatLoop` / `cancelChat` 函数体；
2. 如需 Rust 侧能力（密钥存储、HTTP 透传），在 `core/bridge/` 新增 typed
   wrapper，并在 `src-tauri/src/` 建对称领域文件夹 + `lib.rs`/`runner.rs`
   各加一行 `#[path]` 注册（ADR-0009）；**不得**在 core 其它位置直接 import
   `@tauri-apps/api`；
3. 翻转 `isAiAvailable()`；
4. 三层【代码】边界不变：UI 只 import 本目录 `index.ts` 暴露的公共 API；
   EIDON 数据层四模块（nodes/templates/snapshots/consistency）仍不得
   import 本模块（AGENTS.md §4.4）。

数据层早已预留的零成本接缝：`node.json` 的 `references:[]` / `flags:{}`
字段、节点目录内的 `AGENTS.md` 占位文件。
