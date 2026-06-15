# SoloMD 应用（`app/`）

SoloMD 是一个**本地优先的 Markdown 知识库桌面应用**，核心特性是 **Agent Recipes**——
由 LLM 驱动、可定时（cron）或按事件触发、在 AutoGit 分支沙箱中安全读写笔记的自动化任务。

本目录是 pnpm workspace 根，包含三层架构：

| 层 | 技术 | 位置 |
|----|------|------|
| UI | React 19 + TypeScript + Tailwind v4 + Zustand v5 + shadcn/ui + Vite | `src/` |
| 业务核心 | 框架无关 TypeScript（可在 Node 下单测） | `core/` |
| 后端 | Rust + Tauri 2（能力型外壳） | `src-tauri/` |

> UI 层于 v4.4 从 Vue 3 整体迁移到 React，见 [`AGENTS.md`](../AGENTS.md) §0.5（ADR-0010）。

## 常用命令

命令可在**仓库根目录**或本目录执行（根 `package.json` 会代理到此处）：

```bash
pnpm dev          # 桌面开发（Tauri，热重载）
pnpm dev:web      # 仅前端（浏览器，无 Tauri 后端）
pnpm build        # 类型检查 + 构建（tsc --noEmit && vite build）
pnpm lint         # 强制三层边界（eslint-plugin-boundaries）
pnpm test:core    # 跑全部 TS core 测试
pnpm tauri:build  # 打包桌面应用
```

## 推荐 IDE 配置

- [VS Code](https://code.visualstudio.com/)
  - [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
  - [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## 完整规范

目录结构、分层边界、开发约束与扩展规则的**唯一权威来源**是仓库根的
[`AGENTS.md`](../AGENTS.md)；架构决策的「为什么」见其 §0.5。开始任何工作前请通读 `AGENTS.md`。
