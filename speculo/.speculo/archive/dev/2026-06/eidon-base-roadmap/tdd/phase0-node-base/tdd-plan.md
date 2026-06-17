> **服务工作流：** `../03-tdd/03-tdd.md`
> **产物文件名：** `tdd-plan.md`

# TDD Plan — 阶段0·节点地基

> **本轮范围（与用户确认）：** 仅 roadmap **阶段0·节点地基**（不可回退、最先、PRD 最高风险不变量=可重建性）。模板管理行为（`core/templates` 版本化/种子/设置 UI）、节点 CRUD、一致性检测、改名等留后续 TDD run。
> **ULID 方案（与用户确认）：** 引入 `ulid` 包，`core/shared/id` 仅薄封装。
> **「三层【代码】/三层【节点】」消歧：** 本轮只动 `三层【代码】` 的 `core/` 层；产出的是 `三层【节点】` L1/L2/L3 的契约与扫描内核。

## 切片来源

来自 **PRD**（`prd.md`）+ **roadmap 阶段0**（`roadmap.md` §3 阶段0）。对齐 PRD：FR-DATA-1/2/3/5/7、"Treat disk contracts as the first implementation surface"、最高风险不变量 = rebuildability（AX-1/AX-4）。受约束 ADR：工程层 **0014**（磁盘契约统一·改形状先改 zod+fixtures）、**0012**（`core/` 四模块·各自 index.ts·禁 UI·互不 import 内部·不 import 旧 AI）、**0013**（深度=层级 + ULID 身份 + 多模板）、**0011**（以现有系统为基底·复用优先）。

## 公共接口

> 词汇与现有代码一致：契约用 `*Schema` zod + `z.infer` 导出类型（仿 `contracts/recipe.ts`）；身份函数仿 `shared/id.ts` 的 `createRunId`/`isRunId`；conformance 测试仿 `__tests__/contracts/*.conformance.test.ts`（`readFile` + `resolve(import.meta.dirname, "../../../../fixtures/contracts/…")`）。

1. **`core/contracts` 扩展**（zod 单一事实源，导出经 `contracts/index.ts`）
   - `NodeSchema` / `Node` —— `.node/node.json` 形状。**元字段**（固定）：`id`(ULID)、`templateId`、`level`(1|2|3)、`type`、`schemaVersion`、`createdAt`(ISO)、`flags`(record, 默认 `{}`)；**扩展字段**：`fields`(record，模板定义的字段值)；**前向预留**：`references`(array，默认 `[]`)。`level` 用 `z.union([z.literal(1),z.literal(2),z.literal(3)])`。
   - `TemplateSchema` / `Template` —— 一套三层【节点】模板：`id`、`name`、`version`、`schemaVersion`、三层【节点】 `L1/L2/L3` 各 `{ name, fields: FieldDef[] }`。`FieldDefSchema`：`key`、`label`、`type`(6 类枚举 `text|textarea|number|date|select|boolean`)、`options?`(select 用)、`required?`。
   - `.eidon/` 布局契约 —— 模板文件路径 `L{n}.{name}.v{ver}.json` 的构造/解析 helper（如 `templateFilePath(id, level, name, ver)` / `parseTemplateFileName`）+ 形状校验。轻量，仅钉死磁盘路径约定。
2. **`core/shared/id` 扩展**（复用现有文件，新增 ULID）
   - `createNodeId(): string` —— ULID（薄封装 `ulid` 包）。
   - `isNodeId(value: string): boolean` —— 校验 Crockford base32 / 长度。
   - （保留既有 `createRunId`/`isRunId` 不动。）
3. **`core/nodes` 新模块**（`core/nodes/index.ts` 唯一出口，禁 UI 框架，不 import 旧 AI / 其它模块内部）
   - `scanWorkspace(reader: WorkspaceReader): Promise<NodeTree>` —— **深模块**：小接口（一个注入的目录读取器），深实现（遍历→识别 `.node/`→**深度=层级**判定→`NodeSchema` 解析→建树 + `id→path` 映射）。
   - `WorkspaceReader` —— 注入依赖接口（`listDir(relPath)` / `readFile(relPath)` 等纯异步读）。生产环境由 `core/bridge` 经 `editor/file_ops` 实现；测试用真实临时目录（node:fs）实现，**不 mock 内部协作者**。
   - `NodeTree` —— 返回 `{ nodes: Node[]; idToPath: Map<string,string>; pathToId: Map<string,string> }`（只读结果对象，无副作用）。

## 行为优先级

按测试优先级从高到低（追踪弹式垂直切片，一条测试→一条实现）：

1. **node.json 契约可解析 golden fixture**（最高·契约先行，ADR-0014）：`NodeSchema.parse(golden)` 往返，元字段齐、`references` 默认 `[]`、`flags` 默认 `{}`。
2. **ULID 身份**：`createNodeId()` 产出合法且可字典序排序（时间前缀单调），`isNodeId` 真/假分支正确，与 `NodeSchema.id` 对齐。
3. **template schema 契约**：解析含 6 类字段的 golden 模板 fixture；`.eidon` 路径 helper 与文件名往返一致（`templateFilePath`↔`parseTemplateFileName`）。
4. **扫描建树**：对一份多节点 fixture workspace，识别 `.node/`、由**物理深度推导 level**、解析 node.json，产出正确的 `nodes` 与 `idToPath`（隐藏 `.node/` 自身、第 4 层起不计为节点）。
5. **删缓存重建（AX-1/AX-4，回归铁律）**：清空运行时索引缓存后再 `scanWorkspace`，得到的节点树/身份/字段/`id→path` 与首次 **100% 一致**——真理源只有 `.node/` + `.eidon/templates/`。

