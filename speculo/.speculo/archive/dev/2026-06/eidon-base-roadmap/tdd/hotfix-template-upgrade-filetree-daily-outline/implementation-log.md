> **服务工作流：** `../03-tdd/03-tdd.md`
> **产物文件名：** `tdd/hotfix-template-upgrade-filetree-daily-outline/implementation-log.md`

# Implementation Log

## 阶段标识
hotfix-template-upgrade-filetree-daily-outline

## 循环记录
- 切片 1 · 节点 schema 升级：RED `schema-upgrade.test.ts` 缺少 `listNodesUsingTemplate` / `upgradeNodeSchema`；GREEN 增 core API、宽松迁移字段归一化；REFACTOR 保持 `createNode/updateNodeFields` 严格必填校验不变。
- 切片 2 · 模板管理使用节点：GREEN `useNodesStore.upgradeSchema`、`TemplateManager` 显示已使用节点、schema 版本差异和“升级属性”动作，节点行触发 App 级节点选择事件。
- 切片 3 · FileTree 保存闪烁：GREEN 普通 `solomd:saved` 只刷新已展开父目录，并短暂抑制保存引发的 index-updated 全树刷新；Explorer 标题行移除打开文件夹按钮。
- 切片 4 · 每日笔记右侧栏：GREEN 新增 `DailyPanel`、toolbar Search 前日历按钮、`daily` pane 顺序迁移和右侧栏上下文菜单入口。
- 切片 5 · Outline 自动与样式：GREEN Markdown 新建/打开默认 `showOutline=true`，App 保证右侧栏可见；Outline 改成原型参考的 H 层级/标题/行号紧凑行。

## 接口变化
- `core/nodes` 新增 `listNodesUsingTemplate`、`upgradeNodeSchema`、`UpgradeNodeSchemaInput`。
- `useNodesStore` 新增 `upgradeSchema`。
- `rsPaneOrder` 默认和迁移顺序新增 `daily`，位置在 `search` 前。
- `ToolbarProps` 新增 `onOpenDaily`。
- 新增 `DailyPanel` 组件和 `calendar` 图标映射。

## 偏离计划
- 未引入新的虚拟化库：FileTree 现有 `react-arborist` 已提供虚拟化，实际闪烁根因是保存后全树 loading 刷新。
- 未改磁盘契约形状；节点升级仅重写现有 `.node/node.json` 字段。

## 剩余切片
无。后续若需要，可追加 Playwright 视觉回归覆盖 FileTree 保存无闪烁和右侧栏布局。
