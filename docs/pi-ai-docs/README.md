# Pi Monorepo 深度调研文档

> **调研对象**: [earendil-works/pi](https://github.com/earendil-works/pi) (62.4k star)
> **调研日期**: 2026-06-14
> **目的**: 为 Eidon 项目构建 AI AGENT（交互式 + 触发式双模式）提供技术参考

---

## Pi Monorepo 简介

Pi 是一个模块化、可扩展的 AI Agent 框架，使用 TypeScript 编写，以 MIT 许可证发布。
由 Mario Zechner (badlogic) 维护，发布在 `@earendil-works` npm scope 下。

核心设计哲学：「扩展而非分叉」——所有高级功能（子代理、计划模式、MCP、权限弹窗等）
均通过扩展系统实现，核心保持极简。

## 文档索引

| 序号 | 文档 | 内容 | 重要度 |
|------|------|------|--------|
| 1 | [架构总览](./01-architecture-overview.md) | Monorepo 结构、三层 API 设计、数据流 | ⭐⭐⭐ |
| 2 | [pi-ai: LLM 提供商](./02-pi-ai-llm-provider.md) | 22+ 提供商统一 API、getModel、stream/complete | ⭐⭐ |
| 3 | [pi-agent-core: Agent 运行时](./03-pi-agent-core.md) | Agent/agentLoop/AgentHarness、事件流、工具调用 | ⭐⭐⭐ |
| 4 | [pi-coding-agent: CLI 与扩展](./04-pi-coding-agent.md) | CLI 命令、会话管理、Skills/Prompts/Themes、Pi Packages | ⭐⭐⭐ |
| 5 | [pi-tui: 终端 UI](./05-pi-tui.md) | Component 系统、差分渲染、主题、布局 | ⭐ |
| 6 | [扩展 API 完整参考](./06-extensions-api.md) | pi.register* 全部方法、事件类型、ExtensionContext | ⭐⭐⭐ |
| 7 | [事件系统与生命周期](./07-event-system.md) | 完整事件清单、生命周期流程、Hook 系统 | ⭐⭐⭐ |
| 8 | [压缩与上下文管理](./08-compaction-context.md) | 自动压缩策略、token 阈值、自定义压缩 | ⭐⭐ |
| 9 | [自动化/触发式工作流](./09-automation-patterns.md) | pi-chat、heartbeat、worker 编排、事件驱动模式 | ⭐⭐⭐ |
| 10 | [Eidon 集成指南](./10-eidon-integration-guide.md) | 针对 Eidon (Tauri 2 + Rust) 的集成方案（交互式+触发式），对接 core/ai/ 占位 | ⭐⭐⭐ |

## 快速导航：按需求

### 我想了解 pi 的核心架构
→ [01-架构总览](./01-architecture-overview.md)

### 我想知道如何注册自定义工具/命令
→ [06-扩展 API 完整参考](./06-extensions-api.md)

### 我想实现类似 GitHub Copilot 的交互式对话
→ [10-Eidon 集成指南](./10-eidon-integration-guide.md) §交互式模式

### 我想实现按钮/定时/事件触发的自动任务
→ [09-自动化/触发式工作流](./09-automation-patterns.md) + [10-Eidon 集成指南](./10-eidon-integration-guide.md) §触发式模式

### 我想了解 Agent 的事件流和生命周期
→ [07-事件系统与生命周期](./07-event-system.md)

## 关键发现摘要

1. **三层 API 设计**是 pi 最核心的架构决策：`agentLoop`（无状态生成器）→ `Agent`（有状态+事件）→ `AgentHarness`（持久化+Phase 状态机）
2. **扩展系统极其强大**：可注册工具、命令、快捷键、Provider、UI 组件，Hook 全部生命周期事件
3. **自动化模式成熟**：pi-chat 通过 Gondolin VM + tmux 实现 Discord/Telegram 的沙盒化 Agent；heartbeat 扩展实现 cron 式定时任务
4. **会话持久化**：JSONL 格式 + 树状分支 + 压缩/摘要机制，天然支持 fork/clone/resume
5. **Eidon 可直接复用**的设计模式：Agent 类、事件订阅、工具注册、压缩策略、Provider 抽象；落点在 `core/ai/`（纯 TS，框架无关）
