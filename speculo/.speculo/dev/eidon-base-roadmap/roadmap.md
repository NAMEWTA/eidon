# EIDON 节点+模板内核 · 二次开发路线图（2.0 重构版）

> **本文定位：** 在「**颠覆性产品迭代重构（1.x→2.x）·不背兼容包袱·最大化复用代码**」+「数据层为新地基、`core/` 四细模块、复用三层【代码】架构」的约束下，把 EIDON 内核落到当前 `app/`（被重构的 SoloMD）真实工程上的开发/架构/阶段规划。
> **支点决策（见 `decision-log.md` + 工程层 ADR）：** D-1 颠覆性 2.0 重构·以现有系统为基底（ADR-0011）· D-2 AI·Agent·Recipes 不在 EIDON 范围（ADR-0018）· D-4 现有功能可保留并超前实现 · **D-5 `core/` 四模块 nodes/templates/snapshots/consistency（ADR-0012）** · D-6/D-8 结构强制+违规标记（ADR-0016）· **D-10 本期改名（ADR-0017）** · **D-11 磁盘契约统一（ADR-0014）** · **D-12 版本/diff 直接用现有 git，autoGit 不改、不做快照功能（ADR-0015）**。
> **「三层【代码】/三层【节点】」全文消歧：** `三层【代码】`=`src/core/src-tauri`（软件分层，本期**复用不动**）；`三层【节点】`=`L1/L2/L3`（数据层级，本期**要造**）。

---

## 0. 一句话战略

> EIDON 是基于 SoloMD 的**颠覆性产品重构**，**以现有系统为基底、复用优先**：复用三层【代码】架构与全部成熟基础设施（编辑/版本/搜索/文件树），在 `core/` 按既定扩展方式新增**四个细模块**（nodes/templates/snapshots/consistency），给现有「扁平文件夹」补上**节点身份(`.node/node.json`) + 多模板 schema(`.eidon/templates/`)** 这层新地基，让 FileTree/编辑器从「认识文件夹」升级为「认识 L1/L2/L3 节点」。**版本/diff 直接用现有 git（autoGit 不改、不做快照功能）**、删除/搜索/编辑器复用现有；一致性本期只做**检测+标记**。本期同步完成 **solomd→EIDON 改名**与**磁盘契约统一规范化**；AI·Agent·Recipes **不在 EIDON 范围**（旧代码作基底保留）。

---

## 1. 范围边界（IN / REUSE / OUT）

| | 内容 |
|---|---|
| **IN 必造** | `.eidon/templates/` 多模板版本化 schema（6 类字段，**设置内创建管理**）· 节点 `.node/node.json`（id/templateId/level/type/schemaVersion/fields）· **创建期硬强制** depth=层级 · L1/L2 纯组织层 / L3 唯一内容层 · 打开扫描建节点树（id→path）· 节点 CRUD（创建/重命名 ID 不变/移动）· **提升为节点** · 字段表单 · 模板管理 UI（设置内）· **节点感知 FileTree + 违规标记** · 删缓存 100% 从文件重建 · **solomd→EIDON 改名 + `.solomd→.eidon`** · **磁盘契约统一纳入 zod+fixtures** |
| **REUSE 复用现有（收编进新地基）** | 编辑/预览/大纲（CodeMirror 栈）· 失焦自动保存 · **版本/diff = 现有 git（autoGit 不改、不做快照功能）**，`core/snapshots` 仅薄封装 · 外部刷新（watcher）· 全文搜索（GlobalSearch）· 删除（FileTree 直接删除）· 已存在且有价值的能力（**可超前实现**，不为分期人为隐藏） |
| **OUT 本期不做（后续迭代）** | 私有 `.eidon/snapshots.git` 等「另造快照系统」（**用现有 git 即可**）· 回收站三关（`.eidon/trash`）· 软态身份系统（outOfPlace/orphan/disconnected）+ 自动补全 + 自动整理 + 独立一致性面板 · 用户层链接 `[[]]`/块引用/反向链接（除非已存在可超前）· 语义/向量搜索 · **AI·Agent·Recipes 整块（不在 EIDON 范围，旧代码作基底）** |
| **保留不实现** | `node.json` 的 `references:[]`、`flags:{}`、节点内 `AGENTS.md` 占位 → 后续迭代零成本衔接 |

---

## 2. 架构规划（数据层为新地基，复用三层【代码】架构）

