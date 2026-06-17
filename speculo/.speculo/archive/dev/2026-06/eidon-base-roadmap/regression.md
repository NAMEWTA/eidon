> **服务工作流：** `../H-diagnose/H-diagnose.md`
> **产物文件名：** `regression.md`

# Regression

## 确认原因

根因有两处：

- FileTree 的浮层关闭只监听 bubbling 阶段 click，不足以覆盖编辑器/工具栏等会阻止冒泡的区域。
- FileTree 只依赖 react-arborist 的内置 drop 区域；用户拖到目录行时，未稳定表达“移入该目录”这个文件资源管理器常见语义。

## 回归测试

新增/扩展：

- `app/src/lib/filetree-menu.ts`
  - `FileTreeMoveEntry` / `FileTreeDropTarget`
  - `isSameOrDescendantPath`
  - `canMoveFileTreeEntriesInto`
- `app/src/lib/__tests__/filetree-menu.test.ts`
  - 普通文件可移动进 scanned L3 的自由目录。
  - 目录不能移动进自身或自己的后代。
  - 既有结构节点不可拖、L3 后代目录可作为落点的规则继续覆盖。

## 修复摘要

- `app/src/components/FileTree.tsx`
  - 给右键菜单和 workspace switcher 加 ref。
  - 使用 document capture 阶段 `pointerdown` / `contextmenu` 做 outside close。
  - 右键菜单内部阻止 `contextmenu` 冒泡，避免被外层 FileTree 重新解释为根目录右键。
  - 记录当前拖拽条目；目录行 `dragover` 时若是合法 L3 落点则显示 move dropEffect 和高亮。
  - 目录行 `drop` 时，如果 react-arborist 没有已经处理 folder drop，则直接把拖拽项 `fs_rename` 到该目录。
  - React-arborist `onMove` 与目录行 drop 共用同一个 `moveEntriesToParent`，避免两套移动逻辑漂移。

## 重新验证

已通过：

- `pnpm --dir app exec vitest run src/lib/__tests__/filetree-menu.test.ts`：1 file / 6 tests passed。
- `pnpm --dir app exec tsc --noEmit --pretty false`：通过。
- `pnpm --dir app test:ui`：10 files / 93 tests passed。
- `pnpm --dir app lint`：通过；仅有既有 `eslint-plugin-boundaries` 迁移提示。
- `pnpm test:core`：19 files / 52 tests passed。
- `pnpm build`：通过；仅有既有 Vite chunk-size / dynamic import 警告。
- `git diff --check`：通过。

## 清理与后续

没有新增调试日志或一次性调试脚本。本轮未启动长期 dev server，不会占用 `1420` 端口。

---

# Regression · hotfix-ui-node-template-polish

## 确认原因

根因分为四处：

- FileTree 宽度仍由 `.ftree` 固定 CSS 控制，没有独立设置项和 splitter。
- 模板数据模型只有层名，缺少模板级辨认名。
- `TemplateManager.addField()` 用生成值填充 key/label。
- 节点字段编辑入口仍是 FileTree 内部 modal，缺少结构节点选择到右侧栏的 App 级状态。

## 回归测试

新增/扩展：

- `app/core/__tests__/contracts/template.conformance.test.ts`：`templateName` fixture + 旧模板无 `templateName` 兼容。
- `app/core/__tests__/templates/templates.test.ts`：创建/读取/编辑/内置种子保留模板 Name，旧模板回退层名组合。
- `app/src/lib/__tests__/template-visuals.test.ts`：模板 Name 优先于 L1/L2/L3 层名组合。
- `app/src/lib/__tests__/template-drafts.test.ts`：新增字段 draft 的 key/label 为空。
- `app/src/lib/persistence/__tests__/settings.test.ts`：FileTree 宽度默认/钳制、`node` pane 顺序迁移。

## 修复摘要

- 增加 `Settings.fileTreeWidth` / `setFileTreeWidth()`，App 使用 `filetree-shell` + resize handle 包裹 FileTree。
- 扩展 template layer 契约与 `core/templates`，新模板写入 `templateName`，旧模板兼容。
- `TemplateManager` 增加模板 Name 输入，新增字段行不再预填 key/label。
- 新增 `NodePropertiesPanel`，FileTree 点击结构节点后由 App 打开 `node` 右侧栏 pane 并支持字段保存。

