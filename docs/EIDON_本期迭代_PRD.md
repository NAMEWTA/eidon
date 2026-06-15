# EIDON 本期迭代 产品需求文档（PRD）

**产品：** 由 SoloMD **颠覆性重构（1.x → 2.x）**而来的 EIDON —— Local-First Structured Knowledge IDE
**本期范围：** 给现有「扁平 Markdown 库」装上**固定三层【节点】拓扑 + 多模板 schema**这层**新地基**，使文件树从「认识文件夹」升级为「认识 L1/L2/L3 节点」；同步完成 **solomd→EIDON 改名**、**磁盘契约统一规范化**。AI·Agent·Recipes **不在本期范围**。
**重构定位（D-1，工程层 ADR-0011）：** EIDON 是基于 SoloMD 的一次**完整产品迭代重构升级——本质 1.x→2.x 跨越**：**不背向后兼容/用户兼容包袱**，但**以现有系统为基底、复用优先、最小新增**（凡能复用现有实现的一律复用、不新建平行功能；典型如版本/diff 直接用现有 git）。颠覆的是产品形态与数据模型，**不是**三层【代码】工程架构（复用不动）。
**文档高度（D-7）：** 本期**可交付的完整产品体验**——既写本期新建的能力（节点 + 模板 + 一致性检测），也写本期直接**复用现有**的能力（编辑 / 保存 / 版本 / 搜索），并把不在本期的能力明确标注为**后续迭代**或**不在范围**。
**依据：** `temp/` 三份 EIDON 规划文档（产品层数据层 ADR 十三块基石 / 基座 PRD / 用户故事旅程）为**产品层愿景源**；`speculo/.speculo/dev/eidon-base-roadmap/`（roadmap + decision-log）为**本期决策源**；`AGENTS.md` + 工程层 ADR-0001~0018（见 `.config/adr/README.md`）为**机器强制的工程约束源**。三者冲突时：工程约束 > 本期决策 > 产品愿景。
**技术栈：** Tauri 2 + React 19 + TypeScript（`core/`）+ Rust（能力壳）。
**版本：** EIDON 2.0 本期迭代（节点 + 模板内核 + 改名 + 契约统一）
**日期：** 2026-06-06

---

## 0. 产品定位与边界

### 0.0 「三层」全文消歧（强制，禁裸用）

本文出现「三层」必显式限定其一，绝不裸用：

- **三层【代码】** = `src(React UI) → core(TS 业务核心) → src-tauri(Rust 能力壳)`，软件分层，单向依赖、`core/bridge/` 唯一 Tauri 出口、ESLint 机器强制（AGENTS.md §2.1）。**本期不动其架构。**
- **三层【节点】** = `L1 / L2 / L3`，数据节点层级，深度=层级铁律，第 4 层起为自由文件夹（无身份）。**本期要造的就是它。**

类似双关项一并消歧：**workspace**（本期 = 含 `.eidon/` 节点系统的受管根，但与现有扁平文件夹共存）；**AutoGit / 快照**（本期复用的「版本历史」≠ Agent Recipes 的分支沙箱）；**AGENTS.md**（节点内给「后续 AI」读的占位文件 ≠ 仓库根的开发指南 `AGENTS.md`）。

### 0.1 定位

把现有 SoloMD（local-first Markdown 桌面应用，原核心特性 Agent Recipes）**颠覆性重构**为：**单人、完全本地离线、数据可见可迁移不锁定的结构化知识工作台**。一个用户在多个并列领域工作（科研 / 工程 / 软件开发 / 知识分享）。本期交付其「结构化」新地基——节点拓扑 + 多模板，**以现有系统为基底、收编复用**现有成熟能力（编辑/版本/搜索/文件树）；AI·Agent·Recipes **不在 EIDON 范围**（旧代码作基底保留，后续独立重建）。「重构 ≠ 推倒重写」：地基是新的，绝大部分既有能力被复用并收编，而非重造（工程层 ADR-0011）。

### 0.2 唯一角色

本地 workspace 主人 / 操作者。EIDON 是单人本地工具，**不存在多用户、权限、协作、ACL、审计授权机制**。任何「防自己改乱」「防他人误操作」的预设均与定位冲突，直接否决。后续任何验收 / 数据模型 / 界面均不引入 user/owner/permission 字段。

### 0.3 五条理念（约束一切设计）

File System First / Markdown Native / Schema Driven / AI Native（**不在本期范围，后续独立重建**）/ Local First。

### 0.4 本期范围三分（核心边界）

