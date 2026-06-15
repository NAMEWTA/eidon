> **服务工作流：** `../03-tdd/03-tdd.md`
> **产物文件名：** `tdd/hotfix-ui-node-template-polish/implementation-log.md`

# Implementation Log

## 阶段标识
hotfix-ui-node-template-polish

## 循环记录
- 切片 1 · 模板 Name 契约：RED 扩展 template conformance/templates 测试；GREEN 为 `TemplateLayerSchema` 增 `templateName?`，`core/templates` 新写入 `templateName` 并旧模板回退层名组合；REFACTOR 更新内置种子为“档案/项目/资料”。
- 切片 2 · 模板 UI 与字段 draft：RED 新增 `templateDisplayName` / blank field draft 测试；GREEN `TemplateManager` 增模板 Name 输入，新增字段 key/label 为空，列表/标题/删除确认优先用模板 Name。
- 切片 3 · 节点属性右侧栏：RED 代码审计确认旧入口只能右键打开 modal；GREEN 新增 `NodePropertiesPanel`，`FileTree` 点击结构节点上报，App 增 `node` 右侧栏 pane 并自动显示。
- 切片 4 · FileTree 左侧宽度：RED 设置持久化测试缺少独立宽度；GREEN 增 `fileTreeWidth`、`setFileTreeWidth`、布局 splitter、CSS 外壳和 relayout 事件。

## 接口变化
- 新增 `Settings.fileTreeWidth`，默认 260，持久化钳制 180-520。
- `rsPaneOrder` 默认和迁移顺序加入 `node` pane，重置顺序同步包含该 pane。
- `TemplateInput` 支持 `templateName`；`Template` 运行时始终给出 `templateName`。
- `FileTree` 新增可选 `onSelectStructureNode` prop。

## 偏离计划
无需要用户确认的偏离。`NodeInspector` 文件未删除，只是不再由 FileTree 挂载，避免在脏工作区中删除此前已有文件。

## 剩余切片
无。后续可在独立迭代中补 Playwright 视觉验证，但本轮已通过类型检查、契约、UI/core 测试、lint 和 build。
