> **服务工作流：** `../03-tdd/03-tdd.md`
> **产物文件名：** `implementation-log.md`

# Implementation Log — 阶段0·节点地基

> 切片来源 PRD + roadmap 阶段0。每轮：RED（公共接口失败测试）→ GREEN（最少实现）→ REFACTOR（仅绿态整理）→ 验证。不预实现未来切片，不以实现细节做主要断言。

## 循环记录

### 切片① · node.json zod 契约 + golden fixture + conformance ✅
- **行为：** `.node/node.json` 可被 `NodeSchema` 解析（元字段齐全、`references` 默认 `[]`、`flags` 默认 `{}`、越界 `level` 拒绝）。
- **RED：**
  - 测试：`core/__tests__/contracts/node.conformance.test.ts` —— `accepts the golden L3 node fixture` / `defaults references and flags when absent` / `rejects an out-of-range level`；golden `fixtures/contracts/node.l3.json`。
  - 失败信号：`TypeError: Cannot read properties of undefined (reading 'parse')`（`NodeSchema` 未定义），2 failed | 4 passed。
- **GREEN：** 新增 `core/contracts/node.ts`（`NodeIdSchema`/`LevelSchema`/`FieldValueSchema`/`NodeSchema`）+ `core/contracts/index.ts` 加 `export * from "./node"`。`references`/`flags`/`fields` 用 `.default()` 保证缺字段最小节点可解析。
- **REFACTOR：** 已抽共享小 schema（id/level/fieldValue），表面积最小，绿态无需再整理。
- **验证：** `pnpm contracts:check` → 4 files / 6 tests 全绿；`pnpm lint` 无新增错误（仅既有 boundaries 弃用告警）。

### 切片② · ULID 节点身份（core/shared/id + ulid）✅
- **行为：** `createNodeId()` 产出合法、按创建顺序字典序可排序的 ULID；`isNodeId` 正确判真/假；与 `NodeIdSchema` 对齐。
- **RED：** 测试 `core/__tests__/shared/id.test.ts`（accepted by isNodeId+NodeIdSchema / monotonic sortable / rejects malformed）。失败信号：`TypeError: isNodeId is not a function`，3 failed。
- **GREEN：** `pnpm --dir app add ulid`（3.0.2）；`core/shared/id.ts` 新增 `createNodeId`（`monotonicFactory()` 单调）/`isNodeId`（本地 ULID 正则，与 `NodeIdSchema` 同步，互加注释）。保留 `createRunId`/`isRunId` 不动。
- **REFACTOR：** 无需，函数已最小。
- **验证：** `pnpm test:core` 22/22（10 files）；`tsc --noEmit` 退出 0（ulid 类型 OK）；`pnpm lint` 无错误。

### 切片③ · template schema + .eidon 布局契约 + fixtures ✅
- **行为：** 单层模板文件 `L{n}.{name}.v{ver}.json` 可解析（6 类字段齐、select 必带 options）；文件名/路径 build↔parse 往返一致。
- **RED：** 测试 `core/__tests__/contracts/template.conformance.test.ts`（golden 6 类型 / select 无 options 拒绝 / 文件名往返 / .eidon 路径组合）；golden `fixtures/contracts/template.l1.档案.json`。失败信号：`TemplateLayerSchema` 等未定义，3 failed。
- **GREEN：** 新增 `core/contracts/template.ts`（`FieldTypeSchema`/`FieldDefSchema`(select superRefine)/`TemplateLayerSchema` + `EIDON_DIR`/`EIDON_TEMPLATES_DIR` + `templateLayerFileName`/`parseTemplateLayerFileName`/`templateLayerPath`）；`LevelSchema` 从同模块 `./node` 复用；index 加 `export * from "./template"`。
- **REFACTOR：** 无需。
- **验证：** `pnpm contracts:check` 5 files / 10 tests 全绿；`tsc --noEmit` 0；`pnpm lint` 无错误。

