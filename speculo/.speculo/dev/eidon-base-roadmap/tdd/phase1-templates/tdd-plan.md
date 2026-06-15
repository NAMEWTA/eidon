> **服务工作流：** `../03-tdd/03-tdd.md`
> **产物文件名：** `tdd/phase1-templates/tdd-plan.md`（阶段0 见 `../phase0-node-base/`）

# TDD Plan — 阶段1·多模板 schema

> **本轮范围（阶段1原始边界）：** roadmap **阶段1·多模板 schema 的 `core/templates` 数据层**。设置内 React `TemplateManager` UI + templates store 已在后续阶段接上，本文件保留阶段1 TDD 切片设计。
> **内置种子（最终状态）：** 三套 `档案/项目/资料`（PRD US3 定名），各 L1/L2/L3 字段集已定稿在 `BUILTIN_TEMPLATE_SEEDS`（6 类字段覆盖）。首次初始化写入、之后与用户模板**平级**可改可删。
> **依赖前序：** 阶段0 已交付 `TemplateLayerSchema` / `templateLayerPath` / `parseTemplateLayerFileName` / `EIDON_TEMPLATES_DIR` / `Level`（`core/contracts`）、`createNodeId`（`core/shared/id`）—— 本轮直接复用，不改其形状。
> **「三层【代码】/三层【节点】」消歧：** 只动 `三层【代码】` 的 `core/templates`；产出的是 `三层【节点】` L1/L2/L3 的模板 schema 管理能力。

## 切片来源

来自 **PRD**（US-2/3/4/5/6 + Testing Decisions `core/templates`）+ **roadmap 阶段1**。对齐 PRD FR-WS-1、FR-TPL-1/2/3，产品层 ADR-005/010。受约束工程层 ADR：**0012**（`core/` 四模块·各自 `index.ts`·禁 UI·互不 import 内部·不 import 旧 AI）、**0013**（多模板 = 三层【节点】名字+字段、6 类型、版本化不可变）、**0014**（磁盘契约统一·写盘前过 zod）、**0017**（`.eidon` 系统区）。

## 公共接口

> 沿用阶段0 的「注入依赖、纯函数、深模块」范式。阶段0 扫描只读（`WorkspaceReader`）；阶段1 **首次写盘**，故注入一个**可写 store 抽象 `TemplateStore`**（生产接 `core/bridge`/`file_ops`，测试用 node:fs 临时目录）。模块独立性优先：`TemplateStore`/`DirEntry` 在 `core/templates` 内自定义，不 import `core/nodes`（仅 2 字段接口的轻微重复换取四模块互不耦合）。

1. **`core/templates/index.ts`（新模块，唯一出口；禁 UI；只 import `core/contracts`(index) 与 `core/shared/id`）**

   - `TemplateStore`（注入依赖，系统边界·可写）：
     - `listDir(relPath): Promise<DirEntry[]>` · `readFile(relPath): Promise<string>` · `writeFile(relPath, contents): Promise<void>` · `remove(relPath): Promise<void>`（删文件/目录）· `exists(relPath): Promise<boolean>`。
     - `DirEntry = { name: string; isDir: boolean }`。路径均为 workspace 相对 POSIX。
   - 聚合类型 `Template`（运行时三层【节点】捆绑视图，非磁盘单元）：`{ templateId; version; layers: Record<Level, TemplateLayer> }`（`TemplateLayer` 来自 `core/contracts`）。
   - `initWorkspaceTemplates(store): Promise<{ initialized: boolean; templateIds: string[] }>` —— 首次使用初始化：`.eidon/templates/` **不存在** → 写三套内置种子（每套 L1/L2/L3 各一 v1 文件）；**已存在** → no-op（写一次性 / 删过不复活，目录级 guard）。
   - `listTemplates(store): Promise<Template[]>` —— 读 `.eidon/templates/`，按 `templateId` 分组、取每个模板**最新版本**的三层【节点】定义，组装 `Template[]`（按 templateId 稳定排序）。
   - `getTemplate(store, templateId, version?): Promise<Template | null>` —— 取指定（默认最新）版本的三层【节点】定义；不存在返回 `null`。
   - `createTemplate(store, input): Promise<Template>` —— `input = { layers: Record<Level,{name; fields: FieldDef[]}> }`；生成 `templateId=createNodeId()`、`version=1`、`schemaVersion=1`；**写盘前过 `TemplateLayerSchema`**（含 select 必带 options 的 superRefine）；用 `templateLayerPath` 写三个不可变文件。
   - `editTemplate(store, templateId, input): Promise<Template>` —— 读最新版 → 应用新三层【节点】名字/字段 → 以 `version+1` 写**新版本**文件，**旧版本文件原样不动**（旧节点按其 `schemaVersion` 继续有效）。
   - `deleteTemplate(store, templateId): Promise<void>` —— `remove(.eidon/templates/{templateId})` 删全部版本 → 进入**孤儿模板态**；节点 `node.json.fields` 是裸键值（阶段0 已定），不依赖模板、删后不丢。

2. **内置种子常量**（模块内私有，最终字段集）：`BUILTIN_TEMPLATE_SEEDS`（档案/项目/资料三套三层【节点】定义）。阶段4 已用端到端验收覆盖 `.eidon/templates/` 自包含重建。

## 行为优先级

按测试优先级从高到低（追踪弹式垂直切片，一测→一实现）：