> 工程落点见 §12；`core/` 按工程层 ADR-0012 新增**四个细模块** `nodes`/`templates`/`snapshots`/`consistency`。

| 类别 | 内容 |
|---|---|
| **① 本期必造（IN）** | `.eidon/templates/` 多模板版本化 schema（6 类字段，**在设置内创建管理**）· 节点 `.node/node.json`（id/templateId/level/type/schemaVersion/fields）· **创建期硬强制** depth=层级 · L1/L2 纯组织层 / L3 唯一内容层硬约束 · 打开扫描建节点树（id→path）· 节点 CRUD（创建 / 重命名 ID 不变 / 移动）· **提升为节点** · 节点字段表单 · 模板管理 UI（设置内）· **节点感知 FileTree + 违规标记（`core/consistency` 检测）** · 删缓存可 100% 从文件重建节点树 · **solomd→EIDON 改名 + `.solomd`→`.eidon` 系统区** · **磁盘契约统一纳入 zod+fixtures** |
| **② 本期复用现有（REUSE，收编进新地基）** | Markdown 编辑 / 预览 / 大纲 → 现有 CodeMirror 栈 · 失焦自动保存 → 现有 `autoSaveDirtyTabs` · 版本 / diff → **直接用现有 git**（auto-commit + `history.commitNow` + HistoryPanel；**autoGit 不改、不做快照功能**，`core/snapshots` 仅薄封装）· 外部修改刷新 → 现有 watcher · 全文搜索 → 现有 `GlobalSearch` · 删除 → 现有 FileTree 删除 · **已存在且有价值的能力（backlink/daily-notes 等）可保留并超前实现**（不为分期人为隐藏） |
| **③ 本期不做（OUT，后续迭代 / 不在范围）** | `.eidon/snapshots.git` 等「另造快照系统」（**用现有 git 即可**）· 保存/快照彻底解耦 · 路径↔ID 历史补偿 · 越界 `outOfPlace` / 孤儿 `orphan` / 失联 disconnected **软态身份系统** · 杂物**自动整理** · **自动补全**缺失系统文件 · 独立一致性面板 · 回收站三关恢复（`.eidon/trash`）· 用户层链接 `[[]]` / 块引用 / 反向链接（除非已存在可超前）· 语义 / 向量搜索 · **AI·Agent·Recipes 整块不在 EIDON 范围**（ai/agent/recipes/RAG/capture/REST/github-sync/cloud/MCP，旧代码作基底保留、不挂载、不依赖，工程层 ADR-0018） |
| **零成本前向兼容（保留不实现）** | `node.json` 的 `references:[]`、`flags:{}`、节点内 `AGENTS.md` 占位 —— 为后续迭代预留，本期不读不写业务逻辑 |

### 0.5 本期与原 EIDON 愿景的关键差异（诚实声明）

| 维度 | 原 EIDON 愿景（temp/ 产品层 ADR） | 本期决策 | 依据 |
|---|---|---|---|
| 前三层不允许普通文件夹 | 靠**自动补全 + 杂物检测**兜底 | **创建硬强制** + 违规**只在 FileTree 标记**（`core/consistency`），不自动补全、不自动移动 | 工程层 ADR-0013/0016 |
| 杂物 / 越界 / 孤儿 / 失联 | 五类软态 + 一致性面板 + 三关 | 本期 `core/consistency` 只**检测「结构违规」并标记**，**无独立面板、无软态身份系统** | 工程层 ADR-0016 |
| 整改 | 整理按钮 / 转换 type / 自动整理开关 | **提升为节点 + 手动移动 / 删除**（用户点击触发） | 工程层 ADR-0016 |
| 版本 / diff | 私有 `.eidon/snapshots.git` | **直接用现有 git（autoGit 不改、不做快照功能）**，`core/snapshots` 仅薄封装 | 工程层 ADR-0015 |
| 删除 | `.eidon/trash` + 三关恢复 | **复用现有 FileTree 删除**（当前为直接删除，无回收站） | 工程层 ADR-0016 |
| 数据层落点 | 未约束（产品层愿景不谈代码结构） | **`core/` 四细模块** nodes/templates/snapshots/consistency，复用三层【代码】架构 | 工程层 ADR-0012 |
| 品牌 / 系统区 | EIDON / `.eidon/` | **本期改名** solomd→EIDON + `.solomd`→`.eidon` | 工程层 ADR-0017 |
| AI Native | 第一步排除、第二步实现 | **不在 EIDON 范围**（旧代码作基底保留、不挂载、后续独立重建） | 工程层 ADR-0018 |

---

## 1. 核心数据模型（FR-DATA，源自 ADR-001~006）

