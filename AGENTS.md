# EIDON 架构与二次开发指南

> 本文件是本仓库面向 AI 助手与人类开发者的**权威指南**。所有目录结构、分层规范、开发约束、
> 注意事项与扩展规则均以此为准；`CLAUDE.md` 仅指向本文件，不重复内容。
>
> **架构决策（「为什么」）** 不在本文展开，统一记录在 `speculo/.speculo/.config/adr/`
> ——工程层 ADR，每条一个文件、各以 `ADR-00XX` 编号作稳定锚点（登记表见 `adr/README.md`）。
> 本文与代码注释均以 `(见 ADR-00XX)` 引用。**修改对应领域前先读相关 ADR，不要绕过既定边界。**
>
> **本期状态：** EIDON 是基于 SoloMD 的**颠覆性产品重构（1.x → 2.x）**，处于「数据层新地基」建设阶段。
> 本文已按 EIDON 2.0 方向编写：标注**【现有】**（复用的基底能力）、**【本期新建】**（节点+模板数据层，
> 规划见 `speculo/.speculo/dev/eidon-base-roadmap/`）、**【已删除】**（AI·Agent·Recipes，见 §6 / ADR-0018/0019）。

---

## 0. 「三层」全文消歧（强制，禁裸用）

本仓库「三层」一词双关，任何产出（文档/注释/commit/对话）出现时**必须显式限定**，禁止裸用：

- **三层【代码】** = `src(React UI) → core(TS 业务核心) → src-tauri(Rust 能力壳)`，软件分层、单向依赖、ESLint 机器强制（§2.1）。**本期复用不动。**
- **三层【节点】** = `L1 / L2 / L3`，数据节点层级，深度=层级铁律，第 4 层起为自由文件夹（无身份）。**本期要造的新地基（§3）。**

完整术语表见 `speculo/.speculo/.config/context/CONTEXT.md`。

---

## 1. 项目速览

### 1.1 这是什么

EIDON（仓库 `eidon`；包名 `solomd` → `eidon` 改名为本期工作，见 ADR-0017）是一个 **本地优先
（local-first）的结构化知识 IDE**，基于 Tauri 2 + React 19 + Rust。其核心是给本地 Markdown 知识库装上**固定三层【节点】拓扑 + 多模板
schema** 这层数据地基，使文件树从「认识文件夹」升级为「认识 L1/L2/L3 节点」——单人、多领域、完全本地
离线、数据可见可迁移不锁定（见 ADR-0011）。

它由 SoloMD（原 Agent Recipes 驱动的扁平 Markdown 应用）**颠覆性重构**而来：**不背向后兼容包袱**，但
**以现有系统为基底、复用优先、最小新增**——颠覆的是产品形态与数据模型，不是工程架构。原 AI·Agent·Recipes
**不在 EIDON 范围内**（已物理删除，core/ai 留接口占位，见 §6 / ADR-0018/0019）。

### 1.2 技术栈

| 层 | 技术 | 位置 |
|----|------|------|
| UI | React 19 + TypeScript + Tailwind CSS v4 + Zustand v5 + shadcn/ui + lucide-react + Vite（见 ADR-0010） | `app/src/` |
| 业务核心 | 纯 TypeScript（框架无关，可在 Node 下单测） | `app/core/` |
| 后端 | Rust + Tauri 2（能力型外壳，见 ADR-0001） | `app/src-tauri/` |
| 校验 | zod 运行时契约 + 跨语言 golden fixtures（见 ADR-0005/0014） | `app/core/contracts/`、`fixtures/` |
| 包管理 | pnpm（workspace 根在 `app/`） | `app/pnpm-workspace.yaml` |

### 1.3 常用命令

所有命令均可在**仓库根目录**执行（根 `package.json` 会代理到 `app/`）：

| 目的 | 命令 |
|------|------|
| 桌面开发（Tauri，热重载） | `pnpm dev` |
| 仅前端（浏览器，无 Tauri 后端） | `pnpm dev:web` |
| 前端类型检查 + 构建 | `pnpm build`（= `tsc --noEmit && vite build`） |
| Lint（强制三层【代码】边界，见 §2.1） | `pnpm lint` |
| 跑全部 TS core 测试 | `pnpm test:core` |
| 仅跑契约 conformance 测试 | `pnpm contracts:check` |
| 跑单个 TS 测试文件 | `pnpm --dir app exec vitest run core/__tests__/<path>.test.ts` |
| 按用例名过滤 | `pnpm --dir app exec vitest run core -t "<test name>"` |
| 跑全部 Rust 测试 | `cd app/src-tauri && cargo test` |
| 打包桌面应用 | `pnpm tauri:build` |

