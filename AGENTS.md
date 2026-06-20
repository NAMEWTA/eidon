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

## 0. 「分层」全文消歧（强制，禁裸用）

本仓库「分层」术语双关，任何产出（文档/注释/commit/对话）出现时**必须显式限定**，禁止裸用：

- **【代码】分层**（原「三层【代码】」，重构后为**四层**，见 ADR-0025）= `frontend(纯 UI 渲染层) → bridge(前后端契约边界) → backend(ipc 接入 → service 编排 → {domain 业务规则 / capability 底层资源}) + shared(模型/契约/IPC/纯工具)`，单向依赖、ESLint 机器强制（§2.1）。frontend↔backend 唯一接缝是 preload 暴露的 `window.eidon`（typed IPC）。**四层【代码】架构见 ADR-0025。**
- **三层【节点】** = `L1 / L2 / L3`，数据节点层级，深度=层级铁律，第 4 层起为自由文件夹（无身份）。**本期要造的新地基（§3）。**

完整术语表见 `speculo/.speculo/.config/context/CONTEXT.md`。

---

## 1. 项目速览

### 1.1 这是什么

EIDON（仓库 `eidon`；包名 `solomd` → `eidon` 改名为本期工作，见 ADR-0017）是一个 **本地优先
（local-first）的结构化知识 IDE**，基于 Electron + React 19 + 全 TypeScript。其核心是给本地 Markdown 知识库装上**固定三层【节点】拓扑 + 多模板
schema** 这层数据地基，使文件树从「认识文件夹」升级为「认识 L1/L2/L3 节点」——单人、多领域、完全本地
离线、数据可见可迁移不锁定（见 ADR-0011）。

它由 SoloMD（原 Agent Recipes 驱动的扁平 Markdown 应用）**颠覆性重构**而来：**不背向后兼容包袱**，但
**以现有系统为基底、复用优先、最小新增**——颠覆的是产品形态与数据模型，不是工程架构。原 AI·Agent·Recipes
**不在 EIDON 范围内**（已物理删除，core/ai 留接口占位，见 §6 / ADR-0018/0019）。

### 1.2 技术栈

| 层 | 技术 | 位置 |
|----|------|------|
| 前端（纯 UI） | React 19 + TypeScript + Tailwind CSS v4 + Zustand v5 + shadcn/ui + lucide-react（electron-vite/Vite，见 ADR-0010） | `app/frontend/` |
| 桥接（契约边界） | 渲染侧 typed IPC 包装（`eidonInvoke` + 各域 + 平台 API） | `app/bridge/`（ipc） |
| 共享（数据模型） | 纯 TypeScript（框架无关，可在 Node 下单测；四层共用） | `app/shared/`（models / contracts / ipc / utils） |
| 后端（main 进程） | Electron main（Node）：壳 + IPC 接入 + 编排 + 业务规则 + 能力层（见 ADR-0025） | `app/backend/`（shell / ipc / services / domain / capabilities） |
| 接缝 | preload `contextBridge` 暴露 `window.eidon`（唯一 frontend↔backend 出口） | `app/preload/`、`app/bridge/ipc/` |
| 校验 | zod 运行时契约 + golden fixtures（见 ADR-0005/0014） | `app/shared/contracts/`、`fixtures/` |
| 构建/打包 | electron-vite（三进程一份配置）+ electron-builder（dmg/nsis/msi/deb/rpm） | `app/electron.vite.config.ts`、`app/electron-builder.yml` |
| 包管理 | pnpm（workspace 根在 `app/`） | `app/pnpm-workspace.yaml` |

### 1.3 常用命令

所有命令均可在**仓库根目录**执行（根 `package.json` 会代理到 `app/`）：

| 目的 | 命令 |
|------|------|
| 桌面开发（Electron，热重载） | `pnpm dev`（= `electron-vite dev`） |
| 类型检查（renderer + main/preload/shared） | `pnpm typecheck` |
| 类型检查 + 三进程构建 | `pnpm build`（= `pnpm typecheck && electron-vite build`） |
| Lint（强制四层【代码】边界，见 §2.1） | `pnpm lint` |
| 跑核心测试（shared + main 能力层） | `pnpm test:core` |
| 跑渲染层纯模块测试 | `pnpm test:ui` |
| 仅跑契约 conformance 测试 | `pnpm contracts:check` |
| 跑单个 TS 测试文件 | `pnpm --dir app exec vitest run shared/__tests__/<path>.test.ts` |
| 按用例名过滤 | `pnpm --dir app exec vitest run shared -t "<test name>"` |
| 打包桌面应用（当前 OS / 指定平台） | `pnpm dist` / `pnpm dist:mac` / `pnpm dist:win` / `pnpm dist:linux` |

