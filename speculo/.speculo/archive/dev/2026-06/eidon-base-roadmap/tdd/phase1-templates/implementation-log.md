> **服务工作流：** `../03-tdd/03-tdd.md`
> **产物文件名：** `tdd/phase1-templates/implementation-log.md`（阶段0 见 `../phase0-node-base/`）

# Implementation Log — 阶段1·多模板 schema（core/templates）

> 切片来源 PRD US-2/3/4/5/6 + roadmap 阶段1。每轮 RED→GREEN→REFACTOR→验证。注入 `TemplateStore`（测试用 node:fs 临时目录），写盘前过 `TemplateLayerSchema`。阶段1 原始切片不预实现 UI / 节点表单 / 生产 bridge；这些已在后续阶段补齐并验证。

## 循环记录

### 切片① · createTemplate → listTemplates 往返 + 校验 ✅
- **行为：** 创建自定义三层【节点】模板（自定名字 + 6 类字段）写盘并能读回；多套并存；非法（select 无 options）写盘前被拒、不留半套。
- **RED：** 测试 `core/__tests__/templates/templates.test.ts`（创建+列出 6 类型 / 多套并存 / select 无 options 拒绝且不留半套；node:fs `TemplateStore`）。失败信号：`../../templates` 模块不存在，import 失败、no tests。
- **GREEN：** 新增 `core/templates/index.ts`：`TemplateStore`/`DirEntry`/`LayerInput`/`TemplateInput`/`Template` + `createTemplate`（`createNodeId` + `buildLayers` 先全部过 `TemplateLayerSchema` 校验再 `writeLayers` 统一写盘 → 原子）+ `listTemplates`（私有 `readTemplateVersion` 分组取最新版）。
- **REFACTOR：** 已抽 `buildLayers`/`writeLayers`/`readTemplateVersion` 私有 helper；公共接口仅 2 函数 + 类型。
- **修正测试缺陷：** 「多套并存」断言原写 `["甲","乙"]` 顺序，JS `.sort()` 按 UTF-16 码元得 `["乙","甲"]`（实现正确，断言错）→ 改为顺序无关的 `Set` 断言。
- **验证：** templates 3/3；`tsc --noEmit` 0；`pnpm lint` exit 0（core/templates 经 ../contracts、../shared/id 的 index 依赖，未触发边界）。

### 切片② · initWorkspaceTemplates 首次种子 + 写一次性 ✅
- **行为：** 首次使用写入 档案/项目/资料 三套内置种子；再次 init 为 no-op（不重写、不报错、不重复播种）。
- **RED：** 测试新增 describe `initWorkspaceTemplates`（首次播种 3 套且 L1 名={档案,项目,资料} / 二次 no-op 且身份不变）。失败信号：`initWorkspaceTemplates` 未定义，2 failed。
- **GREEN：** `core/templates/index.ts` 加 `BUILTIN_TEMPLATE_SEEDS`（最终字段集，6 类型分布覆盖；模板级身份用 L1 名）+ `initWorkspaceTemplates`（`store.exists(EIDON_TEMPLATES_DIR)` 目录级 guard → 不存在则逐套 createTemplate，存在则 no-op）。
- **REFACTOR：** 无需。
- **验证：** templates 5/5；`tsc --noEmit` 0。

### 切片③ · deleteTemplate + 删过不复活 ✅
- **行为：** 删模板后不再列出；删掉的内置模板在重新 init 时不复活。
- **RED：** 测试新增 describe `deleteTemplate`（删后不列出 / 删内置后重新 init 不复活）。失败信号：`deleteTemplate` 未定义，2 failed。
- **GREEN：** `core/templates/index.ts` 加 `deleteTemplate`（`store.remove(templateDir(id))` 删全版本；不动 `.eidon/templates/` 父目录 → 配合 init 目录级 guard 实现「删过不复活」）。
- **REFACTOR：** 无需。
- **验证：** templates 7/7；`tsc --noEmit` 0。

### 切片④ · editTemplate 版本化不可变 ✅
- **行为：** 编辑生成 v2；`getTemplate(id)` 取 v2，`getTemplate(id,1)` 仍是原始 v1；列出仍只一套（取最新版）。
- **RED：** 测试新增 describe `editTemplate / getTemplate`（生成新版旧版并存 / 取不存在返 null）。失败信号：`editTemplate`/`getTemplate` 未定义，2 failed。
- **GREEN：** `core/templates/index.ts` 加 `getTemplate`（薄封装 `readTemplateVersion`）+ `editTemplate`（读最新版→version+1 写新文件、旧版因文件名含版本号原样保留；不存在抛错）。模板 `version` 即节点 `schemaVersion`，同步递增。
- **REFACTOR：** `createTemplate` 显式 `buildLayers(..., version, version, ...)` 维持 `version===schemaVersion` 不变量。
- **验证：** templates 9/9；`tsc --noEmit` 0。

### 切片⑤ · 端到端验收 + 收尾 ✅
- **行为（验收门禁）：** init 内置三套 → 自建一套平级共存(4) → 编辑内置生成 v2 且 v1 原样 → 删除一套(3) → 再开 init no-op 且删过不复活。
- **RED：** 测试 `阶段1 端到端验收`（组合 ①-④ 已验证行为的完整流程）。预期失败模式：任一行为回归（如 init 重复播种 / 编辑改了旧版 / 删后复活）则断言不等。
- **GREEN：** 无需新增生产代码——验收由 ①-④ 的实现满足；本切片是守护组合行为的验收门，单次即绿。
- **REFACTOR：** 无需。
- **验证：** templates 10/10；最终全套 `pnpm contracts:check` 10/10、`pnpm test:core` 39/39（13 files）、`tsc --noEmit` 0、`pnpm lint` 0。详见 `verification.md`。

## 接口变化
- **`core/templates`（新模块，公共出口）：** 类型 `TemplateStore`/`DirEntry`/`LayerInput`/`TemplateInput`/`Template`；函数 `initWorkspaceTemplates`、`createTemplate`、`listTemplates`、`getTemplate`、`editTemplate`、`deleteTemplate`。
- **复用阶段0 不改形状：** `TemplateLayerSchema`/`templateLayerPath`/`parseTemplateLayerFileName`/`EIDON_TEMPLATES_DIR`/`Level`（`core/contracts`）、`createNodeId`（`core/shared/id`）。
- **无新增依赖、无契约形状变更、无 Rust 改动、无 UI 变化。**
- 内置种子常量 `BUILTIN_TEMPLATE_SEEDS`（模块私有，最终字段集）。

## 偏离计划
- 模板「身份名」用 **L1 层名**（档案/项目/资料）：阶段0 契约 `TemplateLayer` 无模板级 name 字段，只有每层 name；为不改契约（ADR-0014 需先改 zod+fixtures），以 L1 名作模板身份。阶段4 已沿用该模型并完成验收。
- 切片⑤无 GREEN 代码变更（验收门由 ①-④ 满足），符合「不预实现、不加推测功能」。
- 计划「校验失败不留半套」以 `buildLayers` 先全部过 `TemplateLayerSchema` 再统一 `writeLayers` 实现原子性——已落实并单测。

## 剩余切片
- 阶段1 `core/templates` 数据层全部切片完成。
- 原后续切片已完成：阶段2 节点 CRUD/提升 + 节点感知 FileTree + 字段表单、阶段3 一致性检测 + 复用接线、阶段4 改名收口 + 内置字段定稿 + 端到端贯通。
