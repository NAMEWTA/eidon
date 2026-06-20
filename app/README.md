# EIDON 应用（`app/`）

EIDON 是一个**本地优先的结构化知识 IDE**：给本地 Markdown 知识库装上固定三层【节点】拓扑 + 多模板 schema 的数据地基。

本目录是 pnpm workspace 根。**Electron 全 TypeScript**，`frontend → bridge → backend + shared` 单向四层（见 [`AGENTS.md`](../AGENTS.md) §2.1 / ADR-0025）：

| 层 | 技术 | 位置 |
|----|------|------|
| 前端（纯 UI） | React 19 + TypeScript + Tailwind v4 + Zustand v5 + shadcn/ui（electron-vite） | `frontend/` |
| 桥接（契约边界） | 渲染侧 typed IPC 包装（`eidonInvoke` + 各域 + 平台 API） | `bridge/ipc/` |
| 共享（框架无关叶子） | 纯 TypeScript（四层共用，可在 Node 下单测） | `shared/`（models / contracts / ipc / utils） |
| 后端（main 进程） | Electron main（Node）：壳 + IPC 接入 + 编排 + 业务规则 + 能力层 | `backend/`（shell / ipc / services / domain / capabilities） |
| 接缝 | preload `contextBridge` 暴露 `window.eidon` | `preload/`、`bridge/ipc/` |

## 常用命令

命令可在**仓库根目录**或本目录执行（根 `package.json` 会代理到此处）：

```bash
pnpm dev          # 桌面开发（Electron，热重载）
pnpm typecheck    # 类型检查（renderer + backend/preload/shared）
pnpm build        # 类型检查 + 三进程构建（electron-vite build）
pnpm lint         # 强制四层【代码】边界（eslint-plugin-boundaries）
pnpm test:core    # 跑核心测试（shared + backend 能力层）
pnpm test:ui      # 跑渲染层纯模块测试
pnpm dist:mac     # 打包桌面应用（mac / win / linux）
```

## 推荐 IDE 配置

- [VS Code](https://code.visualstudio.com/)
  - [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)
  - [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## 完整规范

目录结构、分层边界、开发约束与扩展规则的**唯一权威来源**是仓库根的
[`AGENTS.md`](../AGENTS.md)；架构决策的「为什么」见工程层 ADR。开始任何工作前请通读 `AGENTS.md`。