### FR-DATA-1　真理源与可重建
- 真理源 = plain files。Markdown + JSON（`node.json` / template schema）= 当前状态真理源；SQLite / 索引 = 可删可重建的运行时缓存。
- **验收：** 删除 `.eidon/` 下的索引缓存后重启，遍历目录（识别 `.node/` → 读 `node.json` → 读 `.eidon/templates/`）可 **100% 重建**结构树、节点身份、字段、id→path 映射，无业务数据丢失。

### FR-DATA-2　结构 = 固定三层【节点】+ 多模板
- 结构节点深度固定 3 层。**深度=层级铁律：** workspace 下第 1/2/3 层**节点**目录 = L1/L2/L3，第 4 层起为自由文件夹/文件。
- 同一 workspace 可并列多套三层【节点】模板，每套自定义三层各自的名字与字段集。
- **本期共存约束：** 节点系统**叠加**在现有扁平结构之上——含 `.node/` 子目录者为节点，不含者为普通文件夹。两者靠 `.node/` 区分（FR-TREE 视觉区分）。**创建期硬强制**保证「通过 EIDON 新建的目录」必然落在正确层级（见 FR-NODE-1 / FR-MARK）。
- **验收：** 通过 EIDON 在根创建的节点必为 L1；L1 节点下创建的必为 L2；L2 节点下创建的必为 L3；L3 节点下创建的目录为自由文件夹（无身份）。UI **不提供**任何越级创建入口。

### FR-DATA-3　节点身份（ULID + 三级寻址）
- 结构节点持稳定硬 ID（ULID，复用 `core/shared/id`），存于 `.node/node.json`，随目录移动。
- 三级寻址：节点 = 硬 ID；叶子文件 = `(节点ID + 相对路径)`；文件内位置 = text-hash best-effort（**本期不实现**，预留）。
- **验收：** 移动 / 重命名节点目录后，其 ID 不变，id→path 索引可重建。

### FR-DATA-4　磁盘布局（自包含节点目录 + `.node/`）
- 节点目录自包含，系统元数据在隐藏 `.node/`（含 `node.json`）。
- **文件白名单（硬约束）：**
  - **L1 / L2（纯组织层）**：仅 `.node/` + `README.md` + `AGENTS.md` + 下级节点目录。**无内容文件。**
  - **L3（内容承载层）**：`.node/` + `README.md` + `AGENTS.md` + 任意内容文件（.md/PDF/图片…）+ 第 4 层起自由子目录/文件。
- `README.md` = 人类描述（用户填）；`AGENTS.md` = 后续 AI 占位（本期仅占位生成，不展示编辑入口或仅占位）。
- **验收：** 文件树隐藏 `.node/`；节点目录与普通文件夹视觉可区分。

### FR-DATA-5　元 schema / 扩展 schema
- **元 schema**（id/templateId/level/type/schemaVersion/createdAt/flags）：创建即生成，与 template 无关——节点的身份骨架。
- **扩展 schema**（业务字段）：由所属 template 版本定义，本期限 6 种类型（FR-TPL-1）。
- **验收：** 即使 template 被删，节点凭元 schema 仍合法存在（孤儿模板态，FR-TPL-2）。

### FR-DATA-6　Containment 与 Reference
- Containment（包含）= 物理目录嵌套 = 严格单父树（深度 ≤ 3）。
- Reference（引用）= 逻辑关联：**本期不实现任何用户可见链接 UI**，仅在 `node.json` 保留 `references:[]` 字段（可为空）保证模型不与后续冲突。

### FR-DATA-7　磁盘契约统一规范化（呼应工程层 ADR-0005/0014）
- **统一纳入**：`node.json` + template schema + `.eidon/` 系统区布局形状一律纳入 `core/contracts/`（zod，单一事实源）+ `fixtures/contracts/` 跨语言 golden fixtures，与既有 trace/meta/recipe 同一套防漂移体系（不另起炉灶）。
- **改形状先改 zod + fixtures，再改解析。** fixtures 红即代表破坏「删缓存→从 `.node/`+`.eidon/templates/` 100% 重建节点树」一致性。
- node.json 的 `references:[]` / `flags:{}` 契约层先定形状（本期空值），为后续迭代零成本衔接。

---

## 2. Workspace（FR-WS）