提交前最低限度：`pnpm lint && pnpm test:core`。改动磁盘契约时务必加跑 `pnpm contracts:check`。

---

## 2. 架构与边界

### 2.1 三层【代码】架构与单向依赖（最重要的约束，本期不动）

```
app/src (React UI)  →  app/core (TS 业务核心)  →  app/src-tauri (Rust 能力壳)
```

- **单向调用链**：UI 只能 import `core/`；`core/` 不得 import UI（`src/`）。
- **`core/bridge/` 是访问 Rust 的唯一出口**：只有 `core/bridge/**` 允许 import `@tauri-apps/api`
  / 调用 `invoke()` / 监听 Tauri 事件。其它任何文件都禁止。ESLint allowlist 必须保持为空（0）。
- **`core/` 全层禁止 import `react` / `zustand`（及任何 UI 框架）**——保证核心逻辑可在 Node 下纯函数式单测。
- **业务模块之间不得互相 import 对方内部路径**，只能经各自 `index.ts` 暴露的公共 API。
- 以上规则由 `eslint-plugin-boundaries` + `no-restricted-imports` **机器强制**（`app/eslint.config.mjs`），
  CI 拦截。本地用 `pnpm lint` 验证。（为什么：见 ADR-0001 / ADR-0006 / ADR-0007）

### 2.2 源代码目录结构

```
app/
├── core/                            # 应用核心（框架无关 TypeScript，禁止依赖任何 UI 框架；见 ADR-0006）
│   ├── bridge/                      # 唯一允许 invoke/listen 的 Tauri bridge 层（见 ADR-0007）
│   ├── contracts/                   # zod 契约（单一事实源，见 ADR-0005/0014）
│   ├── shared/                      # 纯工具（date / errors / id(ULID)）
│   │
│   │   # —— EIDON 数据层四模块【本期新建】（见 §3 / ADR-0012）——
│   ├── nodes/                       # 节点拓扑：ULID 身份 / node.json 读写 / 扫描建树 / CRUD / 提升为节点
│   ├── templates/                   # 多模板 schema：6 类字段 / 版本化不可变 / 内置种子 / 供设置内模板管理 UI
│   ├── snapshots/                   # 版本能力归属：仅薄封装现有 git(autoGit 不改、不做快照功能，见 ADR-0015)
│   ├── consistency/                 # 结构一致性：扫描检测四类违规 + 产出 FileTree 标记(见 ADR-0016)
│   │
│   │   # —— 节点级功能模块（新增，见 ADR-0020）——
│   ├── todos/                       # 节点级待办 + 定时提醒：每节点 .node/todos.json 读写 + 纯计算(下次触发/到期筛选)，批量并行 IO
│   │                                 #   （通知出口=bridge/notification；UI=TodoListPanel/TodoCreateDialog/TodoRow + lib/reminder-scheduler）
│   │
│   │   # —— 已删除：AI·Agent·Recipes（见 §6 / ADR-0018/0019）——
│   ├── ai/                           # 仅留接口占位（index.ts 类型+抛错空实现 + README.md）
│
├── src/                              # 前端（React 19 + TypeScript；组件为 .tsx、状态用 Zustand，见 ADR-0010）
│   ├── main.tsx                      # 入口：单 React root（挂 <App />），挂载节点 #app，不启用 StrictMode
│   ├── App.tsx                       # 顶层编排壳（窗格 / 视图模式 / 全局事件）
│   ├── components/                   # 叶子组件（.tsx）
│   │   ├── Editor.tsx / Preview.tsx  # CodeMirror 编辑面 + markdown 渲染面（像素保真，见 ADR-0010）【现有·复用】
│   │   ├── FileTree.tsx              # 文件树【本期改造为节点感知：区分节点/普通文件夹、层级图标、隐藏 .node/、渲染违规标记】
│   │   ├── Outline.tsx / GlobalSearch.tsx / HistoryPanel.tsx … # 大纲/搜索/历史【现有·复用】
│   │   ├── TemplateManager / NodeCreateDialog / NodeInspector  # 模板/节点 UI【本期新建，模板管理落「设置」】
│   │   ├── FilePropertiesPanel / NodePropertiesPanel          # 文件/节点属性面板（frontmatter / node.json 字段编辑）
│   │   ├── CalendarPanel / TodoListPanel / TodoCreateDialog / TodoRow  # 日历整理箱 + 待办/提醒 UI（见 ADR-0020）
│   │   ├── EidonPet.tsx              # 交互式像素宠物「小芽」（ActivityBar 驻留，见 ADR-0021）
│   │   └── ui/                       # shadcn/ui 原语（button / dialog / popover …）
│   ├── stores/                       # Zustand store（手工保真持久化，沿用既有 localStorage key）
│   │                                 #   【本期新增 templates / nodes store】
│   ├── composables/                  # React hooks（useFiles / useCommands / useShortcuts …）
│   ├── effects/                      # 命令式 DOM 副作用（dom-effects.ts）
│   ├── i18n/                         # 多语言字典（改名后文案统一为 EIDON，见 ADR-0017）
│   ├── lib/                          # 前端工具库：CodeMirror 扩展（cm-*）、markdown、导出、主题、persistence/
│   └── styles/                       # 全局 CSS + CSS 变量主题系统（Tailwind v4 @theme inline 映射）
│
├── src-tauri/                        # 后端（Rust + Tauri）
│   ├── src/                          # 按领域分文件夹；模块仍以 #[path] 扁平挂在 crate 根（见 ADR-0009）
│   │   ├── main.rs / lib.rs / runner.rs   # 入口 / 库入口（#[path] 清单）/ 桌面外壳
│   │   ├── shell/                    # 应用外壳与 OS 集成【现有】
│   │   ├── editor/                   # 基础编辑器：file_ops / convert / pandoc / watcher / themes【现有·复用；.node/ 读写与遍历复用 file_ops】
│   │   ├── knowledge/                # 索引与语言：search / workspace_index / spellcheck / cjk_proofread【现有·复用】
│   │   ├── git/                      # 版本控制：git_ops / git_history / github_sync / crypto / cloud_folder【现有·复用；版本/diff 直接用此】
│   │   └── （ai/ agent/ recipes/ integrations/ 已物理删除，见 §6 / ADR-0019）
│   └── tests/                        # 集成测试
```

