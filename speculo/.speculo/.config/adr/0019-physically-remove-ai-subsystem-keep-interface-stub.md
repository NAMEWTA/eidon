# ADR-0019 · 物理删除 AI 子系统，留接口占位

**状态：** 已锁定  
**接替：** [ADR-0018](./0018-ai-agent-recipes-out-of-scope.md)（原「保留不挂载」→ 升级为物理删除）  
**日期：** 2026-06  
**分支：** `refactor/eidon-base`  
**删除 commit：** （合并后填入）

## 动机

ADR-0018 将 AI·Agent·Recipes 子系统定为「保留不挂载」。经实践评估，升级处置方式为物理删除：

1. **死代码维护税**：~90 个文件（TS + React 组件 + CSS + i18n + 测试 + fixtures）虽不挂载但仍占用 lint/build/test 时间，且需在重构中持续避开。
2. **依赖瘦身**：移除 7 个仅 AI 子系统使用的原生依赖，减小编译时间与体积。
3. **误用风险**：旧 AI 模块保留在仓库中可能被后续开发者误 import 或误挂载，物理删除消除此风险。
4. **改名债务**：旧代码遍布 `solomd:` 事件名、`Solomd` 前缀类型，保留无维护价值。

## 范围：整块全删

- **AI 调用链**：`core/ai/`（chat-loop / streaming / rewrite / providers，已删）
- **Agent/Recipes/Trace**：`core/agent/`、`core/recipes/`、`core/trace/`、`core/pricing/`（已删）
- **Integrations**：REST API / MCP profiles / capture endpoint（已删）
- **RAG**：纯本地语义搜索（属 ADR-0018 块、UI 已全断线，已删）
- **Bridge 包装层**：ai / keychain / agent-tools / cookbook / recipes / run / trace / triggers / search 九个包装文件（已删）
- **契约**：`core/contracts/` 下 recipe / run-meta / trace 三个文件
- **前端组件+stores+lib**：~15 个 .tsx 组件 + 4 个 store + 2 个 lib 文件
- **i18n**：10 个命名空间整块删除（integrations / recipes / ai / rag / rest / wizard / cookbook / cost / agentSettings / agent）
- **CSS**：12 个组件区块删除（~1,300 行）
- **测试+fixtures**：7 个测试文件 + 1 个 fixtures 目录 + 3 个契约 golden fixtures

## 保留物

| 保留项 | 当前落点 | 理由 |
|--------|---------|------|
| AI 类型接口占位 | `app/shared/models/ai.ts` | 导出 `ApiFormat`、`ChatMessage`、`AiProviderConfig`、`StreamEvent`/`StreamHandler`、`ChatLoopRequest`/`ChatLoopResult` 类型；`AiNotConnectedError` 错误类。零依赖。 |
| AI 空实现占位 | `app/backend/domain/ai.ts` | `isAiAvailable(): boolean`（恒 false）；`runChatLoop()`（抛 `AiNotConnectedError`）。 |
| `frontend/lib/clean-ai.ts` + useCommands 的 `clean.aiArtifacts` | `app/frontend/lib/clean-ai.ts` | 纯本地文本清理（cite markers / smart quotes / invisible chars），不调 AI |
| i18n 四键：`toolbar.cleanAi/cleanAiTitle`、`toast.aiCleaned/noAi` | i18n 文件 | 同上 |
| 网络 / keychain 原生依赖 | 已删 | — |
| 运行时目录 | `.eidon-sync/` + `.eidon-encrypted/` | 已由 ADR-0022 从 `.solomd/` / `.solomd-encrypted/` 改名 |

> **注：** `ai-README.md` 已随代码迁移融合进 AGENTS.md §6，不再独立维护。

## 找回路径

全部删除内容在 git 历史中完整保留：
- `git log -- app/core/ai/ app/core/agent/ app/core/recipes/` 可浏览历史
- `git show <删除 commit>^:app/core/ai/chat-loop.ts` 可查看具体文件
- 删除 commit 哈希见本 ADR 头部

## Consequences

- `pnpm lint && pnpm typecheck && pnpm test:core && pnpm contracts:check` 全部绿色
- 残留扫描 `grep -rn "agent_tool_\|recipes_\|cookbook_\|..."` 0 命中
- 未来接入 AI：在 `backend/domain/ai` 内实现 provider 构造 + 流解析 → 如需新原生能力按 AGENTS.md §4.3 加 IPC 通道+能力 → 翻转 `isAiAvailable` → 四层【代码】边界不变

---
> **注：** 实现路径以 ADR-0025（四层架构）与 AGENTS.md §2 / 代码为准。
