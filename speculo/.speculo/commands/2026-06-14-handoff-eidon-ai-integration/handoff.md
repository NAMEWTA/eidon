# Handoff

## 目标

为 EIDON 2.0 确定 AI 集成方案。研究 Tolaria 的 AI CLI 接入方式，对比 spawn CLI vs 直接引入 SDK/库两种路线，做出架构决策。

## 已完成

### 核心结论：直接引入 pi-agent-core + pi-ai 库，不走 spawn CLI

**Tolaria 的 spawn 模式不适用于 EIDON：**

- Tolaria 在 Rust 后端通过 `std::process::Command::spawn()` 启动本地安装的 CLI 二进制（`claude -p ...`、`pi --mode json ...` 等），读 stdout JSON 行解析事件。
- 此模式对 6 个 agent 各需 200-600 行独立代码（二进制发现 + 参数构建 + 事件映射）。
- **合规风险**：Claude Code 订阅政策下，`claude -p` 的许可是面向个人开发者的终端/脚本使用，作为第三方应用的嵌入式 AI 引擎存在明确的合规风险。Claude API / Claude Agent SDK / Managed Agents 才是正确的应用集成通道。

**Pi 项目提供了一套完整的 TS 库生态，本身就是作为 SDK 设计的：**

| 库 | npm scope | 用途 |
|---|---|---|
| `pi-ai` | `@earendil-works/pi-ai` | 统一多厂商 LLM API 抽象层（17+ 厂商：Anthropic, OpenAI, Google, Mistral...）。导出 `getModel()`, `stream()`, `complete()`, `validateToolCall()` |
| `pi-agent-core` | `@earendil-works/pi-agent-core` | Agent 运行时。导出 `Agent` 类，`agentLoop()` 生成器，支持流式事件、工具调用、状态管理、steering/follow-up |
| `pi-coding-agent` | `@earendil-works/pi-coding-agent` | 交互式 CLI 二进制（Tolaria spawn 的就是这个，**EIDON 不需要用它**） |
| `pi-tui` | `@earendil-works/pi-tui` | 终端 UI 库（EIDON 不需要） |

**依赖链：** `pi-ai`（LLM 抽象） ← `pi-agent-core`（agent 运行时） ← `pi-coding-agent`（CLI 二进制）

**两类库均可直接 `import` 使用，MIT 许可，纯 TypeScript。**

### 对比：spawn CLI vs 直接引入库

| 维度 | spawn CLI（Tolaria） | 直接引入 pi 库（推荐） |
|---|---|---|
| 依赖方式 | `Command::spawn("pi")` | `import { Agent } from "@earendil-works/pi-agent-core"` |
| 运行位置 | Rust 后端 spawn 独立进程 | EIDON 前端（React/TS），与 UI 同进程 |
| 通信 | stdout JSON → 逐行解析 → Tauri event | 原生 TS 事件订阅 + 类型安全 |
| 二进制依赖 | 用户必须本地安装 CLI | `pnpm add` 即可 |
| 版本管理 | 依赖 PATH 环境 | `package.json` 锁定 |
| 事件适配 | 每个 CLI 独立实现 JSON→Event 映射 | 库自带事件系统 |
| 工具调用 | MCP adapter + WebSocket 回调 | `AgentTool.execute` 直接回调 |
| 多厂商切换 | 每个厂商独立适配代码 | `getModel('anthropic', 'claude-opus-4-8')` 一行 |
| 合规基线 | Claude Code `-p` 模式有政策风险 | 通过 `pi-ai` 调 Anthropic API，走正规 API 通道 |

### 已研究的关键文件

- `temp/tolaria-main/src-tauri/src/cli_agent_runtime.rs` — Tolaria 的通用 spawn 管线（共享 runner）
- `temp/tolaria-main/src-tauri/src/claude_cli.rs` — Claude Code 的二进制发现 + 事件分发
- `temp/tolaria-main/src-tauri/src/claude_invocation.rs` — `claude -p --output-format stream-json --mcp-config ...` 参数构建
- `temp/tolaria-main/src-tauri/src/pi_cli.rs` + `pi_config.rs` + `pi_discovery.rs` — Pi CLI 集成（参数：`pi --mode json --no-session --extension npm:pi-mcp-adapter`）
- Pi monorepo: `github.com/earendil-works/pi` — `packages/ai`（`pi-ai`）、`packages/agent`（`pi-agent-core`）、`packages/coding-agent`（CLI）、`packages/tui`

## 未完成

1. **API key 安全传递**：`pi-ai` 在前端运行时，API key 需要从 Rust 后端的 secure storage 获取，不能暴露在 webview 里。具体方案待设计。
2. **EIDON 的 AI 功能范围定义**：需要确定最终需要哪些 AI 能力（聊天补全？agentic 工具调用？多厂商切换？），据此决定引入 `pi-ai` 还是 `pi-agent-core` 还是两者。
3. **`pi-ai` 的 `@earendil-works` scope 稳定性评估**：确认该包的发布节奏、API 稳定性承诺和社区活跃度。
4. **备选方案评估**：如果 Pi 库不可用，回退到直接使用 `@anthropic-ai/sdk` + 自建 agent loop，或通过 Managed Agents。

## 验证

- Tolaria 的 spawn 模式通过源码审查完整追踪了调用链路（Rust → spawn → stdout JSON → event emit）。
- Pi 库生态通过 GitHub monorepo README 和 npm registry 确认了包结构、API 能力和许可证。
- Claude Code 订阅政策在 claude-api skill 和模型迁移文档中确认了 `claude -p` 与 API/SDK/Managed Agents 的定位差异。
- 未运行代码：EIDON 项目中尚未 `pnpm add` 这些库做集成验证。

## 推荐技能

- `claude-api` — 后续 API 集成需要 Anthropic SDK 参考
- `goal-builder` — 如果要将 AI 集成作为长跑任务拆解

## 摘要

1. **Tolaria 的 spawn CLI 模式不适用于 EIDON**：合规风险（Claude Code `-p` 非应用集成通道）+ 工程成本高（每个 agent 200-600 行适配代码）。
2. **Pi 提供了更好的方案**：`@earendil-works/pi-ai`（多厂商 LLM 抽象）+ `@earendil-works/pi-agent-core`（agent 运行时）是纯 TS 库，MIT 许可，直接 `import` 使用。
3. **架构方向**：EIDON 前端引入 Pi 库 → 通过 Tauri Rust 后端安全存储获取 API key → 在前端或 Node.js sidecar 中运行 agent 循环。
4. **与 spawn 的本质区别**：spawn 是"把 CLI 当 SDK 用"的权宜之计，Pi 库本身就是 SDK，不需要进程边界、不需要 JSON 解析适配。
5. **下一步**：确定 AI 功能范围 → 评估 Pi 库稳定性 → 做 PoC 集成验证。
