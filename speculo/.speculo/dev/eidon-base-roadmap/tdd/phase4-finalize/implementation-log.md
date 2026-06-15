> **服务工作流：** `../03-tdd/03-tdd.md`
> **产物文件名：** `tdd/phase4-finalize/implementation-log.md`

# Implementation Log — 阶段4·改名收口 + 端到端贯通

## 阶段标识
`phase4-finalize`

## 循环记录

### 切片① · EIDON 品牌与 `.eidon` 系统区
- **行为：** 包名、页面标题、Tauri 产品名/窗口标题/About 可见文案变为 EIDON；新数据层系统区为 `.eidon/templates/`。
- **RED：** 搜索可见品牌文件，若 package/html/tauri/About 仍为旧产品名则失败；契约测试若模板路径不是 `.eidon/templates/` 则失败。
- **GREEN：** 更新 `package.json`、`index.html`、`tauri.conf.json`、About/i18n 可见文案；`core/contracts/template.ts` 定义 `EIDON_DIR = ".eidon"` 与 `EIDON_TEMPLATES_DIR`。
- **REFACTOR：** 旧内部事件名、localStorage key 和不挂载的 legacy AI·Agent·Recipes 文案保留，避免无必要迁移；EIDON 数据层不依赖这些旧模块。
- **验证：** `pnpm contracts:check` 与品牌路径搜索；最终收口跑全量命令。

### 切片② · 设置内模板管理 + 默认模板定稿
- **行为：** Settings 中挂载 `TemplateManager`；内置 档案/项目/资料 对应字段集首次写入，之后作为普通模板文件可编辑/删除。
- **RED：** `TemplateManager` 未挂到 Settings 或 `initWorkspaceTemplates` 重复播种/删除后复活时失败。
- **GREEN：** `SettingsPanel.tsx` 增加 templates 分类并挂 `TemplateManager`；`core/templates` 的 `BUILTIN_TEMPLATE_SEEDS` 定义三套默认模板；测试覆盖首次播种、平级共存、删过不复活。
- **REFACTOR：** 模板 UI 只经 `useTemplatesStore` 调用 core 公共 API，不直接操作磁盘契约。
- **验证：** `core/__tests__/templates/templates.test.ts`、`tsc`。

### 切片③ · 端到端可迁移 / 可重建验收
- **行为：** 模板文件、节点身份、字段、L3 内容在删除运行时缓存和复制 workspace 后仍可重建。
- **RED：** 新增 `core/__tests__/eidon/e2e.test.ts`，缺任一链路即失败。
- **GREEN：** 组合 `createTemplate`、`createNode`、`scanWorkspace`、`getTemplate` 与真实临时目录 store，证明 `.eidon/templates/` + `.node/node.json` + L3 内容自包含。
- **REFACTOR：** 测试只通过公共 API 与文件系统 store 观察行为，不断言内部私有 helper。
- **验证：** `pnpm --dir app exec vitest run core/__tests__/eidon/e2e.test.ts` 通过，1 file / 1 test。

### 切片④ · 旧 AI·Agent·Recipes 不挂载
- **行为：** EIDON App 不挂 `AgentPanel`、`AgentSetupWizard`、`RecipesSettings`、`TraceView`；Settings 也不挂 AI/Recipes/Integrations 面板。
- **RED：** 搜索 App/Settings/Toolbar/useCommands，如旧面板仍被 import 或挂载则失败。
- **GREEN：** App 只挂 FileTree/Editor/Search/History/Settings 等 EIDON 需要的基础能力；`rsPaneSnapshot` 将 `showAgentPanel` 固定为 false；Settings 分类不含 AI/Recipes。
- **REFACTOR：** 旧代码留在仓库作为基底，不删除、不迁移 `.solomd/` legacy 区。
- **验证：** `rg "AgentPanel|AgentSetupWizard|RecipesSettings|TraceView|AISettings|IntegrationsSettings"` 在 App/Settings/Toolbar/useCommands 中无挂载命中。

## 接口变化
- 新增 `core/__tests__/eidon/e2e.test.ts` 作为端到端验收门。
- Roadmap 中 phase4 对应的品牌、系统区与端到端验收证据落到当前代码与测试。

## 偏离计划
- “solomd” 内部事件名、localStorage key、legacy `.solomd/`、不挂载的旧 AI·Agent·Recipes 代码和 CLI/MCP legacy 文案未全量重命名。原因：ADR-0018 明确旧代码作基底保留，且 localStorage/event key 重命名会引入兼容迁移风险；EIDON 数据层与可见主产品面已使用 EIDON/`.eidon`。
- 未新增浏览器级 E2E 自动化；以 core 端到端重建测试、类型检查、build、lint 和 Rust 测试覆盖本期可验证范围。

## 剩余切片
- 阶段4 无剩余必做切片。最终完成性需由全量验证命令与逐项审计确认。