提交前最低限度：`pnpm lint && pnpm typecheck && pnpm test:core`。改动磁盘契约时务必加跑 `pnpm contracts:check`。

---

## 2. 架构与边界

### 2.1 【代码】分层架构与单向依赖（最重要的约束，见 ADR-0025）

```
frontend (React UI 纯渲染) ─┐ 只 import bridge + shared + 运行时 window.eidon
bridge   (前后端契约边界)   ─┘──window.eidon(IPC)──▶ backend/ipc ──▶ backend/services ──▶ backend/{domain(注入端口) , capabilities(node:fs/iso-git/库)}
shared   (models 类型 + contracts zod + ipc 契约 + utils 纯函数)  ← 四层皆可 import（框架无关叶子）
```

- **单向调用链**：`frontend/` 只 import `bridge/` + `shared/` + 运行时 `window.eidon`，**禁** import `backend/*`、`preload`、`electron`；`bridge/` 只 import `shared/` + `window.eidon`，**禁** import `backend/*`、`electron`。
- **preload 是 frontend↔backend 唯一接缝**：`window.eidon`（typed IPC：`invoke<C>` + 事件 `on`）经 `preload/index.ts` contextBridge 暴露；渲染侧经 `bridge/ipc/*`（`eidonInvoke` + 各域包装）调用。
- **`@tauri-apps/*` 全局永久禁**。**`electron` 仅** `preload` 与 `backend/{shell,ipc}` 可用；`backend/{domain,capabilities,services}` 与 `frontend`/`bridge` 禁 `electron`（domain/capability 保持可单测、渲染只走 `window.eidon`）。
- **backend 内部单向级联**：`ipc → service → {domain, capability}`；`service` 组合 domain+capability（+emit）；`domain` 仅经注入端口 + shared（**禁** capability）；`capability` 只 `shared + emit + node:*/库`。
- **`shared/` 为框架无关叶子**：禁 `react`/`zustand`/`electron`；`models`(纯类型) / `contracts`(zod 单一事实源) / `ipc`(通道+事件契约) / `utils`(id/date/errors/path/reminders 纯函数)。
- **typed IPC 穷尽性**：`shared/ipc/channels.ts` 的 `IpcContract` 为每通道声明 `{req,res}`（当前 **85 通道**）；`backend/ipc/register.ts` 据全通道清单校验 handler 全覆盖（漏接即启动报错）。
- 以上由 `eslint-plugin-boundaries` + `no-restricted-imports` **机器强制**（`app/eslint.config.mjs`），CI 拦截。本地用 `pnpm lint` 验证。

### 2.2 源代码目录结构

