> **服务工作流：** `../02-prd/02-prd.md`
> **产物文件名：** `overview.md`

# Overview

## 目标区域

本次变更服务于 EIDON 2.0「节点 + 模板内核」：把当前 SoloMD 扁平 Markdown workspace 升级为 EIDON 受管根，在不改动三层【代码】架构的前提下，新增固定三层【节点】拓扑与多模板 schema。用户目标是先在设置中定义领域模板，再按 `L1 / L2 / L3` 创建结构节点，把内容限制在 L3，并能把存量普通文件夹逐步提升为节点。

现有入口主要来自当前桌面应用的 workspace 打开、文件树、新建文件 / 文件夹、编辑器、搜索和历史面板。目标体验不另造编辑器、搜索、删除或版本系统，而是让这些既有入口识别节点身份、模板字段与结构违规。

## 模块全景

候选模块与边界如下：

- `core/contracts`：新增 `node.json`、template schema、`.eidon/` 布局契约与 golden fixtures，是磁盘形状的单一事实源。
- `core/nodes`：负责 ULID 身份、`.node/node.json` 读写、扫描建树、id→path 映射、节点 CRUD 与提升为节点。
- `core/templates`：负责 `.eidon/templates/` 初始化、内置模板种子、6 类字段 schema、版本化不可变、编辑生成新版与删除后的孤儿模板态。
- `core/snapshots`：只做现有 git 历史 / diff / 恢复 bridge 的薄封装，不新增快照逻辑。
- `core/consistency`：只读扫描四类结构违规，并把标记交给 FileTree 渲染；不自动补全、不自动移动、不写软态身份系统。
- `core/bridge`：三层【代码】架构中唯一 Tauri 出口，承接文件、git、搜索等 typed wrappers。
- `src`：改造 FileTree 为节点感知；新增设置内 TemplateManager、NodeCreateDialog、NodeInspector 与 nodes/templates store；继续复用 Editor、Preview、Outline、GlobalSearch、HistoryPanel。
- `src-tauri/editor`：优先复用 file_ops 完成目录遍历与 `.node/` 文件读写。
- `src-tauri/git`：继续提供现有版本历史、diff、恢复能力。

数据流向保持单向：React UI 调用 `core` 公共 API，`core` 经 `core/bridge` 调用 Rust 能力壳；数据层四模块不得 import UI 框架，也不得依赖旧 AI·Agent·Recipes 子系统。

## 现有行为

当前代码已经具备成熟的本地 Markdown 工作台基础：workspace 打开、FileTree 文件导航、CodeMirror 编辑 / Preview / Outline、失焦自动保存、全文搜索、watcher 外部刷新、HistoryPanel + git 历史 / diff / 恢复，以及直接删除文件树条目的能力。

当前代码也保留旧 SoloMD 的 AI·Agent·Recipes、trace、pricing、RAG、REST、MCP、capture、cloud/github sync 等模块与 UI 入口代码。根据工程层 ADR-0018，这些代码本期作为基底保留，但不挂载、不依赖、不纳入 EIDON 数据层。

已确认的工程约束包括：三层【代码】单向依赖不动；`core/bridge` 是唯一 Tauri 出口；`core` 禁 UI 框架；磁盘契约变化必须先改 zod + fixtures；EIDON 数据层新增在 `core/nodes`、`core/templates`、`core/snapshots`、`core/consistency` 四个并列模块。

代码现实是当前仓库尚无 EIDON 数据层实现：没有 `.eidon/`、`.node/`、`templateId`、`schemaVersion`、节点扫描建树、模板管理、节点感知 FileTree 或结构违规标记。

## 缺失能力

为完成本期目标，仍缺少以下能力：

- 磁盘契约：`node.json`、template schema、`.eidon/` 系统区布局的 zod 契约、fixtures 与 conformance 检查。
- Workspace 懒初始化：首次使用节点 / 模板功能时创建 `.eidon/templates/`，写入内置模板，且不重复初始化、不复活用户删除的模板。
- 模板管理：设置内创建、编辑、删除、版本管理三层【节点】模板；支持 6 类字段与旧节点懒迁移语义。
- 节点拓扑：按深度=层级铁律创建 L1/L2/L3；L1 选模板，L2/L3 继承父链模板；生成 `.node/node.json`、README.md、AGENTS.md。
- 节点维护：重命名 / 移动保持 ID 不变；扫描可从 `.node/` + `.eidon/templates/` 重建节点树；普通文件夹可由用户点击提升为节点。
- 节点感知 UI：FileTree 区分结构节点与普通文件夹，隐藏 `.node/`，渲染层级 / 模板 / 违规标记；节点字段表单按 schemaVersion 渲染。
- 一致性检测：识别前 3 个物理深度里的普通文件夹、L1/L2 内容文件、节点深度与 `level` 不符、`.node/` 缺失或损坏，并提供手动整改入口。
- 改名收口：solomd → EIDON 的可见品牌、packageName、窗口标题、about、i18n 与系统区命名调整；旧 `.solomd/` 静置不迁移。

## 风险与未知点

- 扫描性能：先通过 Core(TS) + 现有 file bridge 实现；若万级文件 workspace 阻塞明显，才按工程层 ADR-0009 增加最小 Rust scan 原子命令。
- 改名批次：可见品牌改名与 `.eidon/` 系统区落地的具体顺序可在实现期切片；不得引入 `.solomd` / `.eidon` 双系统区兼容逻辑。
- 模板编辑与批量升级：本期 PRD 需要明确「编辑生成新版本、已有节点保持旧版」是硬行为；批量升级可以作为用户显式操作，但实现切片要避免影响契约先行。
- 删除语义：本期复用现有直接删除，无 `.eidon/trash`；PRD 需要清楚标注这是复用现状而非回收站交付。
- 版本语义：本期版本 / diff 直接用现有 git，`core/snapshots` 仅薄封装；不得误写为 `.eidon/snapshots.git` 或保存 / 快照解耦。
- 旧 AI 模块隔离：代码仍存在大量 `solomd` 与 `.solomd` 字符串，部分属于不在 EIDON 范围的旧 AI 子系统。改名和移除挂载时需要区分产品可见面与保留基底，避免无意重写旧子系统。
- 术语风险：所有产出必须持续消歧三层【代码】与三层【节点】，并区分工程层 ADR 与产品层 ADR。
