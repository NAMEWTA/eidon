# ADR-0019 · 物理删除 AI 子系统，core/ai 留接口占位

**状态：** 已锁定  
**接替：** [ADR-0018](./0018-ai-agent-recipes-out-of-scope.md)（原「保留不挂载」→ 升级为物理删除）  
**日期：** 2026-06  
**分支：** `refactor/eidon-base`  
**删除 commit：** （合并后填入）

## 动机

ADR-0018 将 AI·Agent·Recipes 子系统定为「保留不挂载」。经实践评估，升级处置方式为物理删除：

1. **死代码维护税**：~90 个文件（Rust + TS + React 组件 + CSS + i18n + 测试 + fixtures）虽不挂载但仍占用 lint/build/test 时间，且需在重构中持续避开。
2. **依赖瘦身**：移除 7 个仅 AI 子系统使用的 Rust crate（`futures-util`、`async-stream`、`cron`、`globset`、`hex`、`tracing`、`rusqlite`），减小编译时间与二进制体积。
3. **误用风险**：旧 AI 模块保留在仓库中可能被后续开发者误 import 或误挂载，物理删除消除此风险。
4. **改名债务**：旧代码遍布 `solomd:` 事件名、`Solomd` 前缀类型，保留无维护价值。

## 范围：整块全删

- **AI 调用链**：`core/ai/`（chat-loop / streaming / rewrite / providers）、`src-tauri/src/ai/`（ai_proxy / ollama / keychain / cost_meter / pricing）
- **Agent/Recipes/Trace**：`core/agent/`、`core/recipes/`、`core/trace/`、`core/pricing/`、`src-tauri/src/agent/`、`src-tauri/src/recipes/`
- **Integrations**：`src-tauri/src/integrations/`（REST API / MCP profiles / capture endpoint）
- **RAG**：`src-tauri/src/knowledge/rag.rs`（虽是纯本地语义搜索，但属 ADR-0018 块、UI 已全断线）
- **Bridge 包装层**：`core/bridge/` 下 ai / keychain / agent-tools / cookbook / recipes / run / trace / triggers / search 九个文件
- **契约**：`core/contracts/` 下 recipe / run-meta / trace 三个文件
- **前端组件+stores+lib**：~15 个 .tsx 组件 + 4 个 store + 2 个 lib 文件
- **i18n**：10 个命名空间整块删除（integrations / recipes / ai / rag / rest / wizard / cookbook / cost / agentSettings / agent）
- **CSS**：12 个组件区块删除（~1,300 行）
- **测试+fixtures**：7 个测试文件 + 1 个 fixtures 目录 + 3 个契约 golden fixtures

## 保留物

| 保留项 | 理由 |
|--------|------|
| `core/ai/index.ts`（类型接口占位） | 导出 `ApiFormat`、`ChatMessage`、`AiProviderConfig`、`StreamEvent`/`StreamHandler`、`ChatLoopRequest`/`ChatLoopResult` 类型；`AiNotConnectedError` 错误类；`isAiAvailable(): boolean`（恒 false）；`runChatLoop()`（抛 `AiNotConnectedError`）。零依赖，不 import bridge/react。 |
| `core/ai/README.md` | 历史说明 + 接口契约语义 + 未来接入步骤 + 指向本 ADR |
| `src/lib/clean-ai.ts` + useCommands 的 `clean.aiArtifacts` | 纯本地文本清理（cite markers / smart quotes / invisible chars），不调 AI |
| i18n 四键：`toolbar.cleanAi/cleanAiTitle`、`toast.aiCleaned/noAi` | 同上 |
| `reqwest`、`keyring` crate | 被保留模块 `git/crypto.rs`、`git/github_sync.rs` 共用 |
| `.solomd/` 运行时目录 | ~~历史遗留数据，EIDON 不读不写~~ → 订正：实为被保留的 sync/crypto 在用；已由 [ADR-0022](./0022-complete-solomd-to-eidon-rename-and-migration.md) 改名为 `.eidon-sync/` + `.eidon-encrypted/`（pre-launch，无迁移垫片） |

## 两处摘除手术

Rust 保留模块对被删模块的编译依赖仅两处，均做精确摘除：

1. **`editor/file_ops.rs`** `write_file`：删除 `dispatch_on_save` 块（含 `#[cfg]` 配平）、相关 clone、签名中 `app`/`workspace` 参数、孤儿函数 `extract_tags_for_dispatch`
2. **`git/git_history.rs`** `git_auto_commit`：删除 `dispatch_on_commit` 块、相关 clone、签名中 `app` 参数

## 找回路径

全部删除内容在 git 历史中完整保留：
- `git log -- app/core/ai/ app/core/agent/ app/core/recipes/ app/src-tauri/src/ai/ app/src-tauri/src/agent/` 可浏览历史
- `git show <删除 commit>^:app/core/ai/chat-loop.ts` 可查看具体文件
- 删除 commit 哈希见本 ADR 头部

## Consequences

- `pnpm lint && pnpm build && pnpm test:core && pnpm contracts:check` 全部绿色
- `cd app/src-tauri && cargo check && cargo test && cargo build` 全部绿色
- 残留扫描 `grep -rn "agent_tool_\|recipes_\|cookbook_\|..."` 0 命中
- 未来接入 AI：按 `core/ai/README.md` 步骤，在 `core/ai/` 内实现 provider 构造 + 流解析 → 如需 Rust 透传按 AGENTS.md §4.1/§4.3 加 bridge wrapper → 翻转 `isAiAvailable` → 三层【代码】边界不变