> **Rust 侧优先零新增（ADR-0001/0009/0012）：** EIDON 数据层逻辑落在 Core(TS)，经现有 `editor/file_ops`
> 完成 `.node/` 读写与目录遍历；仅当万级文件遍历性能不足，才按 ADR-0009 加一个最小 `scan` 原子命令。

### 2.3 运行时工作区目录结构

```
<workspace>/                          ← EIDON 受管根（见 ADR-0017）
├── .eidon/                           ← EIDON 系统区【本期新建】
│   ├── templates/                    ← 多套三层模板的 schema（版本化不可变）
│   │   └── {templateId}/L{n}.{name}.v{ver}.json
│   ├── (运行时索引缓存)               ← 可删可重建（真理源是 plain files）
│   └── …                             ← 后续：trash / snapshots.git（本期不做，见 §3 / ADR-0015/0016）
│
├── 某 L1 节点/                        ← 第 1 层节点目录 = L1（纯组织层）
│   ├── .node/node.json               ← 节点身份+元/扩展字段（随目录移动）
│   ├── README.md  AGENTS.md          ← 人类描述 / AI 占位（本期仅占位）
│   └── 某 L2 节点/                    ← 第 2 层 = L2（纯组织层）
│       └── 某 L3 节点/               ← 第 3 层 = L3（唯一内容承载层）
│           ├── .node/node.json
│           ├── 笔记.md / 图.png       ← L3 可直接持有内容文件
│           └── 自由子目录/           ← 第 4 层起：自由文件夹（无身份，系统不管）
│
├── .eidon-sync/                      ← 每设备私有态（gitignored）：github sync.json / E2EE encryption.json / 会话(见 ADR-0022)
└── .eidon-encrypted/                 ← 启用端到端加密时的影子 git 库（gitignored，见 git/crypto.rs)
```

含 `.node/` 子目录者为**结构节点**，不含者为**普通文件夹**；两者本期共存（见 §3）。

---

## 3. EIDON 数据层【本期新建】

> 规划全文见 `speculo/.speculo/dev/eidon-base-roadmap/`（context-map / decision-log / roadmap）。
> 落点为 `core/` 四个并列业务模块（ADR-0012），各自 `index.ts`、禁 UI 框架、不互 import 内部。