```
app/
├── electron.vite.config.ts          # 三构建目标 main(backend)/preload/renderer(frontend) 一份配置
├── electron-builder.yml             # 打包（dmg/nsis+msi/deb/rpm；extraResources 字典）
├── tsconfig.json / tsconfig.electron.json / tsconfig.node.json  # renderer(frontend+bridge, DOM) vs node(backend+preload+shared, 无 DOM) vs 构建工具
│
├── frontend/                        # 【第一层 纯 UI】零业务逻辑（React 19 + Zustand，见 ADR-0010）
│   ├── main.tsx / App.tsx           # 入口（单 React root）/ 顶层编排壳
│   ├── components/ stores/ composables/ effects/ i18n/ lib/ styles/  # UI（FileTree/Editor/Preview/模板·节点·待办·日历 / EidonPet…）
│   │                                #   stores = UI 缓存（调 bridge，不跑 domain）；lib 含 cm-* 编辑器扩展/解析/导出触发/eidon-paths
│   └── global.d.ts                  # window.eidon: EidonApi（端到端供型）
│
├── bridge/                          # 【第二层 桥接】前后端契约边界（渲染侧运行，对后端唯一通道）
│   └── ipc/                         # client(eidonInvoke) + events + 各域包装(nodes/templates/todos/consistency/git/snapshots/dialog/clipboard/notification/opener/path/platform 平台面)
│
├── backend/                         # 【第三层 后端】全部后端逻辑（Electron main + Node）
│   ├── shell/                       # 壳：index(app.whenReady→注入路径/CSP/协议/菜单/IPC→建窗;单实例锁) + window / menu / lifecycle / protocol(eidon-asset://)
│   ├── ipc/                         # 接入：register(穷尽校验 85 通道) + emit + handlers/{editor,knowledge,git,shell,native,nodes,templates,todos,consistency}
│   ├── services/                    # 编排：workspace-store(注入端口的能力层实装) + {node,template,todo,consistency}-service
│   ├── domain/                      # 业务规则（注入端口,可单测）：nodes / templates / todos / consistency / snapshots / ai
│   └── capabilities/                # 底层资源（纯 node:*+库,禁 electron）：editor(file-ops/encoding/convert/pandoc/watcher) / knowledge / git(iso-git) / runtime-paths
│
├── shared/                          # 【共享层】框架无关叶子（四层皆 import；禁 react/zustand/electron）
│   ├── models/                      # 纯 TS 类型：实体/VO/注入端口 + wire 形状（统一 camelCase，见 ADR-0025）
│   ├── contracts/                   # zod 磁盘契约（单一事实源，见 ADR-0005/0014）
│   ├── ipc/                         # 【typed IPC 单一事实源】channels(IpcContract, 85) / events
│   └── utils/                       # 纯函数：id(ULID)/date/errors/path/reminders
│
├── preload/                         # contextBridge —— frontend↔backend 唯一接缝（CJS，sandbox）
│   └── index.ts                     # exposeInMainWorld('eidon', {invoke,on,getPathForFile})
│
└── resources/                       # 打包随附（electron-builder extraResources）
    ├── dicts/en_US.{aff,dic}        # 拼写词典（生产经 process.resourcesPath/dicts 解析）
    └── icons/                       # icns / ico / png
```

