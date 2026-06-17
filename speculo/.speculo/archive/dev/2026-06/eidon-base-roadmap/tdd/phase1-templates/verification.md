> **服务工作流：** `../03-tdd/03-tdd.md`
> **产物文件名：** `tdd/phase1-templates/verification.md`（阶段0 见 `../phase0-node-base/`）

# Verification — 阶段1·多模板 schema（core/templates）

## 已运行命令

| 命令 | 结果 |
|---|---|
| `pnpm test:core` | ✅ 13 files / **39 tests** 全绿（含 templates 10 个新测：创建/列出/校验/初始化/删除/版本化/端到端验收） |
| `pnpm contracts:check` | ✅ 5 files / 10 tests 全绿（阶段0 契约回归未破） |
| `pnpm --dir app exec tsc --noEmit` | ✅ exit 0 |
| `pnpm lint` | ✅ exit 0（`core/templates` 经 `../contracts`、`../shared/id` 的 index 依赖，未触发边界；禁 UI / 不 import 旧 AI 均通过；最终收口仅既有 warnings） |
| `pnpm --dir app test:ui` | ✅ 8 files / 80 tests 全绿 |
| `pnpm build` | ✅ exit 0 |
| `cd app/src-tauri && cargo test` | ✅ Rust tests 全绿（1 ignored Ollama smoke；existing dead-code warning only） |

端到端验收（roadmap 阶段1 验收切片）：`core/__tests__/templates/templates.test.ts > 阶段1 端到端验收` —— init 内置三套 → 自建一套平级共存(4) → 编辑内置 档案 生成 v2 且 v1 原样(老数据不乱) → 删除内置 项目(3) → 重新 init 为 no-op 且 项目 不复活。

## 未运行命令

- 根目录 `pnpm test:ui` 不存在代理脚本，已改用实际 workspace 命令 `pnpm --dir app test:ui` 并通过。
- 浏览器级 TemplateManager 手动交互测试未自动化；当前证据来自 core/templates 行为测试、Settings 挂载审计、TypeScript、UI 单测和 build。

## 调试残留检查

- 已 grep `core/templates/index.ts` 与 `core/__tests__/templates/`：无 `console.log`/`debugger`/`FIXME`/`@ts-ignore`/占位符残留。
- 最终收口已补上 React `TemplateManager`、`src/stores/templates.ts`、生产 `createWorkspaceFileStore` 接线、内置字段集定稿和 Settings 挂载；零 Rust 新增仍成立。

## 完成结论

阶段1·多模板 schema 的 **`core/templates` 数据层已完成并验证（verified）**：首次初始化+内置种子(写一次性)、创建、列出、取版本、版本化不可变编辑、删除孤儿态、字段校验、删过不复活全部绿。

**后续建议：**
- 已在后续阶段完成设置内 React `TemplateManager` + templates store；其数据全部经本模块公共 API（create/list/get/edit/delete/init），UI 不直接碰盘。
- 已完成生产 `TemplateStore` 接线：`core/bridge/file.ts` 的 `createWorkspaceFileStore` 复用 `editor/file_ops`。
- 内置种子字段集已定稿在 `BUILTIN_TEMPLATE_SEEDS`，阶段4 端到端验收已覆盖 `.eidon/templates/` 自包含重建。
- 阶段2 已完成节点 CRUD + 字段表单 + 节点感知 FileTree 接线：节点创建时选模板版本、`node.json.schemaVersion` = 模板 `version`。
- 未自动归档；提交与归档由用户决定。