### 3.1 固定三层【节点】拓扑 + 深度=层级铁律（ADR-0013）

- **深度=层级**：workspace 根下第 1/2/3 层**节点**目录 = L1/L2/L3，第 4 层起为自由文件夹（无身份）。层级由物理位置唯一确定。
- **创建期硬强制（零妥协）**：通过 EIDON 只能按 `根→L1(选模板) / L1下→L2 / L2下→L3 / L3下→自由` 创建；UI **不存在**越级创建入口。
- **文件白名单**：L1/L2 为纯组织层（仅 `.node/`+`README.md`+`AGENTS.md`+下级节点，无内容文件）；L3 为唯一内容承载层。
- **节点身份**：ULID（复用 `core/shared/id`），存 `.node/node.json`，随目录移动；删缓存可遍历重建 id→path。

### 3.2 多模板 schema（ADR-0013，schema 在「设置」内创建管理）

- 模板 = 三层各自的名字 + 字段集，捆绑为一体，**版本化不可变**，存 `.eidon/templates/{id}/L{n}.{name}.v{ver}.json`。
- **整体 L1/L2/L3 的 schema 规范在「设置」面板内创建新建 / 编辑 / 删除 / 版本管理**（`TemplateManager`，数据由 `core/templates` 提供）。
- 字段类型仅 6 种：`text` `textarea` `number` `date` `select` `boolean`。
- schema 二分：**元字段**（id/templateId/level/type/schemaVersion/createdAt/flags，固定、用户不可增删）+ **扩展字段**（模板定义、可扩展、懒迁移）。
- 内置默认模板（档案/项目/资料）仅首次初始化写入的普通文件，之后与用户模板完全平级（可编辑/删除）。

### 3.3 磁盘契约统一规范化（ADR-0005/0014）

- `.node/node.json` + `.eidon/templates/*` template schema + `.eidon/` 系统区布局，一律纳入 `core/contracts/`（zod 单一事实源）+ `fixtures/contracts/` golden fixtures。
- **改形状先改 zod + fixtures，再改解析。** fixtures 红即代表破坏「删缓存 → 从 `.node/`+`.eidon/templates/` 100% 重建节点树」一致性。
- node.json 预留 `references:[]` / `flags:{}`（本期空值），契约层先定形状，为后续零成本衔接。

### 3.4 版本 / diff = 直接用现有 git（ADR-0015）

- **以现有系统为基底：版本历史 / diff 对比 / 恢复直接用现有 git** 的 log/diff/checkout（auto-commit 历史 + `history.commitNow` + HistoryPanel，`git/git_history.rs`）。
- **autoGit 无需任何修改，本期不实现任何「快照功能」**：不建 `.eidon/snapshots.git`、不做保存/快照解耦、不做路径↔ID 补偿。`core/snapshots` 仅薄封装现有 git bridge，不新增逻辑。
- 消歧：此「git 版本」= 普通编辑的 auto-commit 历史，与旧 Agent Recipes 的 AutoGit 分支沙箱无关（不在范围）。

### 3.5 结构强制 + 违规标记（ADR-0016，`core/consistency`）

- 第一道防线 = 创建期硬强制（§3.1）。第二道 = 打开/扫描时 `core/consistency` 检测四类**结构违规**并在 FileTree 打徽标：
  ① 前三层出现普通文件夹（无 `.node/`）→「待提升」；② L1/L2 出现内容文件 →「位置非法/待下沉」；③ 节点深度与 `level` 不符 →「层级不符」；④ `.node/` 缺失/损坏 →「结构待修复」。
- **只读、不阻塞、不自动改**。整改 = 用户点击触发（主入口「提升为节点」/ 手动移动 / 删除 / 重建）。
- **本期不做**：软态身份系统（outOfPlace/orphan/disconnected）、自动补全、自动整理、独立一致性面板、回收站三关——留后续在 `core/consistency` 与现有删除之上叠加。

### 3.6 复用基底能力地图（现有，收编进新地基）