### FR-WS-1　选择与懒初始化
- 用户选择本地文件夹作为 workspace（**复用现有打开流程**）。
- **节点系统懒初始化：** 当用户**首次使用**节点 / 模板功能时，创建 `.eidon/` 骨架（`templates/` + 运行时索引缓存），并写入内置默认模板（档案 / 项目 / 资料）作为普通文件。
  - 纯扁平 Markdown 使用方式**不触碰** `.eidon/`，对现有用户零破坏。
  - 内置模板仅在 `.eidon/` **首次创建那一刻**写入一次；此后无论用户删成什么样，**绝不自动重写**。
- 旧 `.solomd/`（Agent Recipes 区）属旧产品遗留、**不在 EIDON 范围**（工程层 ADR-0017/0018），本期不读写、不迁移；EIDON 数据层一律落 `.eidon/`。因 D-1 不背兼容包袱，无需双系统区共存逻辑——`.solomd/` 静置不动。
- **验收：** 同一 workspace 二次打开不重复初始化；用户删除内置模板后重开，系统不自动重新写入。

### FR-WS-2　打开即扫描建树 + 违规标记
- 打开 / 切换 workspace 即触发**只读**全量/增量扫描：遍历目录 → 识别 `.node/` → 按**深度=层级**判定 L1/L2/L3 → 建节点树 + id→path 索引。
- 扫描同时检测**结构违规**并在 FileTree 打标记（FR-MARK）。
- **严守：** 扫描只读；**本期不自动补全、不自动移动、不自动改写任何用户文件**（与原 EIDON 的 AX-5 自动补全例外不同——本期把它降级为「只标记」）。
- **验收：** 外部在根新建一个普通文件夹后重开，系统**不**自动补 `.node/`，而是在 FileTree 标记为「待处理 / 非节点」，由用户决定是否「提升为节点」。

### FR-WS-3　多 workspace
- 复用现有多 workspace 打开 / 切换能力；切换触发目标 workspace 的扫描（FR-WS-2）。

---

## 3. 模板管理（FR-TPL，源自产品层 ADR-005 / 010）

> **整体 L1/L2/L3 的 schema 规范在「设置」内创建新建与管理。** 模板管理 UI（`TemplateManager`）落在 Settings 面板，承载创建 / 编辑 / 删除 / 版本管理；数据由 `core/templates` 提供。

### FR-TPL-1　模板定义
- 模板 = 三层【节点】（L1/L2/L3）各自的名字 + 字段集，捆绑为一体。
- **创建入口 = 设置面板**：在「设置 → 模板 / Schema」内**新建**一套模板，依次定义 L1/L2/L3 三层的名字与字段集。
- 字段类型**仅 6 种**：`text` `textarea` `number` `date` `select` `boolean`。（relation/currency/multi_select/person/tags/rating 推迟到后续）
- 模板定义存 `.eidon/templates/{templateId}/L{n}.{name}.v{ver}.json`，**版本化不可变**，形状纳入磁盘契约（FR-DATA-7）。

### FR-TPL-2　模板的创建 / 编辑 / 删除
- **创建：** 定义三层名字 + 各层字段。
- **编辑：** 允许编辑已被使用的模板 → 生成新版本文件（旧版不改）。**UI 必须诚实告知**：「改动只对新建节点生效；已有 N 个节点保持旧版，可一键批量升级。」
- **批量升级：** 用户显式发起、可中断可续跑（懒迁移）。
- **删除：** 内置与用户模板平级均可删。删除已被使用的模板 → 相关节点变「孤儿模板节点」（`flags.orphanTemplate=true`、合法存在、字段裸键值展示、**不删值**）。
- **验收：** 编辑模板后老节点字段不变、新节点用新字段；删除模板后相关节点仍可打开、字段值保留。

### FR-TPL-3　内置模板
- 内置默认模板（档案 / 项目 / 资料）仅作首次初始化写入的普通文件，之后与用户模板完全平级（可编辑 / 可删除，无硬编码、无只读）。
- **字段构成原则（已确认，O-3 关闭）：** 每个节点 = **元字段（固定）** ＋ **扩展字段（各模板自行扩展）**。
  - **元字段** = 任何节点必有的身份骨架（`id`/`templateId`/`level`/`type`/`schemaVersion`/`createdAt`/`flags`，见 FR-DATA-5）：与模板无关、初始化即生成、**用户不可增删**。
  - **扩展字段** = 模板定义的业务字段：**各模板可自行扩展**（增 / 改字段即生成新版本，旧节点不变，FR-TPL-2）。下表是内置模板的**开箱默认扩展字段**，用户可在其上继续扩展。
- **内置默认扩展字段集（已确认保留）：**

