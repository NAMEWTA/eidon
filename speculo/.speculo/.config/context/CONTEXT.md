# Project Context · 术语与消歧表

> 跨所有 Speculo workflow / PRD / 旅程 / 代码注释共享的**长期术语表**。
> 沉淀自 `dev/eidon-base-roadmap/`（D-1~D-12 决策）、`docs/EIDON_本期迭代_*.md` 与工程层 `adr/ADR-0011~0018`。
> 本表由用户确认后写入；新增/修订术语须经用户同意。

---

## 0. 产品定位（一句话锚点）

**EIDON = 基于 SoloMD 的颠覆性产品迭代重构（1.x → 2.x），不背向后兼容包袱，但以现有系统为基底、复用优先、最小新增。**
产品形态从「Agent Recipes 驱动的扁平 Markdown 库」转向「Local-First 结构化知识 IDE」，以**固定三层【节点】拓扑 + 多模板 schema** 为新地基（工程层 ADR-0011）。**实现原则：凡能复用现有实现的一律复用、不新建平行功能**——典型如版本/diff 直接用现有 git（autoGit 不改，ADR-0015）。

---

## 1. 必须强制消歧的双关词（禁裸用）

> 以下词在本仓库**一词双关**，任何产出（文档 / 注释 / commit / 对话）出现时**必须显式限定**是哪一种，**禁止裸用**。

### 「三层」→ 现已重构为四层

| 限定写法 | 含义 | 范围 |
|---|---|---|
| **【代码】分层（四层）** | `frontend(React UI 纯渲染) → bridge(前后端契约边界) → backend(ipc→service→{domain,capability}) + shared(model/contract/ipc/utils)`，单向依赖、`preload/` contextBridge `window.eidon` 唯一 frontend↔backend 接缝、ESLint 机器强制。**已由 Tauri 2(Rust) 迁移至 Electron(全 TypeScript) 并重构为四层，见 ADR-0024/0025。** | 工程架构（AGENTS.md §2.1 / 工程层 ADR-0024/0025）。 |
| **【节点】三层** | `L1 / L2 / L3`，数据节点层级，深度=层级铁律，第 4 层起为自由文件夹（无身份） | 产品数据层（产品层 ADR-002 / 工程层 ADR-0013）。**本期要造的新地基。** |

### 「workspace」

| 语境 | 含义 |
|---|---|
| 现状 SoloMD（被重构） | 任意扁平文件夹路径（Obsidian 式），系统区为 `.solomd/` |
| 本期 EIDON | EIDON 受管根，系统区 = `.eidon/`（templates + 节点系统 + 索引缓存）。**不背兼容包袱**，无需双系统区共存逻辑（工程层 ADR-0017） |

### 「AutoGit / 快照」

| 语境 | 含义 |
|---|---|
| 版本 / 时光机（EIDON 用） | 普通编辑的版本历史 = 现有 git 的 auto-commit + `history.commitNow` + HistoryPanel（`backend/capabilities/git/`）。**autoGit 无需修改、不另做快照功能，diff/恢复直接用 git**；`backend/domain/snapshots` 仅薄封装现有 git bridge（工程层 ADR-0015） |
| Agent Recipes 分支沙箱（旧产品，不在范围） | LLM 任务的分支沙箱 `agent/<slug>/<run-id>`，属旧 SoloMD，不在 EIDON 范围（ADR-0018） |
| 私有快照仓库 | `.eidon/snapshots.git` 等「另造快照系统」**本期不做**，未来有需要再独立立项（ADR-0015） |

### 「Agent / AGENTS.md」

| 语境 | 含义 |
|---|---|
| 仓库根 `AGENTS.md` | 面向 AI 与人类开发者的**权威工程指南** |
| 节点内 `AGENTS.md` | 节点目录里给「后续 AI」读的**占位文件**（产品层 ADR-008），本期仅占位生成 |
| Agent Recipes | 旧 SoloMD 的 LLM 自动化系统，**不在 EIDON 范围内**（代码作基底保留，工程层 ADR-0018） |

### 产品名

