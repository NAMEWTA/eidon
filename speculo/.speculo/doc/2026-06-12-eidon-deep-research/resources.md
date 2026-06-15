# 可信资源策展：EIDON 全栈深度研究

> 每一条资源均针对 mission.md 中的 Success 标准，标注覆盖内容与取用时机。
> 本项目资源以源码 + 工程文档为唯一权威（一手资料），辅以外部技术文档作为背景知识。

---

## Knowledge — 知识源（书籍、文档、源码）

### 工程权威指南（一手资料）

| # | 资源 | 路径 | 覆盖 Success # | 覆盖什么 | 何时取用 |
|---|------|------|---------------|---------|---------|
| K1 | AGENTS.md | 仓库根 | 1, 2, 3, 4, 5, 6 | 三层【代码】架构全貌、单向依赖铁律、core/bridge/ 唯一出口、四数据模块职责、已删除 AI 子系统清单、ADR 索引、二次开发唯一落点、可重建铁律。**本研究的绝对权威指南。** | 每个 Phase 都参考；学习前先通读；修改前查对应 ADR。 |
| K2 | CONTEXT.md | `speculo/.speculo/.config/context/CONTEXT.md` | 1, 5 | 全术语消歧表：三层【代码】vs 三层【节点】、workspace 双义、AutoGit 双义、Agent 三义、L1/L2/L3 节点定义、元/扩展字段、四模块职责边界、结构违规四类、不在范围清单。≥30 条精确定义。 | 任何术语混淆时；建立术语表（GLOSSARY.md）时。 |
| K3 | core/index.ts | `app/core/index.ts` | 2, 4, 5, 6 | 所有公开 API 与类型导出：nodes（11 函数+12 类型）、templates（8 函数+8 类型）、snapshots（7 函数+5 类型）、consistency（1 函数+5 类型）+ ai/bridge/contracts/shared。**TS 业务核心入口清单。** | 画调用链路时；新增功能前查已有 API。 |
| K4 | src-tauri/src/lib.rs | `app/src-tauri/src/lib.rs` | 2, 4 | 所有注册 Tauri 命令（~45 个）及其所属模块：file_ops(11)、search(1)、workspace_index(7)、spellcheck(5)、pandoc(2)、git_history(7)、git_ops(5)、cjk_proofread(1)、themes(3)、github_sync(15)、cloud_folder(4)、crypto(4)、watcher(2)。**Rust 能力壳完整清单。** | 追踪「UI → Rust 磁盘」调用链时；新增 Rust 命令时。 |

### 架构决策记录（ADR）——「为什么」的权威来源

| # | 资源 | 路径 | 覆盖 Success # | 覆盖什么 | 何时取用 |
|---|------|------|---------------|---------|---------|
| K5 | 工程层 ADR 登记表 | `speculo/.speculo/.config/adr/README.md` | 1, 5, 6 | 全部工程 ADR（0001-0018）索引与状态。工程基座 6 篇 + EIDON 数据层 8 篇。 | 需要理解某决策的「为什么」时；修改对应领域前必须先读。 |
| K6 | ADR-0001（Core=Rust 能力壳） | `speculo/.speculo/.config/adr/` | 1, 4 | 为什么 Core(TS) 跑 webview 而 Rust 只做能力型外壳（文件 IO/搜索/拼写/导出/版本/加密）。 | 理解三层【代码】分工原理时。 |
| K7 | ADR-0007（ESLint 三层边界） | `speculo/.speculo/.config/adr/` | 1, 2 | 为什么 `core/bridge/` 是唯一 Tauri 出口（allowlist=0），以及边界机器强制的设计原理。 | 理解 bridge 唯一出口的设计理由时。 |
| K8 | ADR-0012（四模块落点） | `speculo/.speculo/.config/adr/` | 5 | 为什么 nodes/templates/snapshots/consistency 四个并列模块各司其职，以及互不 import 内部的边界。 | 新增数据层能力前查落点归属。 |
| K9 | ADR-0013（三层节点拓扑+多模板） | `speculo/.speculo/.config/adr/` | 5 | 深度=层级铁律、创建期硬强制、文件白名单、模板版本化不可变的设计原理。 | 理解 L1/L2/L3 为什么这样设计时。 |

