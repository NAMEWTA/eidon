> **服务工作流：** `../03-tdd/03-tdd.md`
> **产物文件名：** `tdd/hotfix-ui-node-template-polish/tdd-plan.md`

# TDD Plan

## 阶段标识
hotfix-ui-node-template-polish

## 切片来源
用户直接请求 + `dev/H-diagnose`：修复/优化 FileTree 左侧宽度、模板 Name、模板新增字段默认值、节点点击后右侧属性查看编辑。

## 公共接口
- `Settings.fileTreeWidth` / `setFileTreeWidth(width)`：独立持久化 FileTree 宽度，不复用右侧栏宽度。
- `TemplateInput.templateName` / `Template.templateName` / `TemplateLayerSchema.templateName?`：模板级可读名称，新写入持久化，旧模板无该字段时回退 L1/L2/L3 层名组合。
- `FileTree({ onSelectStructureNode })`：结构节点点击上报给 App。
- `NodePropertiesPanel`：右侧栏节点属性面板，复用 `useNodesStore.updateFields` 保存字段。

## 行为优先级
1. 磁盘契约先行：template layer fixture 接受 `templateName`，旧 fixture 形状仍兼容。
2. 模板管理：新建/编辑模板必须能自定义 Name；新增字段行 key/label 为空，不再默认 `field2` / `Field`。
3. 文件资源目录树左侧边栏可横向拖拽并持久化宽度。
4. 点击 L1/L2/L3 结构节点后，右侧栏自动显示该节点属性并可编辑字段；点击文件或普通文件夹清空节点选择。

## 第一个 Tracing Slice
先从契约和纯函数开始：扩展 `TemplateLayerSchema` + fixture + `core/templates` 往返测试，观察旧模板解析、新模板写入、内置模板播种是否保持通过；再接 UI。

## 验证命令
- `pnpm --dir app exec vitest run core/__tests__/contracts/template.conformance.test.ts core/__tests__/templates/templates.test.ts src/lib/__tests__/template-visuals.test.ts src/lib/__tests__/template-drafts.test.ts src/lib/persistence/__tests__/settings.test.ts`
- `pnpm --dir app exec tsc --noEmit --pretty false`
- `pnpm contracts:check`
- `pnpm --dir app test:ui`
- `pnpm test:core`
- `pnpm lint`
- `pnpm build`
- `git diff --check`