1. **创建→列出往返（写盘原语 + 校验）**：`createTemplate` 写自定义三层【节点】模板（自定名字 + 覆盖 6 类字段），`listTemplates` 读回一致；多套并存平级；**非法（select 无 options）写盘前被拒**。
2. **首次初始化 + 写一次性**：`initWorkspaceTemplates` 首次写入 档案/项目/资料；再次调用 no-op（不重写、不报错）。
3. **删除 + 删过不复活**：`deleteTemplate` 删模板后 `listTemplates` 不再含它；**再 `initWorkspaceTemplates` 不复活**被删的内置模板（目录级 guard）。
4. **版本化不可变编辑**：`editTemplate` 生成 v2、`getTemplate(id)` 取到 v2；`getTemplate(id, 1)` 仍是**原始 v1**（旧版字节不变 → 旧节点 schema 不乱）。
5. **端到端验收 + 收尾**：init 内置 → 自建一套并存 → 编辑某套→新版旧版并存 → 删一套→重列 → 重新 init 不复活；落 `verification.md`。

> **阶段1 当时不展开（最终已补齐处）：** 设置内 React `TemplateManager` UI 与 templates/nodes store 已在 phase2/phase4 接线；模板↔节点字段表单渲染已由 `NodeInspector` 完成；生产 `TemplateStore` 已通过 `createWorkspaceFileStore` 复用 `file_ops`；内置字段集已在 phase4 定稿；任何 Rust 新增仍未引入。

## 第一个 Tracing Slice

**切片① · `createTemplate` → `listTemplates` 往返（最薄的写+读端到端）。**

- **失败信号（RED）：** 新增 `core/__tests__/templates/templates.test.ts`，`import { createTemplate, listTemplates } from "../../templates"` 并对 node:fs 临时目录 store 调用。运行即失败——`../../templates` 模块不存在 / 函数未定义。
- **成功判据（GREEN）：** 新增 `core/templates/index.ts`：`TemplateStore`/`DirEntry`/`Template` + `createTemplate`（`createNodeId` + `TemplateLayerSchema` 校验 + `templateLayerPath` 写三文件）+ `listTemplates`（读分组取最新版）。测试转绿：创建自定义模板后 `listTemplates` 返回含其三层【节点】名字/字段；select 无 options 的输入 `createTemplate` 抛错。
- **重构（REFACTOR）：** 抽出私有 `writeLayer`/`readLayersOf` helper；保持公共接口最小。
- **验证：** `pnpm test:core`（templates 用例）+ `tsc --noEmit`。
- **为什么是它：** 写+读往返是阶段1 一切（init/version/delete）的底座原语；先钉死「写盘过契约、读回一致」，init 用同一原语组合内置种子、edit 复用写盘、delete 复用 remove。失败信号清晰、表面积最小。

**后续切片序列（每条：一测→一实现→重构→验证；不批量预写）：**

- 切片② `initWorkspaceTemplates` 首次种子 + 写一次性（no-op 守卫）。
- 切片③ `deleteTemplate` + 重新 init 不复活。
- 切片④ `editTemplate` 版本化不可变（v2 生效、v1 原样）。
- 切片⑤ 端到端验收（init→自建并存→编辑→删除→重 init）+ 收尾 `verification.md`。

## 验证命令

- `pnpm test:core` —— 全部 TS core 测试（= `vitest run core`），含 `core/__tests__/templates/*`。
- `pnpm contracts:check` —— 契约 conformance（阶段0 契约不变，回归确认未破）。
- `pnpm --dir app exec tsc --noEmit` —— 类型检查。
- `pnpm lint` —— 边界（`core/templates` 禁 UI、不 import 旧 AI / 其它模块内部、bridge allowlist=0）。
- 单文件定位：`pnpm --dir app exec vitest run core/__tests__/templates/templates.test.ts`。

## 接口设计 / 深模块 / mock 注记

- **深模块（`core/templates`）：** 小接口（init/list/get/create/edit/delete 6 个函数 + 注入 `TemplateStore`），把「分组取最新版 / 版本号推进 / 文件名编解码 / 校验」复杂度藏在内部。
- **接受依赖而非自造（可测 & 系统边界 mock）：** 文件系统是系统边界——经 `TemplateStore` 注入（mocking.md：边界处用依赖注入 + SDK 风格专用方法，非通用 fetcher）。生产接 bridge/`file_ops`，测试用 node:fs 临时目录跑真实代码路径，不 mock 模块内部协作者。
- **测试集成式、勿测实现细节：** 经公共 API（create/list/get/edit/delete）断言可观察行为（列出内容、版本并存、删后不复活），**不断言写了几次文件 / 文件字节细节作为主断言**。
- **契约先行（ADR-0014）：** 所有写盘对象先过 `TemplateLayerSchema`；模板磁盘形状/路径沿用阶段0 契约，不在本轮改形状（如需改，先改 zod+fixtures）。

## 已知缺口 / 落地注意（实现期处理）

- `core/bridge/file.ts` 现有 `fileRead/fileWrite`（`agent_tool_*` 封装），**无 delete/listDir/exists**；生产 `TemplateStore` 实装需在 bridge 补 typed wrapper + 对应 Rust 命令（属随 UI 轮，不在本轮）。本轮只定义 `TemplateStore` 接口 + node:fs 测试实现。
- 测试目录沿用 `core/__tests__/<domain>/`，新增 `core/__tests__/templates/`，由 `pnpm test:core` 覆盖。
- 写一次性 guard 用 `.eidon/templates/` 目录存在性判定（最简、满足「再开不重复初始化」+「删过不复活」）；若用户整块删除 `.eidon/templates/` 则视为重新首次化（可接受）。
- 内置种子字段集已在 phase4 定稿；若未来调整，只需改种子常量 + 相应测试期望，公共接口不变。
- 模板 `templateId` 复用 `createNodeId()`（ULID），与节点同一身份体系。