### 2.1 `core/` 新增四个并列业务模块（依工程层 ADR-0012/0006 既定扩展方式，各自 `index.ts`、禁 UI 框架、可 Node 单测）

```
core/
├── nodes/        # 节点拓扑：ULID 身份(复用 core/shared/id) · node.json 读写
│                 #   · 扫描建树(遍历→识别 .node/→深度=层级→id→path 映射)
│                 #   · 创建(L1 选模板/L2-L3 继承父链) · 重命名(改目录名 ID 不变) · 移动(改父级) · 提升为节点
├── templates/    # 多模板 schema：6 类字段(text/textarea/number/date/select/boolean)
│                 #   · 版本化不可变写入 .eidon/templates/{id}/L{n}.{name}.v{ver}.json
│                 #   · 编辑生成新版本(旧版不改) · 删除→孤儿模板态(字段裸键值不丢) · 内置种子
│                 #   · 给设置内的「模板管理 UI」供数据
├── snapshots/    # 版本能力归属：直接复用现有 git(autoGit 不改、不做快照功能, ADR-0015)
│                 #   · 仅薄封装 git_history bridge 暴露 历史/diff/恢复；不新增逻辑
└── consistency/  # 结构一致性：扫描检测四类结构违规 + 产出 FileTree 标记(ADR-0016)
                  #   · 本期只检测+标记；软态身份系统/自动补全/一致性面板留后续
```

> workspace 初始化（建 `.eidon/templates/` + 写内置种子）就近放 `core/templates`，或复用现有 workspace 相关代码——不为它单开模块。

### 2.2 复用既有内核（不改其结构，收编进新地基）

| 复用项 | 用途 | 动作 |
|---|---|---|
| `core/bridge/`（唯一 Tauri 出口） | 加 node/template/scan 的 typed wrapper；file/git/search wrapper 直接复用 | 扩展（allowlist 维持 0） |
| `core/contracts/` + `fixtures/contracts/` | 加 `node.ts` + `template.ts` + `.eidon/` 布局 zod 契约 + golden fixtures（ADR-0014） | 扩展 |
| `core/shared/id.ts` | ULID 节点身份 | 复用 |
| `editor/file_ops.rs`（Rust） | `.node/` 读写、目录遍历 | 复用 |
| `git/git_history.rs`、auto-commit 历史 | 版本/历史/diff/恢复（`core/snapshots` 仅薄封装） | **直接复用，autoGit 不改、不做快照功能** |
| `knowledge/search.rs`、`GlobalSearch.tsx` | 搜索 | 复用 |
| `Editor/Preview/Outline/HistoryPanel` | 编辑/预览/大文件/历史 | 复用 |

### 2.3 Rust 侧：优先零新增（ADR-0001/0009/0012）

- `.node/` 读写与目录遍历先复用 `editor/file_ops`；扫描建树先在 Core(TS) 经现有 file bridge 完成。
- **仅当**万级文件遍历性能不足，再按 ADR-0009（领域文件夹 + `#[path]`）加一个最小 `scan` 原子命令。
- 不为本期复用掉的版本/删除新增任何 Rust 能力。旧 ai/agent/recipes/integrations Rust 模块属基底、保留原位不动（不在 EIDON 范围，ADR-0018）。

### 2.4 `src/`（React UI）：新增 + FileTree 改造 + 改名

- **新增**：设置内 `TemplateManager`（模板/schema CRUD，**schema 规范在设置里创建新建**）、`NodeCreateDialog`（建节点选模板）、`NodeInspector`（字段表单）。
- **改造**：`FileTree.tsx` → 节点感知（节点 vs 普通文件夹视觉区分、模板/层级图标、隐藏 `.node/`、渲染 `core/consistency` 违规标记）。
- **复用**：Editor/Preview/Outline/GlobalSearch/HistoryPanel；已存在且有价值的能力可超前保留。
- **不挂载**：AgentPanel/AgentSetupWizard/RecipesSettings/TraceView 等旧 AI 入口不挂载（不在 EIDON 范围，代码作基底保留，ADR-0018）。
- **改名**：packageName/窗口标题/about/i18n → EIDON（ADR-0017）。
- 新增 stores：`templates`、`nodes`（按现有 Zustand 手工持久化风格）。

### 2.5 不可逾越约束（机器强制，全程遵守）

