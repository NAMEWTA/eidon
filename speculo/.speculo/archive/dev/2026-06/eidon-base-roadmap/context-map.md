> **服务工作流：** `../01-grill-with-docs/01-grill-with-docs.md`
> **产物文件名：** `context-map.md`

# Context Map

## 变更目标

用户希望基于当前项目**真实的技术栈 / 技术路线 / 目录结构**，深度吸收 EIDON 规划愿景（数据层 ADR、基座 PRD、用户故事旅程），产出一份**契合当前工程现实、区分先后顺序**的完整二次开发规划（开发规划 + 架构规划 + 阶段规划）。

本 change 的 grill 阶段已完成：澄清了「当前代码（SoloMD / Agent Recipes）」与「EIDON 目标愿景」的关系与边界，并把规划锚定到机器可强制的三层【代码】架构上。**§决策线索 中的七个分支已由用户全部解决**（见下方「已解决的决策分支」），决策详情沉淀于 `decision-log.md`，规划落地于 `roadmap.md`，工程约束立为 `../../.config/adr/ADR-0011~0018`。

## 已读取上下文

| 来源 | 关键事实 |
|---|---|
| `AGENTS.md`（权威指南） | 被重构产品 = **SoloMD**（旧包名 solomd，仓库 eidon），local-first Markdown 知识库桌面应用。原核心特性 = **Agent Recipes**（LLM 驱动、cron/事件触发、AutoGit 分支沙箱、Accept/Reject 审核）。已从 Vue3 迁到 React19（工程层 ADR-0010）。 |
| `AGENTS.md` §2.1 三层**代码**架构 | `src(React UI) → core(TS 业务核心) → src-tauri(Rust 能力壳)` 单向依赖，`core/bridge/` 是访问 Rust 唯一出口，`core/` 禁 import 任何 UI 框架。由 ESLint `eslint-plugin-boundaries` 机器强制、CI 拦截。**此「三层」= 软件分层，非数据层级。本期复用不动。** |
| `../../.config/adr/`（工程层 ADR） | 工程基座 0001/0005/0006/0007/0009/0010；**本 change 新增 0011~0018** EIDON 2.0 数据层 ADR（根决策、四模块落点、三层节点拓扑、磁盘契约统一、git 复用、结构强制+标记、改名、AI 不在范围）；旧 AI 子系统 ADR 0002/0003/0004/0008 已删除。登记表见 `adr/README.md`。 |
| `temp/EIDON_数据层架构决策记录_ADR.md`（产品层愿景源） | **产品层愿景**：EIDON = Local-First Structured Knowledge IDE。5 公理（AX-1~5）+ 13 块基石（产品层 ADR-001~013）。核心 = **固定三层节点拓扑 L1/L2/L3**（深度=层级铁律）、多模板 schema、`.node/` 嵌入身份、`.eidon/` 系统区、私有 `snapshots.git`、回收站、越界/孤儿/失联软态。**此「三层」= 数据节点层级，非软件分层。** |
| `temp/EIDON_第一步基座_PRD.md` | 基座「纯净基座」= 三层笔记资料系统。FR-DATA / FR-WS / FR-TPL / FR-NODE / FR-CLEAN / FR-EDIT / FR-VER / FR-TRASH / FR-SYNC / FR-SEARCH / FR-TREE + DoD。 |
| `temp/EIDON_第一步基座_用户故事旅程.md` | 八幕 US-001~US-035，把基座翻译成主角「林」的真实使用时间线。 |
| 本期产出 `docs/EIDON_本期迭代_*.md` | 由愿景 + 决策收敛出的**本期可交付 PRD 与用户故事旅程**（节点 + 模板内核 + 复用现有能力 + 改名；AI 不在范围）。 |
| 代码事实（grep 全库） | **当前代码零 EIDON 数据层痕迹**：无 `.eidon/`、`.node/`、`templateId`、`schemaVersion`、`outOfPlace`、`snapshots.git`。`workspace` 仅是扁平文件夹路径。`FileTree.tsx` 把目录当普通 `{name,path,is_dir}` 树（Obsidian 式），无节点/非节点之分、无层级语义。 |
| 代码事实（模块清单） | `core/`：ai / agent / bridge / contracts / recipes / trace / pricing / shared。`src-tauri/src/`：editor(file_ops/convert/pandoc/watcher/themes) / knowledge(search/workspace_index/spellcheck/cjk_proofread/rag) / git(git_ops/git_history/github_sync/crypto/cloud_folder) / ai / agent / recipes / shell / integrations。`src/`：Editor/FileTree/Outline/GlobalSearch/HistoryPanel/Backlinks/Tags + 大量 cm-* CodeMirror 扩展。 |
| speculo 配置 | `.config/context/CONTEXT.md` 已写入术语表（2.0 定位 + 双关消歧 + 四模块 + 双轨 ADR）。`.config/adr/` 已立 0001~0018。`dev-status.json` 记录本 change。 |