`solomd`（旧包名 / 旧品牌）→ `EIDON`（目标产品 / 仓库名）。改名（packageName / 窗口标题 / about / i18n）+ 系统区 `.solomd/`→`.eidon/`，**本期纳入**（工程层 ADR-0017，取代早期「改名延后」）。

---

## 2. 数据层核心术语（三层【节点】+ 多模板）

- **L1 / L2 / L3 节点**：EIDON 固定三层【节点】结构节点。**深度=层级铁律**：workspace 根下第 1/2/3 层**节点**目录 = L1/L2/L3，第 4 层起为自由文件夹（无身份）。
- **节点 vs 普通文件夹**：含 `.node/` 子目录者为**结构节点**；不含者为**普通文件夹**（产品层 ADR-004）。两者本期共存。
- **`.node/node.json`**：节点自包含身份与元数据（id/templateId/level/type/schemaVersion/fields/references/flags），随目录移动。形状纳入契约防漂移（工程层 ADR-0014）。
- **元字段（meta schema）/ 扩展字段（ext schema）**：
  - **元字段** = 任何节点必有的身份骨架（id/templateId/level/type/schemaVersion/createdAt/flags），与模板无关、初始化即生成、**用户不可增删**。
  - **扩展字段** = 模板定义的业务字段，**各模板可自行扩展**（本期限 6 类型：text/textarea/number/date/select/boolean）。
- **模板（template）/ schema 规范**：三层【节点】各自的名字 + 字段集，捆绑为一体，**版本化不可变**，存 `.eidon/templates/{id}/L{n}.{name}.v{ver}.json`（产品层 ADR-005/010）。**整体 L1/L2/L3 的 schema 规范在「设置」内创建新建与管理**（模板管理 UI 落在 Settings 面板）。
- **模板版本化 + 懒迁移**：编辑模板生成新版本（旧版不改）；旧节点保持旧 `schemaVersion` 合法存在，仅显式批量升级才迁移。
- **内置模板**：档案 / 项目 / 资料，仅首次初始化写入的普通文件，之后与用户模板完全平级（可编辑/删除，无只读种子）。
- **Containment vs Reference**：物理目录嵌套（单父树，深度≤3）vs 逻辑引用（多对多锚 nodeId）。本期只预留 `references:[]` 字段，**不做链接 UI**（产品层 ADR-006）。
- **ULID 身份**：节点硬 ID，复用 `shared/utils/id`，与路径无关、随目录走、可遍历重建。
- **可重建铁律（AX-1/AX-4）**：删 `.eidon/` 索引缓存后，遍历 `.node/` + `.eidon/templates/` 可 100% 重建节点树/身份/字段/id→path。

---

## 3. `backend/domain/` 数据层四模块（工程层 ADR-0012）

> EIDON 数据层按**细模块切分**落在 `backend/domain/`（原 `core/` → `shared/domain/`，2026-06 随 Tauri→Electron 迁移见 ADR-0024；再经四层重构 → `backend/domain/` 见 ADR-0025），为可扩展性 + 可读性新增**四个**并列业务模块。各自 `index.ts`、禁 UI 框架、不互 import 内部。类型定义在 `shared/models/`，契约在 `shared/contracts/`。

| 模块 | 本期职责 | 后续深化 |
|---|---|---|
| **`backend/domain/nodes`** | ULID 身份 / node.json 读写 / 扫描建树（深度=层级 + id→path）/ 创建·重命名·移动·提升为节点 | — |
| **`backend/domain/templates`** | 6 类字段 schema 版本化 / 编辑生成新版 / 删除孤儿模板态 / 内置种子 / 给设置内模板管理 UI 供数据 | 跨模板字段复用 |
| **`backend/domain/snapshots`** | 版本能力归属：**直接复用现有 git（autoGit 不改、不做快照功能）**，仅薄封装 git bridge（ADR-0015） | 如未来确需再另立 |
| **`backend/domain/consistency`** | 结构违规**检测 + 标记**（四类，ADR-0016） | 软态身份系统 / 自动补全 / 一致性面板 |