1. 单向依赖 `src→core→src-tauri`；`core/bridge/` 唯一 Tauri 出口（allowlist 维持 0）；`core/` 禁 UI 框架。四模块互不 import 内部、不 import 旧 AI 子系统模块。
2. 改 `node.json`/template/`.eidon` 形状 → **先改 zod + fixtures** 再改解析（ADR-0014）。
3. 删 `.eidon` 索引缓存后，遍历 `.node/node.json` + `.eidon/templates/` 可 100% 重建节点树（AX-1/AX-4，验证铁律）。

---

## 3. 阶段规划（地基先行 + 垂直闭环；区分先后）

> **依赖链：** 阶段0 → 阶段1 → 阶段2 → 阶段3 → 阶段4。

### 阶段 0 · 节点地基（不可回退，先钉死契约与重建）
<phase id="phase0-node-base" status="已实现"><!-- 未开始 → 已实现(dev/03) → 已验证(dev/04) --></phase>
- **交付物：**
  - zod 契约 `node.ts`（id/templateId/level/type/schemaVersion/fields/references/flags）+ `template.ts`（三层【节点】名字+字段集，6 类型）+ `.eidon/` 布局契约 + `fixtures/contracts/` golden fixtures（**磁盘契约统一**，ADR-0014）。
  - `core/shared` ULID 身份；`core/nodes` 扫描建树内核：遍历现有 workspace → 识别 `.node/` → **深度=层级**判定 → id→path 映射。
  - 「删缓存→从 `.node/` + `.eidon/templates/` 重建节点树」单测（AX-1/AX-4）。
- **复用：** `editor/file_ops` 遍历/读写；现有 workspace 打开流程。
- **对齐：** PRD FR-DATA-1/2/3/5/7。
- **验收切片：** `pnpm contracts:check` + `pnpm test:core` 绿；fixture workspace 删缓存后节点树/身份/字段重建 100% 一致。

### 阶段 1 · 多模板 schema（垂直切片①：立规矩，schema 在设置内创建）
<phase id="phase1-templates" status="已实现"><!-- 未开始 → 已实现(dev/03) → 已验证(dev/04) --></phase>
- **交付物：**
  - `core/templates`：模板定义（三层【节点】名字+字段，6 类型）/ 版本化不可变写入 / 编辑→生成新版本（旧版不改、UI 告知「只对新建生效」）/ 删除→孤儿模板态（字段裸键值不丢）。
  - workspace 首次初始化：建 `.eidon/templates/` + 写内置默认模板种子（仅首次，已初始化不重写）。
  - UI：**设置内** `TemplateManager`（创建新建/编辑/删除/版本管理）。
- **对齐：** PRD FR-WS-1、FR-TPL-1/2/3，产品层 ADR-005/010。**US**：第二幕 US-004~007 + US-002/003。
- **验收切片：** 在设置内建一套自定义三层【节点】模板（自定名字+6 类字段）；多套模板平级共存；改模板老数据不乱、新建用新版；再开不重复初始化、删过的模板不复活。

### 阶段 2 · 节点拓扑闭环（垂直切片②：搭骨架+填血肉）
<phase id="phase2-node-topology" status="已实现"><!-- 未开始 → 已实现(dev/03) → 已验证(dev/04) --></phase>
- **交付物：**
  - `core/nodes`：创建节点（L1 在根选模板 / L2 在 L1 下 / L3 在 L2 下，继承父链）→ 生成 `.node/node.json`（元+扩展 schema）+ 空 README/AGENTS；重命名（ID 不变）；移动（改父级）；提升为节点。
  - UI：`NodeCreateDialog`、节点字段表单（NodeInspector）、`FileTree` 节点感知（区分节点/普通文件夹、模板/层级图标、隐藏 `.node/`）。
  - 编辑器：复用现有 CodeMirror 在 L3 写 Markdown，复用现有自动保存。
- **对齐：** PRD FR-DATA-4、FR-NODE-1/2/3/4、FR-EDIT-1（复用），产品层 ADR-002/003/004/008（白名单创建）。**US**：第三~四幕 US-008~016b。
- **验收切片：** 硬强制按模板搭 L1→L2→L3（深度=层级强制：根=L1、L1 下=L2、L2 下=L3、第 4 层起自由文件夹无身份）；填字段写入 node.json；在 L3 写 Markdown 并自动保存；重命名/移动后 ID 不变、id→path 更新。