> **能力层保持纯 node（ADR-0025）：** `backend/capabilities/**` 只用 `node:*` + 库（无 electron），便于单测；
> electron-only 的壳/IPC 留在 `backend/{shell,ipc}` 与 `preload`。
> domain 业务规则在 `backend/domain/`（注入端口，可单测）；类型/契约在 `shared/`。

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
└── .eidon-encrypted/                 ← 启用端到端加密时的影子 git 库（gitignored）
```

含 `.node/` 子目录者为**结构节点**，不含者为**普通文件夹**；两者本期共存（见 §3）。

---

## 3. EIDON 数据层【本期新建】

> 规划全文见 `speculo/.speculo/dev/eidon-base-roadmap/`（context-map / decision-log / roadmap）。
> 落点为 `backend/domain/` 四个并列业务模块（ADR-0012），各自 `index.ts`、禁 UI 框架、不互 import 内部。

### 3.1 固定三层【节点】拓扑 + 深度=层级铁律（ADR-0013）

- **深度=层级**：workspace 根下第 1/2/3 层**节点**目录 = L1/L2/L3，第 4 层起为自由文件夹（无身份）。层级由物理位置唯一确定。
- **创建期硬强制（零妥协）**：通过 EIDON 只能按 `根→L1(选模板) / L1下→L2 / L2下→L3 / L3下→自由` 创建；UI **不存在**越级创建入口。
- **文件白名单**：L1/L2 为纯组织层（仅 `.node/`+`README.md`+`AGENTS.md`+下级节点，无内容文件）；L3 为唯一内容承载层。
- **节点身份**：ULID（复用 `core/shared/id`），存 `.node/node.json`，随目录移动；删缓存可遍历重建 id→path。

### 3.2 多模板 schema（ADR-0013，schema 在「设置」内创建管理）

- 模板 = 三层各自的名字 + 字段集，捆绑为一体，**版本化不可变**，存 `.eidon/templates/{id}/L{n}.{name}.v{ver}.json`。
- **整体 L1/L2/L3 的 schema 规范在「设置」面板内创建新建 / 编辑 / 删除 / 版本管理**（`TemplateManager`，数据由 `backend/domain/templates` + `backend/services/template-service` 提供）。
- 字段类型仅 6 种：`text` `textarea` `number` `date` `select` `boolean`。
- schema 二分：**元字段**（id/templateId/level/type/schemaVersion/createdAt/flags，固定、用户不可增删）+ **扩展字段**（模板定义、可扩展、懒迁移）。
- 内置默认模板（档案/项目/资料）仅首次初始化写入的普通文件，之后与用户模板完全平级（可编辑/删除）。

### 3.3 磁盘契约统一规范化（ADR-0005/0014）

- `.node/node.json` + `.eidon/templates/*` template schema + `.eidon/` 系统区布局，一律纳入 `shared/contracts/`（zod 单一事实源）+ `fixtures/contracts/` golden fixtures。
- **改形状先改 zod + fixtures，再改解析。** fixtures 红即代表破坏「删缓存 → 从 `.node/`+`.eidon/templates/` 100% 重建节点树」一致性。
- node.json 预留 `references:[]` / `flags:{}`（本期空值），契约层先定形状，为后续零成本衔接。

### 3.4 版本 / diff = 直接用现有 git（ADR-0015）

- **以现有系统为基底：版本历史 / diff 对比 / 恢复直接用现有 git** 的 log/diff/checkout（auto-commit 历史 + `history.commitNow` + HistoryPanel，`backend/capabilities/git/history.ts`，基于 isomorphic-git）。
- **autoGit 无需任何修改，本期不实现任何「快照功能」**：不建 `.eidon/snapshots.git`、不做保存/快照解耦、不做路径↔ID 补偿。`backend/domain/snapshots` 仅薄封装现有 git bridge，不新增逻辑。ADR-0023 审慎扩展了修剪能力（控制历史膨胀）。
- 消歧：此「git 版本」= 普通编辑的 auto-commit 历史，与旧 Agent Recipes 的 AutoGit 分支沙箱无关（不在范围）。

### 3.5 结构强制 + 违规标记（ADR-0016，`backend/domain/consistency`）

- 第一道防线 = 创建期硬强制（§3.1）。第二道 = 打开/扫描时 `backend/domain/consistency` 检测四类**结构违规**并在 FileTree 打徽标：
  ① 前三层出现普通文件夹（无 `.node/`）→「待提升」；② L1/L2 出现内容文件 →「位置非法/待下沉」；③ 节点深度与 `level` 不符 →「层级不符」；④ `.node/` 缺失/损坏 →「结构待修复」。
- **只读、不阻塞、不自动改**。整改 = 用户点击触发（主入口「提升为节点」/ 手动移动 / 删除 / 重建）。
- **本期不做**：软态身份系统（outOfPlace/orphan/disconnected）、自动补全、自动整理、独立一致性面板、回收站三关——留后续在 `backend/domain/consistency` 与现有删除之上叠加。

### 3.6 复用基底能力地图（现有，收编进新地基）

| 能力 | 复用现有 | EIDON 侧动作 |
|------|---------|-------------|
| Markdown 编辑/预览/大纲 | CodeMirror 栈（`Editor`/`Preview`/`Outline`） | 内容编辑入口仅在 L3 |
| 失焦自动保存 | `autoSaveDirtyTabs`（on blur） | 复用 |
| 版本/历史/diff/恢复 | git 版本历史（`backend/capabilities/git/history.ts` + HistoryPanel） | `backend/domain/snapshots` 仅薄封装（ADR-0015） |
| 外部修改刷新 | watcher | 复用 |
| 全文搜索 | `GlobalSearch` + `backend/capabilities/knowledge/search.ts` | 复用（可选叠加按节点/模板/层级/字段过滤） |
| 删除 | FileTree 直接删除（当前无回收站） | 复用 |
| 文件树 | `FileTree.tsx` | **改造为节点感知** |

> **超前实现边界（ADR-0011）：** 除 AI·Agent·Recipes 整块外，已存在且对结构化知识 IDE 有价值的能力（编辑器、搜索、版本、backlink/daily-notes 等）可保留并超前实现，不为分期人为隐藏。

---

## 4. 二次开发指南

### 4.1 四类扩展的唯一落点（见 ADR-0025/0012）

`backend/domain/` 业务规则 + `backend/services/` 编排为各类扩展定了唯一落点（前端经 `bridge/ipc` 调用）：

1. **新增节点能力**（身份/CRUD/扫描/提升）→ `backend/domain/nodes` + `backend/services/node-service`。
2. **新增模板/字段能力**（schema/版本/类型）→ `backend/domain/templates` + `template-service`；新增字段类型平滑扩展。
3. **新增版本/历史能力** → `backend/domain/snapshots`（薄封装 git 网关，勿另造快照系统，ADR-0015）。
4. **新增一致性检测** → `backend/domain/consistency` + `consistency-service`。
5. **新增其它功能域** → `backend/domain/` 建业务规则（注入端口、禁 UI/electron）+ `backend/services/` 编排；如需底层资源在 `backend/capabilities/` 建对称模块；再 `shared/ipc/channels` 加通道 + `backend/ipc/handlers/*` 接线 + `bridge/ipc/*` 前端包装（见 ADR-0025）。

### 4.2 磁盘契约改动流程（机器强制，见 ADR-0005/0014）

改 `node.json` / template / `.eidon` 形状：**先改 `shared/contracts/*.ts`（zod）+ `fixtures/contracts/` golden fixtures，再改解析**。`pnpm contracts:check` 红即代表破坏扫描重建一致性，CI 拦截。

### 4.3 typed IPC 接口（见 ADR-0025）

前端不直接 `ipcRenderer`/`electron`；只经运行时全局 `window.eidon`（由 `bridge/ipc/*` 包装）。新增能力五步：
① `shared/ipc/channels.ts` 的 `IpcContract` 加通道 `{req,res}`（并补全 `CHANNEL_PRESENCE` 清单，编译期 + 启动期穷尽）；
② `backend/capabilities/<域>` 加纯 node 实现（无 electron）/ `backend/domain/<域>` 加业务规则（注入端口）；
③ `backend/services/<域>-service` 编排（构造 `workspace-store` → 调 domain → 过 `shared/contracts` → emit）；
④ `backend/ipc/handlers/<域>.handlers.ts` 把通道接到 service，并在 `backend/shell/index` 注册；
⑤ `bridge/ipc/<域>.ts` 加前端包装（`eidonInvoke('<域>:<动作>', req)`），store/组件调它。
事件（`eidon:*`）经 `backend/ipc/emit` 的 `webContents.send` 推送，前端 `bridge/ipc/events.listen` 订阅。
`.node/` 读写、目录遍历经 `backend/capabilities/editor/file-ops`（domain 经注入端口 `backend/services/workspace-store`）。

### 4.4 不可逾越约束（全程遵守）

1. 单向依赖 `frontend→bridge→backend(ipc→service→{domain,capability})+shared`；`preload`(`window.eidon`) 唯一 frontend↔backend 接缝；`@tauri-apps/*` 全局禁；`electron` 仅 preload + backend shell/ipc；`shared`/`capabilities` 禁 UI 框架。
2. 业务规则（`backend/domain/*`）经注入网关解耦系统边界；旧 AI 子系统模块已物理删除，AI 占位类型在 `shared/models/ai.ts`、空实现在 `backend/domain/ai.ts`（`isAiAvailable` 恒 false）。
3. 改磁盘契约形状先改 zod + fixtures；改 IPC 形状先改 `shared/ipc/channels` + handler（穷尽校验）。
4. 「三层」禁裸用，每处显式限定【代码】或【节点】。

---

## 5. 可重建铁律与非功能约束

| 编号 | 要求 |
|------|------|
| 可重建 | 删 `.eidon/` 索引缓存后，遍历 `.node/` + `.eidon/templates/` 100% 重建节点树/身份/字段/id→path（产品层 AX-1/AX-4，每阶段末回归） |
| 性能 | 万级文件 workspace 可用；打开扫描可增量、后台、不长时间阻塞 |
| 离线 | 完全离线可用，无任何联网依赖（AI·Agent·Recipes 已物理删除，见 ADR-0019） |
| 可迁移 | 拷贝 workspace 到另一台机器，模板/`node.json`/内容完整自包含（git 历史属本机缓存除外） |
| 跨平台 | Windows / macOS / Linux（Electron；仅桌面端，已删移动端） |

---

## 6. 已删除：AI·Agent·Recipes（见 ADR-0018/0019）

原 SoloMD 的 **AI·Agent·Recipes**（AI 对话 / 自动化 Recipes / cron·事件触发 / AutoGit 分支沙箱 / RAG / capture / REST / MCP / cloud）已于 2026-06 物理删除。

### 删除清单

| 层 | 删除内容 |
|----|---------|
| Core TS | `core/agent/`、`core/recipes/`、`core/trace/`、`core/pricing/`；`core/ai/` 除占位外全部 |
| Bridge | ai / keychain / agent-tools / cookbook / recipes / run / trace / triggers / search 九个包装文件 |
| Contracts | `core/contracts/` 下 recipe / run-meta / trace |
| 前端 | ~15 组件 + 4 stores + 2 lib 文件 |
| i18n | 10 个命名空间（integrations / recipes / ai / rag / rest / wizard / cookbook / cost / agentSettings / agent） |
| CSS | 12 个组件区块（~1,300 行） |
| 依赖 | 7 个仅 AI 子系统使用的原生依赖（已删） |
| 测试 | 7 个测试文件 + 1 个 fixtures 目录 + 3 个契约 golden fixtures |

### 占位契约

AI 占位分两部分，为未来接入其他 AI 预留空间：

- **`shared/models/ai.ts`**（纯类型，零依赖）：导出 `ApiFormat`、`ChatMessage`、`AiProviderConfig`、`StreamEvent`/`StreamHandler`、`ChatLoopRequest`/`ChatLoopResult` 类型（与原实现同形）；`AiNotConnectedError` 错误类。
- **`backend/domain/ai.ts`**（空实现）：`isAiAvailable(): boolean` 恒 false；`runChatLoop(request, onEvent)` 保留原签名、立即抛 `AiNotConnectedError`。
- 未来接入步骤：① 在 `backend/domain/ai` 实现 provider 构造+流解析 → ② 如需新原生能力按 §4.3 加 IPC 通道+能力 → ③ 翻转 `isAiAvailable` → ④ 四层【代码】边界不变。

### 保留物

- `frontend/lib/clean-ai.ts` + useCommands 的 `clean.aiArtifacts`（纯本地文本清理，不调 AI）
- i18n 四键：`toolbar.cleanAi/cleanAiTitle`、`toast.aiCleaned/noAi`
- GitHub 同步 / E2EE 加密模块（如已实现）的每设备同步·加密态存于 `.eidon-sync/` + `.eidon-encrypted/`（原 `.solomd/` 已于 ADR-0022 全量改名；pre-launch 无迁移垫片）

### 找回路径

全部删除内容在 git 历史中完整保留。删除 commit 哈希见 ADR-0019 头部。浏览历史：
```
git log -- app/core/ai/ app/core/agent/ app/core/recipes/
git show <删除 commit>^:app/core/ai/chat-loop.ts
```

---

## 7. ADR 索引（工程层，登记表见 `adr/README.md`）

| 轨道 | ADR |
|------|-----|
| 工程基座 | 0005（磁盘契约接缝）· 0010（UI=React 19） |
| EIDON 2.0 数据层 | 0011（颠覆性重构·以现有系统为基底）· 0012（四模块落点）· 0013（三层节点拓扑+多模板）· 0014（磁盘契约统一）· 0015（版本/diff 用现有 git）· 0016（结构强制+违规标记）· 0017（改名 + `.eidon` 系统区，由 0022 扩展）· 0018（AI·Agent·Recipes 不在范围，由 0019 接替）· 0019（物理删除 AI 子系统，留接口占位） |
| 节点功能 + 改名收尾 | 0020（todos + 提醒 + 通知子系统）· 0021（像素宠物「小芽」品牌/交互层）· 0022（solomd→eidon 全量改名）· 0023（git 历史修剪能力，审慎扩展 0015） |
| 架构 | **0025（frontend→bridge→backend+shared 单向四层，当前【代码】架构权威）** |

> **已删除编号**：0001/0009（早期平台实现前提，经 0025 失效）；0024（平台/构建栈迁移记录，平台事实并入 §1.2）；0002/0003/0004/0008（旧 AI·Agent·Recipes 子系统，不属 EIDON 范围）；**0006/0007**（已被 0025 取代）。编号留空不复用（内容见 git 历史）。
> **ADR-0025** 定义四层单向【代码】架构，为当前架构权威参考。
> **产品层 ADR** = `temp/EIDON_数据层架构决策记录_ADR.md` 的 `ADR-001~013` + `AX-1~5`（愿景源）；引用须标来源轨道。