| 模板 | L1 | L2 | L3 | 字段提案（示意） |
|---|---|---|---|---|
| **档案** | 档案库 | 案卷 | 文件 | L2：`分类(select)` `日期(date)` `状态(select:在办/归档)`；L3：`摘要(textarea)` `来源(text)` |
| **项目** | 项目集 | 项目 | 资料 | L2：`负责人(text)` `进度(select)` `截止(date)` `预算(number)`；L3：`类型(select)` `备注(textarea)` |
| **资料** | 资料库 | 主题 | 条目 | L2：`领域(text)` `重要度(select)`；L3：`标签(text)` `已读(boolean)` |

用户领域示例（可自建，非内置）：科研 `研究方向→课题→资料`、开发 `产品线→特性→任务`。

---

## 4. 节点操作（FR-NODE，源自 ADR-002 / 003 / 004 / 010）

### FR-NODE-1　创建节点（硬强制 depth=层级，零妥协）
- 在合法父级下创建子节点：**L1 在 workspace 根、L2 在 L1 节点下、L3 在 L2 节点下**。UI 按当前所选位置只暴露合法的「新建节点」入口，**不存在**越级创建路径。
- 创建时选模板（**仅 L1 需选**；L2/L3 继承父链所属模板），按该模板该层 schema 填字段。
- 生成 `.node/node.json`（元 + 扩展 schema）+ 空 `README.md` / `AGENTS.md`。
- 绑定锁死：节点创建后归属模板固定，不提供「换模板」。
- **L3 唯一可放内容文件：** 「新建 Markdown / 内容文件」入口**只在 L3 及其下自由文件夹**出现；L1/L2 不提供。
- **验收：** 在根「新建」只给「新建 L1 节点（选模板）」；在 L1 节点内「新建」只给「新建 L2 节点」；在 L2 节点内只给「新建 L3 节点」；在 L3 内可建内容文件与自由子文件夹。

### FR-NODE-2　重命名 / 移动
- **重命名** = 改目录名（人类标题），ID 不变，id→path 更新。
- **移动** = 改父级（含跨模板移动，允许领域交叉）。
- **本期不做越界软态系统**：移动后若产生「深度与 `level` 不符」「跨模板位置不当」，**不**写 `flags.outOfPlace`、**不**进一致性面板，而是在 FileTree 打「结构违规」标记（FR-MARK），由用户手动整改。节点 `node.json`（type/字段）原样不动。
- **验收：** 跨模板移动成功、节点字段不变；若造成深度/层级不符，FileTree 出现违规标记。

### FR-NODE-3　提升为节点（整改主入口，D-9）
- 对普通文件夹提供「**提升为节点**」：按其**当前物理深度**提升为对应层级节点——根下 → L1（选模板）、L1 节点下 → L2、L2 节点下 → L3（继承父链模板）。
- 生成 `.node/node.json`（新 ULID + 元 schema + 父链模板对应层扩展 schema 框架，值由用户补）+ 空 README/AGENTS。
- 仅对**合法深度（≤3）**的普通文件夹提供；第 4 层起的自由文件夹不提供（它们本就无需身份）。
- **系统不自动提升**，落下「提升键」的必须是用户。
- **验收：** 把现有扁平库根下的一个普通文件夹「提升为节点」→ 成为带 `.node/` 的 L1 节点，其内已有子文件夹可继续逐层提升为 L2/L3。

### FR-NODE-4　填写字段
- 节点字段按其 `schemaVersion` 对应的扩展 schema 渲染表单（6 种类型控件），保存写入 `node.json` 的 `fields`。
- 读取字段须先判节点 `schemaVersion`（多版本共存）。

---

## 5. 结构强制与 FileTree 标记（FR-MARK，本期新增，替代 temp/ FR-CLEAN/FR-SYNC 重系统）

> 本节是 D-8 对 temp/ 「杂物 / 越界 / 一致性面板」体系的**收紧替代**：保留「硬强制创建 + 检测并标记」，砍掉「自动补全 / 自动整理 / 独立面板 / 软态身份系统」。

### FR-MARK-1　创建期硬强制
- 见 FR-NODE-1：UI 不给越级创建口子；L1/L2 不让放内容文件；新建内容文件仅 L3。这是**第一道防线**，保证「EIDON 内产生的结构」永远合规。

### FR-MARK-2　检测期标记（只检测、只标记，不自动改）
- 打开 / 扫描时检测以下**结构违规**并在 FileTree 对应条目打醒目徽标：
  1. **前三层出现普通文件夹**（应为节点却无 `.node/`，多来自外部新建或历史扁平库）→ 标记「待提升 / 非节点」。
  2. **L1 / L2 出现内容文件**（违反白名单的纯组织层约束）→ 标记「位置非法 / 待下沉」。
  3. **节点物理深度与其 `level` 不符**（外部移动造成）→ 标记「层级不符」。
  4. **节点 `.node/` 缺失或损坏**（外部误删）→ 标记「结构待修复」。