### 阶段 3 · 一致性检测 + 复用整合（垂直切片③：标记违规 + 接回现有能力）
<phase id="phase3-consistency" status="已实现"><!-- 未开始 → 已实现(dev/03) → 已验证(dev/04) --></phase>
- **交付物：**
  - `core/consistency`：扫描检测四类结构违规（前三个物理深度里的普通文件夹/L1-L2 内容文件/层级不符/`.node/` 缺失）→ 产出 FileTree 标记；整改入口（提升为节点/下沉/删除）由用户点击触发。
  - 接线复用：版本/历史/diff/恢复 = `core/snapshots` 薄封装现有 git（autoGit 不改、不做快照功能）；删除 = 现有 FileTree 删除；搜索 = 现有 GlobalSearch（可选加「按节点/模板/层级/字段」结构过滤）。
- **对齐：** PRD FR-MARK-1~4、FR-VER（复用）、FR-DEL（复用）、FR-SEARCH（复用）。**US**：第五/六幕。
- **验收切片：** 外部在前三个物理深度里放普通文件夹/在 L1-L2 放内容文件 → FileTree 标记违规、不自动处理；点「提升为节点/下沉到 L3」才改动；版本回退/搜索经现有能力贯通。

### 阶段 4 · 改名收口 + 端到端贯通（垂直切片④：2.0 品牌落地）
<phase id="phase4-finalize" status="已实现"><!-- 未开始 → 已实现(dev/03) → 已验证(dev/04) --></phase>
- **交付物：**
  - `solomd → EIDON` 改名（packageName/窗口标题/about/i18n）+ 系统区收敛到 `.eidon/`（ADR-0017）。
  - 内置模板字段集最终敲定（O-3 已关闭，落定 PRD §FR-TPL-3）。
  - 文档：AGENTS.md 全面对齐 EIDON 2.0（架构改写 + ADR 引用范围 0001/0005~0007/0009~0018 + 四模块落点 + AI 不在范围说明，后续跟进）。
- **对齐：** PRD §12 工程落点、DoD 全条。**US**：第七幕（信任：离线/迁移/重建/Git）。
- **验收切片：** 端到端贯通——设置内建模板→搭 L1/L2/L3→写内容填字段→（复用）自动保存→（autoGit）版本回退→（现有）搜索命中→违规标记+提升整改；拷贝 workspace 到另一机，模板/node.json/内容完整自包含；删缓存重建节点树无丢失；品牌全量为 EIDON。

---

## 4. 横切关注点（贯穿）

1. **「三层【代码】/三层【节点】」消歧**：所有产出显式限定 `三层【代码】`/`三层【节点】`，禁裸用。
2. **契约防漂移（统一）**：`node.json`/template/`.eidon` 形状变化先改 zod + golden fixtures（ADR-0014）。
3. **薄封装隔离演进**：版本走 `core/snapshots`（仅薄封装现有 git）、一致性走 `core/consistency`——本期复用/轻实现，后续深化不动调用方。
4. **范围隔离**：四模块不 import 旧 AI 子系统（ai/agent/recipes/integrations）；ESLint 边界保证不回流（ADR-0018）。
5. **可重建回归**：每阶段末跑「删缓存 → 从 `.node/`+`templates` 重建节点树一致」回归（AX-1/AX-4）。
6. **前向兼容预留**：`references`/`flags`/`AGENTS.md` 占位保留不实现，不引入会阻碍后续的取舍。

---

## 5. 先后顺序速查

```
P0 阶段0  节点地基   契约(node/template/.eidon)统一+扫描建树+重建可验证   ← 不可回退,最先
P1 阶段1  多模板     模板 schema 版本化 + 内置种子 + 设置内模板管理 UI
P2 阶段2  节点闭环   建/改名/移动/提升 L1·L2·L3 + 字段表单 + 节点感知 FileTree + L3 写内容(复用编辑器)
P3 阶段3  一致性+复用 core/consistency 检测标记 + 接回 autoGit版本/删除/搜索
P4 阶段4  改名收口   solomd→EIDON + .solomd→.eidon + 内置字段定稿 + 端到端贯通
```

> **判据：** 每阶段「验收切片」全绿即进下一阶段；阶段0/4 末跑「删缓存重建」回归。五段贯通 = EIDON 2.0「节点拓扑 + 多模板 schema」内核可交付；私有快照、回收站三关、软态体系、AI·Agent·Recipes 独立改造全部留作后续按需叠加，**不改动已立的节点+模板模型**。