### 源码（一手资料，每个 Phase 对应）

| # | 资源 | 路径 | 覆盖 Success # | 覆盖什么 | 何时取用 |
|---|------|------|---------------|---------|---------|
| K10 | nodes 模块源码 | `app/core/nodes/` | 2, 5, 6 | 节点身份(ULID)、node.json 读写、扫描建树、CRUD、提升为节点。数据层最核心模块。 | Phase 4（nodes 深度研究）。 |
| K11 | templates 模块源码 | `app/core/templates/` | 5, 6 | 模板 6 类字段、版本化不可变、内置种子、设置面板数据源。 | Phase 5（templates 深度研究）。 |
| K12 | snapshots 模块源码 | `app/core/snapshots/` | 2, 6 | 版本能力：薄封装现有 git bridge、commit/diff/restore/list。 | Phase 6（版本链路研究）。 |
| K13 | consistency 模块源码 | `app/core/consistency/` | 5, 6 | 结构违规检测四类：普通文件夹/位置非法/层级不符/.node缺失。 | Phase 7（一致性检测研究）。 |
| K14 | bridge 层源码 | `app/core/bridge/` | 2, 4 | TypeScript 侧 Tauri `invoke()` 包装层：typed wrapper for each Rust command。唯一合法 invoke 调用点。 | Phase 2（bridge 调用链研究）。 |
| K15 | Markdown 渲染管道 | `app/src/components/Preview.tsx` + `app/src/lib/` | 3 | 从文件字节到屏幕像素的完整渲染管道（CodeMirror → markdown 解析 → React 渲染）。 | Phase 3（渲染管道研究）。 |
| K16 | 前端入口与编排 | `app/src/main.tsx` + `app/src/App.tsx` | 2 | 双 React root（默认 + slideshow）、窗格/视图模式/全局事件编排。 | 追踪用户操作起点时。 |

### 外部技术文档（背景知识）

| # | 资源 | 覆盖 Success # | 覆盖什么 | 何时取用 |
|---|------|---------------|---------|---------|
| K17 | Tauri 2 官方文档（v2.tauri.app） | 4 | Tauri command 机制、invoke 协议、事件系统、plugin 体系。 | 理解 bridge→Rust 通信机制时。 |
| K18 | Zod 官方文档（zod.dev） | 5 | 运行时 schema 校验、infer 类型推导。理解 `core/contracts/` 的契约定义方式。 | 理解磁盘契约校验机制时。 |
| K19 | Rust book（doc.rust-lang.org/book/） | 4, 6 | Rust 基础语法、模块系统、`#[path]` 属性、`tauri::command` 宏。 | 需要读懂或修改 Rust 代码时。 |

---

## Wisdom — 智慧源（社区、论坛）

> 本项目为内部代码库深度研究，无外部社区。以下为相关技术栈的求助渠道。

| # | 资源 | 覆盖 Success # | 覆盖什么 | 何时取用 |
|---|------|---------------|---------|---------|
| W1 | Tauri Discord（discord.gg/tauri） | 4 | Tauri 2 使用问题、跨平台适配、Rust↔TS 通信疑难。 | 遇到 Tauri 特定 bug 或 API 不明确时。 |
| W2 | Reactiflux Discord（discord.gg/reactiflux） | 2, 3 | React 19、Zustand 状态管理、CodeMirror 集成问题。 | 前端架构或性能问题时。 |

---

## Gaps — 资源缺口

- **无缺口。** 本研究以源码为唯一真理源，六条 Success 标准均有对应核心文件覆盖。外部资源仅作背景补充，非必须。