| 能力 | 复用现有 | EIDON 侧动作 |
|------|---------|-------------|
| Markdown 编辑/预览/大纲 | CodeMirror 栈（`Editor`/`Preview`/`Outline`） | 内容编辑入口仅在 L3 |
| 失焦自动保存 | `autoSaveDirtyTabs`（on blur） | 复用 |
| 版本/历史/diff/恢复 | git 版本历史（`git_history.rs` + HistoryPanel） | `core/snapshots` 仅薄封装（ADR-0015） |
| 外部修改刷新 | watcher | 复用 |
| 全文搜索 | `GlobalSearch` + `knowledge/search.rs` | 复用（可选叠加按节点/模板/层级/字段过滤） |
| 删除 | FileTree 直接删除（当前无回收站） | 复用 |
| 文件树 | `FileTree.tsx` | **改造为节点感知** |

> **超前实现边界（ADR-0011）：** 除 AI·Agent·Recipes 整块外，已存在且对结构化知识 IDE 有价值的能力（编辑器、搜索、版本、backlink/daily-notes 等）可保留并超前实现，不为分期人为隐藏。

---

## 4. 二次开发指南

### 4.1 四类扩展的唯一落点（见 ADR-0006/0012）

`core/` 的「内核 + 业务模块」结构为各类扩展定了唯一落点：

1. **新增节点能力**（身份/CRUD/扫描/提升）→ `core/nodes`。
2. **新增模板/字段能力**（schema/版本/类型）→ `core/templates`；新增字段类型是平滑扩展（版本化天然支持）。
3. **新增版本/历史能力** → `core/snapshots`（本期仅薄封装现有 git，勿另造快照系统，ADR-0015）。
4. **新增一致性检测** → `core/consistency`。
5. **新增其它功能域** → `core/` 建新业务模块文件夹（含 `index.ts`）；如需 Rust 能力则在 `src-tauri/src/` 建对称领域文件夹 + 在 `lib.rs`/`runner.rs` 各加一行 `#[path]`（ADR-0009）。

### 4.2 磁盘契约改动流程（机器强制，见 ADR-0005/0014）

改 `node.json` / template / `.eidon` 形状：**先改 `core/contracts/*.ts`（zod）+ `fixtures/contracts/` golden fixtures，再改解析**。`pnpm contracts:check` 红即代表破坏扫描重建一致性，CI 拦截。

### 4.3 Tauri 命令接口（见 ADR-0007）

前端业务代码不直接调用 `invoke()`；只能通过 `core/bridge/*`。`@tauri-apps/api` 的直接 import 只允许出现在 bridge 文件中，ESLint allowlist 应保持为 0。新增能力时优先在 `core/bridge/` 增 typed wrapper，再在对应 Rust 原子模块加 `#[tauri::command]` 并注册到 `lib.rs`/`runner.rs` 的 `invoke_handler`；EIDON 数据层的 `.node/` 读写、目录遍历优先复用 `editor/file_ops`。

### 4.4 不可逾越约束（全程遵守）

1. 单向依赖 `src→core→src-tauri`；`core/bridge/` 唯一 Tauri 出口（allowlist 维持 0）；`core/` 禁 UI 框架。
2. 四个数据层模块互不 import 内部；旧 AI 子系统模块已物理删除，`core/ai/` 仅保留接口占位（类型 + 抛错空实现）。
3. 改磁盘契约形状先改 zod + fixtures。
4. 「三层」禁裸用，每处显式限定【代码】或【节点】。

---

## 5. 可重建铁律与非功能约束

| 编号 | 要求 |
|------|------|
| 可重建 | 删 `.eidon/` 索引缓存后，遍历 `.node/` + `.eidon/templates/` 100% 重建节点树/身份/字段/id→path（产品层 AX-1/AX-4，每阶段末回归） |
| 性能 | 万级文件 workspace 可用；打开扫描可增量、后台、不长时间阻塞 |
| 离线 | 完全离线可用，无任何联网依赖（AI·Agent·Recipes 已物理删除，见 ADR-0019） |
| 可迁移 | 拷贝 workspace 到另一台机器，模板/`node.json`/内容完整自包含（git 历史属本机缓存除外） |
| 跨平台 | Windows / macOS / Linux（Tauri 2） |

---

## 6. 已删除：AI·Agent·Recipes（见 ADR-0018/0019）

原 SoloMD 的 **AI·Agent·Recipes**（AI 对话 / 自动化 Recipes / cron·事件触发 / AutoGit 分支沙箱 / RAG / capture / REST / MCP / cloud）已于 2026-06 物理删除。

### 删除清单