- 标记**只读、不阻塞使用、不自动处理**。点击徽标弹出该违规对应的整改操作入口。

### FR-MARK-3　整改（用户点击触发，系统不自动动）
- **前三层普通文件夹** → 「提升为节点」（FR-NODE-3）或用户自行移动/删除。
- **L1/L2 内容文件** → 引导「移动 / 下沉到某个 L3 节点」或用户自行删除。
- **层级不符 / 结构待修复** → 引导用户手动移回合法位置 / 重建 `.node/`（重建即新 ULID，旧引用断裂可接受——本期无 reference UI，无实质影响）。
- **共通约束：** 全部操作需用户确认，系统**绝不**自动改写、自动移动、自动新建承载用户文件的节点。
- **验收：** L2 目录里放 `笔记.md` → FileTree 标记「位置非法」、不点击则不动；点击「下沉到 L3」选择目标后才移动。

### FR-MARK-4　本期明确不做（后续迭代）
- 自动补全缺失系统文件、自动整理杂物（含「自动整理」开关）、独立一致性面板、`outOfPlace/orphan/orphanTemplate/disconnected` 软态身份系统、失联自动复活、回收站三关。本节只做「硬强制 + 标记 + 手动整改」。

---

## 6. 编辑器（FR-EDIT，复用现有，标注）

### FR-EDIT-1　Markdown 编辑
- **复用现有** CodeMirror 编辑器 / Preview 预览 / Outline 大纲 / 语法高亮 / 全文搜索替换。
- 内容文件编辑入口**仅在 L3 及其自由子文件夹**（白名单约束，FR-NODE-1）。
- 大文件分级降级（≤2MB 全功能 / 2–10MB 基础 / >10MB 只读）：若现有编辑器已具备则复用；**若现有未具备，标注为后续工程调优，不在本期硬性承诺**。

### FR-EDIT-2　内容外部修改实时刷新
- **复用现有** watcher：当前打开文件被外部修改 → 实时刷新（含未保存冲突提示，以现有实现为准）。

### FR-EDIT-3　其他文件类型
- L3 的非 Markdown 文件（PDF/图片等）：**复用现有**基础预览 / 调用系统默认程序打开能力（不编辑）。

---

## 7. 保存与版本（FR-VER，复用现有，标注）

### FR-VER-1　自动保存（防丢）
- **复用现有** 失焦自动保存（`autoSaveDirtyTabs()` on window blur，受 `autoSaveOnBlur` 设置控制）。

### FR-VER-2　版本 / diff（直接用现有 git，autoGit 不改，工程层 ADR-0015）
- **以现有系统为基底：版本 / diff 对比 / 恢复直接用现有 git** 的 log/diff/checkout（auto-commit 历史 + `history.commitNow` + HistoryPanel，`git_history.rs`）。**autoGit 无需任何修改，本期不实现任何「快照功能」。**
- `core/snapshots` 仅薄封装现有 git bridge（不新增逻辑）。
- **本期不做：** `.eidon/snapshots.git` 私有仓库、保存/快照解耦、二进制策略、路径↔ID 历史补偿——这些属「另造快照系统」，与「复用优先」相悖；未来确有硬需求再独立立项。
- **消歧：** 此「git 版本」= 普通编辑的 auto-commit 历史，**不是** Agent Recipes 的 AutoGit 分支沙箱（不在 EIDON 范围）。

### FR-VER-3　历史 / diff / 恢复
- **复用现有** HistoryPanel：浏览版本、diff 对比、恢复某版本（恢复语义以现有实现为准）。

---

## 8. 删除（FR-DEL，复用现有，缩水标注）

- **复用现有** FileTree 删除。删除节点 = 删除整个节点目录（含 `.node/`、子树、内容文件）。
- **当前现状：** 现有删除为直接删除，**无回收站**。本期如实呈现这一点。
- **标注后续迭代：** `.eidon/trash` 物理移入 + 三关恢复（路径冲突改名 / orphan 兜底 / schemaVersion 懒迁移 / reference 自动重连）。

---

## 9. 搜索（FR-SEARCH，复用现有 + 可选结构过滤）

- **复用现有** `GlobalSearch` 全文搜索（内容）。
- **可选增强（本期可做可不做）：** 在现有搜索上叠加「按节点标题 / 模板 / 层级 / 字段值」的结构过滤。
- **标注后续迭代：** 语义 / 向量检索（属第二步 AI）。
- 索引缺失时降级提示（复用现有索引重建能力）。