## 重新验证

已通过：

- `pnpm --dir app exec vitest run core/__tests__/contracts/template.conformance.test.ts core/__tests__/templates/templates.test.ts src/lib/__tests__/template-visuals.test.ts src/lib/__tests__/template-drafts.test.ts src/lib/persistence/__tests__/settings.test.ts`：5 files / 45 tests passed。
- `pnpm --dir app exec tsc --noEmit --pretty false`：通过。
- `pnpm contracts:check`：5 files / 11 tests passed。
- `pnpm --dir app test:ui`：11 files / 97 tests passed。
- `pnpm test:core`：19 files / 55 tests passed。
- `pnpm lint`：通过；仅有既有 boundaries 迁移提示。
- `pnpm build`：通过；仅有既有 Vite dynamic import / chunk-size 警告。

## 清理与后续

未添加调试日志或一次性脚本。未运行 Rust 测试，因为本轮未改 Rust/Tauri 后端。

---

# Regression · hotfix-template-upgrade-filetree-daily-outline

## 确认原因

根因分为五处：

- 模板版本化已存在，但缺少“模板使用节点清单”和节点显式 schema 升级 API。
- FileTree 已虚拟化；保存闪烁来自普通保存后触发全树 loading 刷新，而不是渲染列表规模问题。
- 每日笔记已有命令式能力，但缺少顶栏常驻入口和右侧栏面板。
- Explorer 标题行仍保留打开文件夹按钮，与当前左侧栏设计不符。
- Outline 默认关闭且视觉沿用旧实现，未按右侧栏原型的紧凑列表形式重做。

## 回归测试

新增/扩展：

- `app/core/__tests__/nodes/schema-upgrade.test.ts`
  - 列出使用某模板的节点。
  - 节点升级到新版 schema 时保留兼容字段、补新字段、删除旧字段。
  - 拒绝跨 templateId / level 升级。
  - 类型不兼容的旧值不会写入新 schema。
- `app/src/lib/persistence/__tests__/settings.test.ts`
  - `daily` pane 旧设置迁移到 Search 前。

## 修复摘要

- `core/nodes` 新增 `listNodesUsingTemplate` / `upgradeNodeSchema`，`useNodesStore` 增加 `upgradeSchema`。
- `TemplateManager` 展示当前模板使用节点、schema 版本状态和“升级属性”动作。
- FileTree 普通保存只刷新已展开父目录，并短暂抑制保存引发的 index-updated 全树刷新；Explorer 标题行移除打开文件夹按钮。
- 新增 `DailyPanel`，Toolbar 在 Search 前增加日历按钮；`rsPaneOrder` 默认/迁移/重置加入 `daily`。
- Markdown 新建/打开默认显示 Outline，App 保证右侧栏可见；Outline 改为 H 层级/标题/行号紧凑列表。

## 重新验证

已通过：

- `pnpm --dir app exec vitest run core/__tests__/nodes/schema-upgrade.test.ts`：1 file / 4 tests passed。
- `pnpm --dir app exec vitest run core/__tests__/nodes/schema-upgrade.test.ts core/__tests__/nodes/crud.test.ts core/__tests__/templates/templates.test.ts src/lib/persistence/__tests__/settings.test.ts`：4 files / 45 tests passed。
- `pnpm --dir app exec tsc --noEmit --pretty false`：通过。
- `pnpm --dir app test:ui`：11 files / 98 tests passed。
- `pnpm test:core`：20 files / 59 tests passed。
- `pnpm contracts:check`：5 files / 11 tests passed。
- `pnpm lint`：通过；仅有既有 `eslint-plugin-boundaries` 迁移提示。
- `pnpm build`：通过；仅有既有 Vite dynamic import / chunk-size 警告。
- `git diff --check`：通过。

## 清理与后续

未添加调试日志或一次性脚本。未运行 Rust 测试，因为本轮未改 Rust/Tauri 后端。
