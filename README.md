# EIDON

**本地优先的结构化知识 IDE** — 为 Markdown 知识库装上固定三层节点拓扑与多模板 schema 的数据地基。

[![CI](https://github.com/NAMEWTA/eidon/actions/workflows/ci.yml/badge.svg)](https://github.com/NAMEWTA/eidon/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## 下载安装

前往 [Releases](https://github.com/NAMEWTA/eidon/releases) 下载最新版本。

| 平台 | 安装包 |
|------|--------|
| **macOS** (Apple Silicon / Intel) | `EIDON-*.dmg` |
| **Windows** (x64) | `EIDON-*-setup.exe` / `EIDON-*.msi` |
| **Linux** (x64) | `EIDON-*.deb` / `EIDON-*.rpm` |

### macOS 安装说明

1. 下载 `.dmg` 文件，双击挂载
2. 将 **EIDON.app** 拖入 `Applications` 文件夹
3. 首次打开时，若 macOS 提示「无法验证开发者」，请执行：

```bash
xattr -rd com.apple.quarantine /Applications/EIDON.app
```

然后右键（或 Ctrl+点击）EIDON.app → **打开**，确认即可。

> EIDON 当前为直接分发版本，未经过 Apple 公证。上述命令移除 macOS 的隔离标记。

---

## 功能

- **固定三层节点拓扑** — L1 → L2 → L3，深度即层级，第 4 层起为自由文件夹
- **多模板 schema** — 每层可绑定额字段集，6 种字段类型（文本/数字/日期/选择/布尔/长文本），版本化不可变
- **节点身份** — 每节点 ULID 标识，存 `.node/node.json`，随目录移动
- **日历整理箱** — 按日期浏览、管理节点内容
- **节点级待办 + 提醒** — 每节点 `.node/todos.json`，支持定时提醒
- **结构一致性检测** — 自动扫描违规（缺身份、层级不符、位置非法）并在文件树标记
- **版本历史** — 基于 Git，自动提交 + diff 对比 + 历史恢复
- **全文搜索** — 跨节点内容 + 可选按模板/层级/字段过滤
- **完全离线** — 无任何联网依赖，数据 100% 本地
- **可迁移** — 拷贝 workspace 到任意机器，模板 + 节点 + 内容完整自包含

---

## 开发

### 技术栈

| 层 | 技术 |
|----|------|
| UI（渲染层） | React 19 + TypeScript + Tailwind CSS v4 + Zustand v5 + shadcn/ui（electron-vite） |
| 桥接（契约边界） | typed IPC 包装（`eidonInvoke` + 各域 + 平台 API） |
| 共享层（models/contracts/ipc/utils） | 纯 TypeScript（框架无关，四层共用，Node 下单测） |
| 后端（main 进程） | Electron main（Node）+ typed IPC + 能力层（iso-git / nspell / jschardet 等纯 JS 库） |
| 校验 | zod 运行时契约 + golden fixtures |
| 构建/打包 | electron-vite + electron-builder |
| 包管理 | pnpm |

> Electron 全 TypeScript + frontend/bridge/backend/shared 单向四层（见 [`AGENTS.md`](AGENTS.md) §2.1 / ADR-0025）。

### 环境要求

- **Node.js** ≥ 22
- **pnpm** ≥ 11

### 快速开始

```bash
# 克隆仓库
git clone https://github.com/NAMEWTA/eidon.git
cd eidon

# 安装依赖
pnpm --dir app install

# 启动桌面开发（Electron，热重载）
pnpm dev
```

### 常用命令

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 桌面开发（Electron 热重载） |
| `pnpm typecheck` | 类型检查（renderer + main/preload/shared） |
| `pnpm build` | 类型检查 + 三进程构建（electron-vite build） |
| `pnpm lint` | ESLint 四层边界检查 |
| `pnpm test:core` | 跑核心测试（shared + main 能力层） |
| `pnpm contracts:check` | 契约 conformance 测试 |
| `pnpm dist:mac` / `dist:win` / `dist:linux` | 打包桌面安装包（electron-builder） |

提交前最低：`pnpm lint && pnpm typecheck && pnpm test:core`。

### 本地构建安装包

```bash
# 当前平台 / 指定平台
pnpm dist           # 当前 OS
pnpm dist:mac       # dmg
pnpm dist:win       # nsis + msi
pnpm dist:linux     # deb + rpm

# 或使用 release 脚本（自动 bump app/package.json 版本 + tag + push 触发 CI）
./scripts/release.sh 0.0.2
```

---

## 架构

```
frontend(React UI 纯渲染) ──┐
bridge(IPC 包装) ───────────┤──window.eidon(IPC)──▶ backend/ipc ──▶ backend/services ──▶ backend/{domain, capabilities}
                             │                                                         node:fs / isomorphic-git / 库
shared(models + contracts + ipc + utils) ← 四层均可 import（框架无关叶子）
```

单向依赖（`frontend → bridge → backend(ipc→service→{domain,capability}) + shared`），`shared/` 禁 UI 框架，preload 暴露的 `window.eidon` 为 frontend↔backend 唯一接缝。

详细规范见 [`AGENTS.md`](AGENTS.md)；架构决策记录见 `speculo/.speculo/.config/adr/`。

---

## 相关文档

- **[AGENTS.md](AGENTS.md)** — AI 助手与开发者权威指南（架构、规范、扩展约束）
- **[CLAUDE.md](CLAUDE.md)** — Claude Code 入口（指向 AGENTS.md）
- **[speculo/.speculo/.config/adr/](speculo/.speculo/.config/adr/)** — 工程层架构决策记录（ADR）
- **[docs/](docs/)** — 设计文档与产品需求

---

## License

[MIT](LICENSE) © NAMEWTA