> **不在本轮（防越界）：** 四类结构违规检测与标记（属 `core/consistency`，阶段3）；节点 CRUD/提升/移动（阶段2）；模板版本化写入/种子/孤儿态/设置 UI（`core/templates`，阶段1）；任何 Rust 新增（先复用 `editor/file_ops`，仅性能不足时按 ADR-0009 加 `scan` 原子命令）。本轮 `level` 与物理深度不符时**只按深度推导、不做违规判定**（违规检测留阶段3）。

## 第一个 Tracing Slice

**切片①：`node.json` golden-fixture conformance（最薄的磁盘契约端到端）。**

- **失败信号（RED）：** 新增 `fixtures/contracts/node.l3.json`（一份合法 L3 节点 golden）+ `core/__tests__/contracts/node.conformance.test.ts`，`import { NodeSchema } from "../../contracts"` 并 `NodeSchema.parse(JSON.parse(raw))`。运行即失败——`NodeSchema` 未定义（导入/类型错误）。
- **成功判据（GREEN）：** 新增 `core/contracts/node.ts` 定义 `NodeSchema`，在 `core/contracts/index.ts` 加 `export * from "./node"`；测试转绿：断言 `parsed.level === 3`、`parsed.id` 为 ULID、`parsed.references` 默认 `[]`、`parsed.flags` 默认 `{}`、`parsed.fields` 为对象。
- **重构（REFACTOR）：** 抽出 `LevelSchema`/`FieldValueSchema` 等共享小枚举，命名与 roadmap §3.1/§3.2 术语对齐；保持接口表面积最小。
- **验证：** `pnpm contracts:check`。
- **为什么是它：** PRD 明定「契约是第一实现面」，ADR-0014 要求改形状先改 zod+fixtures；此切片确立后续 ULID / 模板 / 扫描 / 重建全部据以解析的地基，且失败信号清晰、表面积最小。

**后续切片序列（每条：一测→一实现→重构→验证；不批量预写）：**

- 切片② ULID 身份（`core/shared/id` + `ulid` 依赖）→ 回填 `NodeSchema.id` 用 `isNodeId` 精化。
- 切片③ `TemplateSchema` + `.eidon` 布局 helper + golden 模板 fixture + conformance。
- 切片④ `core/nodes` `scanWorkspace`（注入 reader，临时目录 fixture workspace，深度=层级 + id→path）。
- 切片⑤ 删缓存重建回归（AX-1/AX-4）→ 进入 Finish 收尾。

## 验证命令

- `pnpm contracts:check` —— 契约 conformance（= `vitest run core/contracts core/__tests__/contracts`），切片①③后必跑。
- `pnpm test:core` —— 全部 TS core 测试（= `vitest run core`），含 `core/nodes` 扫描/重建测试。
- `pnpm lint` —— 三层【代码】边界（`core/` 禁 UI 框架、`core/nodes` 不 import 旧 AI / 其它模块内部、`core/bridge` allowlist 维持 0）。
- 单文件定位：`pnpm --dir app exec vitest run core/__tests__/contracts/node.conformance.test.ts`；按名过滤：`pnpm --dir app exec vitest run core -t "<test name>"`。
- 阶段末：跑「删缓存→重建」回归（切片⑤）作为 AX-1/AX-4 验收。

## 接口设计 / 深模块 / mock 注记

- **深模块（`core/nodes`）：** 小接口 `scanWorkspace(reader)`，把遍历/识别/深度判定/解析/建图的复杂度全部藏在实现里；调用方只见 `NodeTree`。（《APoSD》深模块原则。）
- **接受依赖而非自造（可测性）：** `WorkspaceReader` 作为注入参数——生产接 `core/bridge`(`editor/file_ops`)，测试接 node:fs 临时目录。**返回结果对象、无副作用**，便于断言。
- **测试集成式、勿测实现细节：** 经公共 API（`NodeSchema.parse` / `scanWorkspace`）断言可观察行为（解析结果、节点树、id→path、重建一致），**不 mock 内部协作者、不断言遍历顺序/调用次数**。扫描测试用**真实临时目录**跑真实代码路径，最贴合 `tests.md` 的「集成式好测试」。

## 已知缺口 / 落地注意（实现期处理）

- `core/shared/id.ts` 现仅有 `createRunId`，**无 ULID**——切片②需 `pnpm --dir app add ulid` 并新增 `createNodeId`/`isNodeId`（保留 runId 不动）。
- 测试目录约定沿用现有 `core/__tests__/<domain>/`（已有 `contracts/`）；`core/nodes` 测试放 `core/__tests__/nodes/`，由 `pnpm test:core` 覆盖。
- golden fixtures 落 **仓库根** `fixtures/contracts/`（现有旧 AI fixture 同处），路径相对 `app/core/__tests__/contracts` 为 `../../../../fixtures/contracts/…`。
- node.json 的 `type` 取值、内置模板字段集为**产品层 ADR / 阶段4(O-3)** 终定——本轮 golden fixture 钉一个具体示例即可，**契约形状现在锁死**，值后续可演进。
