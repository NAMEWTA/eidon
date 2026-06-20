# 策展资源：EIDON 新人上手

**日期：** 2026-06-20

## 项目内资源（最高信任度）

| 资源 | 路径 | 覆盖内容 | 何时取用 |
|------|------|---------|---------|
| AGENTS.md | `AGENTS.md` | 架构、分层、开发规范、ADR索引 | 所有课程的核心参考 |
| ADR 登记表 | `speculo/.speculo/.config/adr/README.md` | 所有工程决策的编号与取代链 | 理解「为什么这样设计」 |
| ADR-0025 | `speculo/.speculo/.config/adr/0025-*.md` | 四层架构决策 | Lesson 1, 2 |
| ADR-0013 | `speculo/.speculo/.config/adr/0013-*.md` | 节点拓扑 | Lesson 4 |
| ADR-0024 | `speculo/.speculo/.config/adr/0024-*.md` | Tauri→Electron迁移记录 | Lesson 1 背景 |
| CONTEXT.md | `speculo/.speculo/.config/context/CONTEXT.md` | 术语消歧表 | 所有课程遇到「分层」「三层」时的参考 |
| eslint.config.mjs | `app/eslint.config.mjs` | 边界规则的实际实现 | Lesson 6 |
| shared/ipc/channels.ts | `app/shared/ipc/channels.ts` | 85通道定义 | Lesson 3, 5 |
| CLAUDE.md | `CLAUDE.md` | Claude Code 入口 | 使用 AI 助手时的指引 |

## 外部资源

| 资源 | 覆盖内容 | 推荐理由 |
|------|---------|---------|
| Electron Process Model | electronjs.org/docs/latest/tutorial/process-model | Electron 主进程/渲染进程/preload 基础 | 理解 preload 唯一接缝的前提知识 |
| eslint-plugin-boundaries | github.com/javierbrea/eslint-plugin-boundaries | 项目的机器强制边界工具 | Lesson 6 深入 |
| isomorphic-git | isomorphic-git.org | 纯 JS git 实现，项目用它替代了 Rust git2 | Lesson 5 |
| Zod v4 | zod.dev | 项目用 zod 做磁盘契约验证 | Lesson 3 |

## 推荐社区

- EIDON GitHub Issues: github.com/NAMEWTA/eidon/issues — 问题跟踪与讨论