---

## 10. 文件树与导航（FR-TREE，源自 ADR-004）

- 文件树反映真实文件系统；隐藏 `.node/` 等系统元数据。
- **视觉区分（本期新增）：**
  1. **节点目录**：带模板 / 层级图标（L1/L2/L3 各异）+ 字段徽标。
  2. **普通文件夹**：朴素图标。
  3. **结构违规态**（FR-MARK-2 四类）：醒目徽标 / 颜色标记；点击跳到整改入口。
- 第 4 层起自由文件夹 / 文件正常展示，不带节点语义。
- **改造要点：** 现有 `FileTree.tsx` 由「把目录当普通 `{name,path,is_dir}` 树」升级为**节点感知**（区分节点 / 普通文件夹、读 `node.json` 取层级与字段、隐藏 `.node/`、渲染违规标记）。

---

## 11. 非功能需求（NFR）

| 编号 | 要求 |
|---|---|
| NFR-1 | 万级文件 workspace 可用；打开扫描可增量、后台、不长时间阻塞（先 Core(TS) 经现有 file bridge 完成；性能不足时再按工程 ADR-0009 加最小 `scan` 原子命令） |
| NFR-2 | 自动保存防丢：复用现有失焦保存，异常退出最多丢失最近一次保存间隔内的编辑 |
| NFR-3 | 完全离线可用，无任何联网依赖（联网能力随 AI·Agent·Recipes 不在 EIDON 范围，工程层 ADR-0018） |
| NFR-4 | 数据可迁移：拷贝 workspace 目录到另一台机器，模板 / `node.json` / 内容完整自包含（git 历史属本机缓存除外） |
| NFR-5 | 跨平台：Windows / macOS / Linux（Tauri 2） |
| NFR-6 | **可重建铁律：** 删 `.eidon/` 索引缓存后遍历 `.node/` + `.eidon/templates/` 100% 重建节点树（AX-1/AX-4，每阶段末回归） |

---

## 12. 工程落点与约束（呼应 AGENTS.md / 工程层 ADR-0006/0009/0012/0014/0017/0018）

> 本期**复用三层【代码】架构**，按既定扩展方式新增**四个细模块**（可扩展性 + 可读性，工程层 ADR-0012）；颠覆的是数据模型与产品形态，不是工程架构。

- **`core/` 新增四个并列业务模块**（各自 `index.ts`、禁 import 任何 UI 框架、不互 import 内部、可 Node 单测）：
  - `core/nodes`：ULID 身份（复用 `core/shared/id`）/ `node.json` 读写 / 扫描建树（深度=层级 + id→path）/ 创建（L1 选模板 / L2-L3 继承）/ 重命名（ID 不变）/ 移动（改父级）/ 提升为节点。
  - `core/templates`：6 类字段 schema 版本化写入 / 编辑生成新版 / 删除孤儿模板态 / 内置种子 / 给**设置内模板管理 UI** 供数据；workspace 初始化（建 `.eidon/templates/` + 种子）就近放此或复用现有 workspace 相关代码。
  - `core/snapshots`：版本能力归属，**直接复用现有 git（autoGit 不改、不做快照功能），仅薄封装 git bridge**（FR-VER-2 / ADR-0015）。
  - `core/consistency`：结构违规**检测 + 标记**（四类，FR-MARK / ADR-0016）；软态体系/自动补全/面板留后续。
- **`core/bridge/`**（唯一 Tauri 出口）：加 node/template/scan 的 typed wrapper；file/git/search wrapper 复用（allowlist 维持 0）。
- **`core/contracts/` + `fixtures/contracts/`（统一规范化）**：加 `node.ts` + `template.ts` + `.eidon/` 布局 zod 契约 + golden fixtures（FR-DATA-7 / ADR-0014）。
- **Rust 侧优先零新增**：`.node/` 读写与目录遍历复用现有 `editor/file_ops`；仅当万级文件遍历性能不足，再按 ADR-0009（领域文件夹 + `#[path]`）加一个最小 `scan` 原子命令。不为本期复用掉的版本/删除新增任何 Rust 能力。
- **`src/`（React UI）**：设置内新增 `TemplateManager`（模板/Schema CRUD）、`NodeCreateDialog`（建节点选模板）、`NodeInspector`（字段表单）；改造 `FileTree.tsx` 为节点感知（渲染 `core/consistency` 违规标记）；新增 `templates` / `nodes` Zustand store（沿用现有手工持久化风格）；**不挂载** AgentPanel/AgentSetupWizard/RecipesSettings/TraceView 等旧 AI 入口（不在 EIDON 范围、旧代码作基底，ADR-0018）；已存在且有价值的能力可保留并超前实现。
- **改名（ADR-0017）：** packageName/窗口标题/about/i18n → EIDON；系统区收敛 `.solomd`→`.eidon`，旧 `.solomd/` 静置不动。
- **不可逾越约束（机器强制）：** 单向依赖 `src→core→src-tauri`；`core/bridge/` 唯一 Tauri 出口（allowlist 维持 0）；`core/` 禁 UI 框架；四模块不 import 旧 AI 子系统模块；改 `node.json`/template/`.eidon` 形状先改 zod + fixtures。