| 层 | 删除内容 |
|----|---------|
| Rust | `src/ai/`、`src/agent/`、`src/recipes/`、`src/integrations/`、`src/knowledge/rag.rs` |
| Core TS | `core/agent/`、`core/recipes/`、`core/trace/`、`core/pricing/`；`core/ai/` 除占位外全部 |
| Bridge | `core/bridge/` 下 ai / keychain / agent-tools / cookbook / recipes / run / trace / triggers / search |
| Contracts | `core/contracts/` 下 recipe / run-meta / trace |
| 前端 | ~15 组件 + 4 stores + 2 lib 文件 |
| i18n | 10 个命名空间（integrations / recipes / ai / rag / rest / wizard / cookbook / cost / agentSettings / agent） |
| CSS | 12 个组件区块（~1,300 行） |
| 依赖 | 7 个 Rust crate（futures-util / async-stream / cron / globset / hex / tracing / rusqlite） |
| 测试 | 7 个测试文件 + 1 个 fixtures 目录 + 3 个契约 golden fixtures |

### 占位契约

`core/ai/` 仅保留两个文件，为未来接入其他 AI 预留空间：

- **`index.ts`**（零依赖）：导出 `ApiFormat`、`ChatMessage`、`AiProviderConfig`、`StreamEvent`/`StreamHandler`、`ChatLoopRequest`/`ChatLoopResult` 类型（与原实现同形）；`AiNotConnectedError` 错误类；`isAiAvailable(): boolean` 恒 false；`runChatLoop(request, onEvent)` 保留原签名、立即抛 `AiNotConnectedError`。
- **`README.md`**：历史说明（原实现已删、git 历史可找回）；接口契约语义；未来接入步骤（① 本目录实现 provider 构造+流解析 → ② 如需 Rust 透传按 §4.1/§4.3 加 bridge wrapper → ③ 翻转 isAiAvailable → ④ 三层【代码】边界不变）。

### 保留物

- `src/lib/clean-ai.ts` + useCommands 的 `clean.aiArtifacts`（纯本地文本清理，不调 AI）
- i18n 四键：`toolbar.cleanAi/cleanAiTitle`、`toast.aiCleaned/noAi`
- `git/crypto.rs`、`git/github_sync.rs` 的每设备同步·加密态存于 `.eidon-sync/` + `.eidon-encrypted/`，钥匙串服务名 `eidon-*`（原 `.solomd/` / `solomd-*` 已于 ADR-0022 全量改名；pre-launch 无迁移垫片）
- `reqwest`、`keyring` crate（被 `git/crypto.rs`、`git/github_sync.rs` 共用）

### 找回路径

全部删除内容在 git 历史中完整保留。删除 commit 哈希见 ADR-0019 头部。浏览历史：
```
git log -- app/core/ai/ app/core/agent/ app/core/recipes/ app/src-tauri/src/ai/
git show <删除 commit>^:app/core/ai/chat-loop.ts
```

---

## 7. ADR 索引（工程层，登记表见 `adr/README.md`）

| 轨道 | ADR |
|------|-----|
| 工程基座 | 0001（Core 跑 webview/Rust 能力壳）· 0005（磁盘契约接缝）· 0006（Core 内核+业务模块）· 0007（ESLint 三层边界）· 0009（src-tauri 领域文件夹）· 0010（UI=React 19） |
| EIDON 2.0 数据层 | 0011（颠覆性重构·以现有系统为基底）· 0012（四模块落点）· 0013（三层节点拓扑+多模板）· 0014（磁盘契约统一）· 0015（版本/diff 用现有 git，不做快照功能）· 0016（结构强制+违规标记）· 0017（改名 + `.eidon` 系统区）· 0018（AI·Agent·Recipes 不在范围）· 0019（物理删除 AI 子系统，core/ai 留接口占位） |
| 节点功能 + 改名收尾 | 0020（todos + 提醒 + 通知子系统）· 0021（像素宠物「小芽」品牌/交互层）· 0022（solomd→eidon 全量改名，pre-launch 无迁移垫片；扩展 0017、订正 0019） |

> 旧 AI 子系统 ADR 0002/0003/0004/0008 已随重构删除，编号留空不复用。
> **产品层 ADR** = `temp/EIDON_数据层架构决策记录_ADR.md` 的 `ADR-001~013` + `AX-1~5`（愿景源）；引用须标来源轨道（「产品层 ADR-002」vs「工程层 ADR-0002」）。