### 切片④ · core/nodes 扫描建树（深度=层级 + id→path）✅
- **行为：** `scanWorkspace(reader)` 遍历 workspace、识别 `.node/node.json`、按物理深度推导层级、产出 `nodes + idToPath + pathToId`；忽略系统/普通文件夹/第 4 层自由文件夹。
- **RED：** 测试 `core/__tests__/nodes/scan.test.ts`（真实临时目录 + node:fs `WorkspaceReader`：建树深度=层级+id→path / 忽略 .eidon·草稿·附件）。失败信号：`../../nodes` 模块不存在，import 失败、no tests。
- **GREEN：** 新增 `core/nodes/index.ts`：`WorkspaceReader`/`DirEntry`/`ScannedNode`/`NodeTree` + `scanWorkspace`（深模块：注入 reader、跳过 `.` 目录、`MAX_NODE_DEPTH=3` 截断、`NodeSchema.safeParse` 容错、按 path 排序保证确定性）。
- **REFACTOR：** 无需，接口最小、复杂度内聚。
- **验证：** scan 2/2；`pnpm test:core` 28/28（12 files）；`tsc --noEmit` 0；`pnpm lint` exit 0（core/nodes 经 ../contracts index 依赖，未触发边界）。

### 切片⑤ · 删缓存重建回归（AX-1/AX-4）✅
- **行为（不变量门禁）：** 删除运行时 `.eidon/` 缓存后，从磁盘 `.node/` 重建的节点树/身份/层级/字段/id↔path 与首次 100% 一致，且与目录枚举顺序无关。
- **RED：** 测试 `core/__tests__/nodes/rebuild.test.ts`（建含字段的三层【节点】 workspace → tree1 → `rm -rf .eidon` → 反序 reader 重扫 tree2 → 三组断言相等 + L3 字段值重建）。预期失败模式：若扫描非确定/有隐藏状态/缺排序，则反序重扫结果不等。
- **GREEN：** 无需新增生产代码——不变量由切片④的设计（纯函数扫描 + 按 path 排序）天然满足；本切片是守护该设计的回归门，单次即绿。
- **REFACTOR：** 无需。
- **验证：** rebuild 1/1；最终全套 `pnpm contracts:check` 10/10、`pnpm test:core` 29/29（13 files）、`tsc --noEmit` 0、`pnpm lint` 0。详见 `verification.md`。

## 接口变化
- **`core/contracts`（新增导出）：** `NodeSchema`/`Node`、`NodeIdSchema`/`NodeId`、`LevelSchema`/`Level`、`FieldValueSchema`/`FieldValue`、`TemplateLayerSchema`/`TemplateLayer`、`FieldTypeSchema`/`FieldType`、`FieldDefSchema`/`FieldDef`、`EIDON_DIR`/`EIDON_TEMPLATES_DIR`、`templateLayerFileName`/`parseTemplateLayerFileName`/`templateLayerPath`。
- **`core/shared/id`（新增）：** `createNodeId()`、`isNodeId()`（`createRunId`/`isRunId` 不变）。
- **`core/nodes`（新模块）：** `scanWorkspace(reader)`、类型 `WorkspaceReader`/`DirEntry`/`ScannedNode`/`NodeTree`。
- **依赖：** `app/package.json` 新增 `ulid@3.0.2`。
- **磁盘契约：** 新增 golden fixtures `fixtures/contracts/node.l3.json`、`fixtures/contracts/template.l1.档案.json`。
- 无用户可见 UI 变化（本期纯 core 数据层地基）。

## 偏离计划
- 模板契约落点定为**单层文件** `TemplateLayerSchema`（对齐磁盘真相 `L{n}.{name}.v{ver}.json`），而非计划草拟的「L1/L2/L3 捆绑对象 `TemplateSchema`」。捆绑是逻辑概念（同 templateId），磁盘契约按单层文件锁定更贴合 ADR-0014 与重建。属计划内的合理细化，未扩大范围。
- 切片⑤无 GREEN 代码变更（见上）——不变量已由切片④满足，符合「不预实现、不加推测功能」。

## 剩余切片
- 阶段0 全部切片完成。后续阶段（另起 TDD run）：阶段1 模板管理（`core/templates` 版本化/种子/设置 UI）、阶段2 节点 CRUD/提升 + 节点感知 FileTree、阶段3 `core/consistency` 违规检测 + 复用接线、阶段4 改名收口 + 端到端贯通。