---

## 13. 本期验收总线（Definition of Done）

以下端到端闭环全部通过 = 本期迭代可交付：

1. 选文件夹 → 首次用结构功能懒初始化 → 得到带内置模板的 workspace（与现有扁平内容共存）。
2. **在设置内**新建一套自定义三层【节点】模板（自定名字 + 6 类字段）；多套模板平级共存；改模板老数据不乱、新建用新版；再开不重复初始化、删过的模板不复活。
3. **硬强制**按模板搭 L1→L2→L3（根=L1 选模板、L1 下=L2、L2 下=L3、第 4 层起自由文件夹无身份）；UI 不给任何越级创建口子；填字段写入 `node.json`。
4. 在 L3 写 Markdown 内容（**复用**编辑器）→ 触发**复用**的失焦自动保存 + auto-commit 历史快照；查看历史、diff、恢复（**复用** HistoryPanel）。
5. 重命名 / 移动节点（含跨模板）→ ID 不变、id→path 更新；若造成层级不符 → FileTree 出现违规标记。
6. 把现有扁平库的普通文件夹**提升为节点**（根→L1 选模板、逐层 →L2/L3）→ 成为带 `.node/` 的合规节点。
7. 外部在前三层放普通文件夹 / 在 L1/L2 放内容文件 → FileTree 标记违规、**不自动处理**；用户点击「提升为节点 / 下沉到 L3 / 删除」才改动。
8. 删除 `.eidon/` 索引缓存 → 重启 → 全部结构 / 身份 / 字段从 `.node/` + `templates` 100% 重建，无数据丢失。
9. 用**复用**的全文搜索命中内容；拷贝 workspace 到另一机，模板 / `node.json` / 内容完整自包含。
10. **品牌全量为 EIDON**（packageName/窗口标题/about/i18n）；磁盘契约（node/template/`.eidon` 布局）统一纳入 zod + fixtures，`pnpm contracts:check` 绿。

全部通过 = EIDON 2.0「节点拓扑 + 多模板 schema」内核可交付。后续迭代（私有快照 / 回收站三关 / 一致性软态 / AI·Agent·Recipes 独立改造 / Todo / 链接）在此稳固内核上叠加，**不改动已立的节点 + 模板模型**。

---

## 附 A：后续迭代预留 / 不在范围（不在本期实现，仅说明衔接）
- **一致性软态体系**：在 `core/consistency`「检测+标记」之上叠加 `outOfPlace/orphan/orphanTemplate/disconnected` 软态 + 独立一致性面板 + 自动补全 + 自动整理开关。
- **回收站三关**：`.eidon/trash` 物理移入 + 路径冲突 / schemaVersion / reference 三关恢复。
- **私有快照仓库（如未来需要）**：在 `core/snapshots` 内换实现为 `.eidon/snapshots.git`（git-dir/work-tree 分离）+ 保存/快照解耦 + 路径↔ID 补偿。本期版本/diff 直接用现有 git，不做此项。
- **AI·Agent·Recipes 独立改造（不在本期，独立重建）**：整块子系统独立重建（AI 对话 / Memory / Recipes / 触发 / 联网能力）；双向链接 `[[]]`、块引用、Todo 选区锚点、语义检索；数据模型已为其预留（`references` 字段、`AGENTS.md` 占位）。

## 附 B：术语沉淀（已写入 `.config/context/CONTEXT.md`）
`L1/L2/L3 节点`、`节点 vs 普通文件夹`、`元/扩展 schema`、`模板版本化`、`提升为节点`、`结构违规标记`、`深度=层级铁律`、`core/ 四模块`、`版本用现有 git vs 私有快照仓库`、`AI·Agent·Recipes 不在 EIDON 范围`、`三层【代码】vs 三层【节点】`（必须强制消歧）。