## 领域术语

> 完整术语表见 `../../.config/context/CONTEXT.md`。此处仅留消歧索引。

**已确认术语（沿用）：** `L1/L2/L3 节点`、`节点 vs 普通文件夹`、`元/扩展 schema`、`模板版本化`、`提升为节点`、`结构违规标记`、`深度=层级铁律`、`core/ 四模块（nodes/templates/snapshots/consistency）`。

**强制消歧（禁裸用，见 CONTEXT §1）：**
- **「三层」双关**：三层【代码】（src/core/src-tauri，本期复用不动）vs 三层【节点】（L1/L2/L3，本期要造）。
- **「workspace」漂移**：SoloMD 扁平文件夹（`.solomd/`）→ EIDON 受管根（`.eidon/`），**不背兼容包袱**。
- **「AutoGit / 快照」双关**：Agent Recipes 分支沙箱（旧产品，不在范围）vs 版本/diff 用现有 git（本期复用，autoGit 不改、不做快照功能）vs 私有 snapshots.git（本期不做）。
- **「Agent / AGENTS.md」双关**：Agent Recipes（旧产品，不在范围）vs 仓库根工程指南 vs 节点内 AI 占位文件。
- **产品名**：`solomd` → `EIDON`，**本期改名**。

## 已解决的决策分支（原「决策线索」七问，现全部由用户解决）

> 详细决策依据见 `decision-log.md`；工程落点见对应工程层 ADR。

1. **【根决策】SoloMD 与 EIDON 的关系** → **颠覆性产品迭代重构（1.x→2.x）·以现有系统为基底**：不背向后兼容包袱，但复用优先、最小新增（凡能复用现有实现一律复用）；数据层（节点+模板）为新地基，收编现有编辑/版本/搜索/文件树能力。（D-1 / 工程层 ADR-0011）
2. **AI·Agent·Recipes 去向** → **不在 EIDON 产品范围**：旧代码作基底保留、不挂载、不依赖；未来若做 AI 是一次独立重建。（D-2 / 工程层 ADR-0018）
3. **扁平编辑器 ↔ 节点感知文件树融合** → **改造 FileTree 为节点感知 + 复用编辑栈**；编辑/搜索/版本整体复用。（D-3 / 工程层 ADR-0012）
4. **现有「第二步特性」（wikilink/backlink/daily-notes…）** → **已存在且有价值者可保留并超前实现**，不为分期人为隐藏（范围边界仅圈 AI·Agent·Recipes 整块）。（D-4 / 工程层 ADR-0011/0018）
5. **品牌改名** → **本期纳入** solomd → EIDON 改名 + `.solomd`→`.eidon` 系统区（取代早期「延后」）。（D-10 / 工程层 ADR-0017）
6. **数据层落点** → **`core/` 四个细模块** `nodes` / `templates` / `snapshots` / `consistency`（取代早期「只加两个」），保证可扩展性 + 可读性；Rust 侧优先零新增。（D-5 / 工程层 ADR-0012）
7. **磁盘契约** → **统一规范化管理**：`node.json` + template schema + `.eidon/` 系统区布局一律纳入 `core/contracts/`（zod）+ `fixtures/contracts/` golden fixtures。（D-11 / 工程层 ADR-0014）

**额外解决：** 版本/diff = **直接用现有 git，autoGit 无需修改、不做快照功能**（利用 git 的 log/diff/checkout；`core/snapshots` 仅薄封装，不建 `.eidon/snapshots.git`）。（D-12 / 工程层 ADR-0015）；整体 L1/L2/L3 schema 规范 = **在「设置」内创建新建与管理**。

**代码现实约束（机器强制，规划不得违反）：**
- 单向依赖 `src → core → src-tauri`，`core/bridge/` 唯一 Tauri 出口，`core/` 禁 UI 框架——EIDON 数据层逻辑必须落在 `core/`（可 Node 单测），Rust 只做原子 I/O + 能力壳。
- 磁盘契约改动须先改 zod + fixtures（工程层 ADR-0005/0014）。
- 新功能域扩展唯一落点：`core/` 新业务模块文件夹 + `src-tauri/src/` 对称领域文件夹（工程层 ADR-0006/0009）。

## 下一阶段

grill 决策已全部解决，change 进入**规划落地**：`roadmap.md`（开发/架构/阶段规划）与 `docs/EIDON_本期迭代_*.md`（PRD + 用户故事旅程）为权威产物；工程层 ADR-0011~0018 为机器可引用的约束锚点。后续若需调整范围，回到 `decision-log.md` 增订决策并同步 ADR。