---

## 4. 本期收紧专有术语（结构强制，工程层 ADR-0016）

- **创建期硬强制（零妥协）**：通过 EIDON 只能按 `根→L1(选模板) / L1下→L2 / L2下→L3 / L3下→自由` 创建；UI **不存在**越级创建入口；L1/L2 纯组织层（无内容文件）、L3 唯一内容承载层，硬约束。
- **结构违规标记（FileTree 标记）**：`backend/domain/consistency` 扫描检测到不符合结构的东西（外部产生/历史扁平库），**只在 FileTree 打徽标**、不自动处理、无独立面板。四类：①前三层普通文件夹「待提升」②L1/L2 内容文件「位置非法/待下沉」③节点深度与 level 不符「层级不符」④`.node/` 缺失「结构待修复」。
- **提升为节点**：把普通文件夹按其当前物理深度提升为对应层级节点（根→L1 选模板 / L1下→L2 / L2下→L3 继承父链），生成新 ULID + `.node/`。**整改主入口**，用户点击触发，系统不自动动。

---

## 5. 不在范围 / 后续迭代术语（本期不实现，仅占位/预留）

> 出现这些词时须标注「不在 EIDON 范围 / 后续迭代 / 不在本期」，避免误读为已交付。

- **AI·Agent·Recipes（不在 EIDON 范围）**：旧 SoloMD 的整块 AI 自动化，EIDON 不挂载、不依赖；现有代码作基底保留，未来若做 AI 是一次独立重建（工程层 ADR-0018）。
- **一致性软态体系（后续）**：越界 `flags.outOfPlace` / 孤儿 `flags.orphan` / 孤儿模板 `flags.orphanTemplate` / 失联 disconnected + 独立一致性面板 + 自动补全 + 自动整理开关 +「其他」L3 兜底节点。本期 `backend/domain/consistency` 只做检测+标记。
- **回收站三关（后续）**：`.eidon/trash` 物理移入 + 路径冲突改名 / schemaVersion 懒迁移 / reference 自动重连。本期复用现有 FileTree 直接删除。
- **私有快照仓库（如未来需要）**：`.eidon/snapshots.git` + 保存/快照解耦 + 路径↔ID 补偿——属「另造快照系统」，本期不做；版本/diff 直接用现有 git（ADR-0015）。
- **第二步 AI / Todo / 链接（后续）**：AI 对话 / AI Memory / Todo 抽取 / 提醒 / 双向链接 `[[]]` / 块引用 / 反向链接 / 文件内选区锚点 / 语义检索。数据模型已为其预留（`references` 字段、`AGENTS.md` 占位）。

> **「超前实现」边界（工程层 ADR-0011/0018）：** 除 AI·Agent·Recipes 整块外，已存在且对结构化知识 IDE 有价值的能力（编辑器、搜索、版本、backlink/daily-notes 等）**可保留并超前实现**，不为分期人为隐藏。

---

## 6. 双轨 ADR 体系（引用须标来源）

- **工程层 ADR** = `speculo/.speculo/.config/adr/ADR-0005~0025`（见该目录 `README.md` 登记表）。约束代码架构与 EIDON 2.0 数据层落点。引用写 `工程层 ADR-00XX`。
  - 工程基座：0005/0010；EIDON 2.0 数据层：0011~0019；节点功能：0020~0023；平台迁移：0024/0025。（旧 AI 子系统 ADR 0002/0003/0004/0008、Tauri/Rust 实现前提 ADR 0001/0009 已删除；0006/0007 已被 0024/0025 取代。编号留空不复用。）
- **产品层 ADR** = `temp/EIDON_数据层架构决策记录_ADR.md` 的十三块基石 `ADR-001~013` + 五公理 `AX-1~5`，产品**愿景源**。本期只兑现「三层【节点】拓扑 + 多模板 schema」子集。引用写 `产品层 ADR-00X` / `AX-n`。
- 两套并存、不冲突；**引用时必须标注来源轨道**，避免编号混淆（如「产品层 ADR-002」vs「工程层 ADR-0012」）。
