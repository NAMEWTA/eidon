> **服务工作流：** `../H-diagnose/H-diagnose.md`
> **产物文件名：** `diagnosis.md`

# Diagnosis

## 用户症状

本轮用户报告两个文件资源目录树问题：

- FileTree 右键菜单打开后，点击其它区域不会稳定自动关闭。
- 文件拖拽/移动到目标目录的行为仍不够像成熟文件资源管理器，落到目录行上时不够可靠。

上一轮已修复目录默认假展开与设置页布局；本轮聚焦右键菜单关闭和目录 drop 语义。

## 参考实现调研

按用户要求查阅了成熟目录树/资源管理器实现：

- VS Code TreeView DnD API 把同树拖拽、外部文件拖入都建模为 `TreeDragAndDropController`，明确区分 drag source、drop target 和 data transfer。
- React Aria Tree DnD 明确区分 `before` / `after` / `on` 三种 dropPosition；其中 `on` 的语义是把源项移动为目标节点的 children。
- React Complex Tree 把 `canReorderItems` 与 `canDropOnFolder` 拆开；`canDropOnFolder` 专门表示“拖到文件夹节点上”。
- react-arborist 支持 `onMove` / `disableDrop` / 自定义节点渲染，但默认 hover 区域更偏树插入光标；仅依赖它会让“落到目录行即移入目录”的体验不稳定。
- MDN `contextmenu` 说明右键会触发 `contextmenu` 事件；全局关闭浮层更适合监听捕获阶段的 pointer/contextmenu，而不是只依赖 bubbling click。

## 反馈循环

建立/复用的反馈循环：

- `pnpm --dir app exec vitest run src/lib/__tests__/filetree-menu.test.ts`
- `pnpm --dir app exec tsc --noEmit --pretty false`
- `pnpm --dir app test:ui`
- `pnpm --dir app lint`
- `pnpm test:core`
- `pnpm build`
- `git diff --check`

## 复现结果

- 右键菜单只靠 `window.addEventListener('click', ...)` 在冒泡阶段关闭；编辑器/工具栏等区域如果阻止冒泡，菜单不会关闭。
- 右键菜单本身没有阻止 `contextmenu` 冒泡，右键菜单内再次右击可能被外层 FileTree 当成根目录右键。
- 拖拽移动只依赖 react-arborist 的 `onMove(parentNode, dragNodes)`。当用户“落在目录行”但没有命中 react-arborist 的 folder-middle drop 区域时，移动不会稳定解释为“移入该目录”。
- 移动规则没有单独纯函数覆盖“文件可移入 L3 子目录”和“目录不能移入自身/后代”。

## 假设列表

1. 如果右键菜单不关闭是事件冒泡被拦截导致，那么改用 document 捕获阶段 `pointerdown` / `contextmenu` 做 outside 检测后，应能稳定关闭。
2. 如果文件移动不可靠是 drop 目标语义不明确，那么给目录行补原生 `dragover/drop` 兜底，把“drop on folder row”明确转成 `fs_rename` 到该目录，应符合 VS Code/React Aria/React Complex Tree 的 folder drop 模型。
3. 如果移动规则容易误伤结构节点或目录自嵌套，那么抽出 `canMoveFileTreeEntriesInto` 并加测试，应能锁住结构节点不可拖、L3 后代目录可接收、目录不可移入自身/后代。

## 插桩结果

未加入运行时调试日志。通过源码检查和纯函数测试验证：

- 捕获阶段 outside 检测能绕过 bubbling 被 stopPropagation 的问题。
- `canMoveFileTreeEntriesInto` 覆盖了“普通文件移入 L3 子目录”和“目录移入自身/后代被拒绝”。
- `tsc`、`test:ui`、`lint`、`test:core`、`build` 均通过。

---

# Diagnosis · hotfix-ui-node-template-polish

## 用户症状

本轮用户要求继续修复/优化四项：

- 文件资源目录树左侧边栏需要能与主操作区域左右拖拽调节宽度。
- 模板管理新建模板时需要自定义模板 Name，便于辨认不同模板。
- 模板管理新增字段不应再默认生成 `field2` / `Field`。
- 点击 L1/L2/L3 结构节点时，右侧栏应自动展示该节点属性，并参考 `docs/原型参考` 的属性查看编辑 UI/UX。

## 反馈循环

已建立可信反馈循环：

- 契约/模板：`core/__tests__/contracts/template.conformance.test.ts`、`core/__tests__/templates/templates.test.ts`。
- UI 纯逻辑：`src/lib/__tests__/template-visuals.test.ts`、`src/lib/__tests__/template-drafts.test.ts`、`src/lib/persistence/__tests__/settings.test.ts`。
- 集成验证：`tsc --noEmit`、`contracts:check`、`test:ui`、`test:core`、`lint`、`build`。

## 复现结果

- FileTree 仍由 `.ftree { width: 240px }` 固定宽度控制，没有独立持久化宽度或左侧 splitter。
- 模板契约/运行时只有 L1/L2/L3 层名，没有模板级 `templateName`，UI 主要以 L1 名展示模板。
- `TemplateManager.addField()` 会生成 `{ key: fieldN, label: Field }`。
- FileTree 点击结构节点只做选择/展开；节点字段查看编辑只能通过右键菜单打开 `NodeInspector` modal。

## 假设列表

1. 如果模板辨认困难来自缺少模板级 Name，那么在 template layer 契约中增加可选 `templateName` 并让新写入同步三层，应能让列表/下拉/FileTree 稳定展示自定义模板名。
2. 如果新增字段默认值干扰用户，是 UI draft helper 写入了固定 key/label，那么改成空 draft 并由保存校验兜底即可。
3. 如果节点属性没有自动展示，是 FileTree 没有把结构节点选择上报给 App，那么新增选择回调并接入右侧栏 pane 即可。
4. 如果 FileTree 宽度无法调节，是宽度写死在组件 CSS 中，那么移到 App 布局外壳并持久化宽度即可。

## 插桩结果

未加入运行时调试日志。通过源码检查与测试验证：

- `TemplateLayerSchema` 兼容旧模板并接受新 `templateName` fixture。
- `core/templates` 新建/编辑/读取均保留 `templateName`，旧模板回退 L1/L2/L3 层名组合。
- FileTree 节点点击路径已上报 `ScannedNode`，App 可自动显示 `node` 右侧栏 pane。
- 设置持久化已覆盖 FileTree 宽度钳制与 `node` pane 顺序迁移。

---

# Diagnosis · hotfix-template-upgrade-filetree-daily-outline

## 用户症状

本轮用户要求继续修复/优化五项：

- 模板更新后，模板管理处需要查看使用旧 schema 的节点，并可点击升级节点属性。
- 编辑保存 Markdown 后，左侧 FileTree 整体闪烁刷新；需判断是否应使用虚拟化。
- 每日笔记/日历入口需要常驻顶部右侧 Search 按钮之前，点击后在右侧栏展示。
- 左侧栏 `EXPLORER` 标题行的打开文件夹按钮需要删除。
- 打开 Markdown 文档时右侧栏不能自动弹出 Outline，且 Outline UI 与当前系统/原型参考不匹配。

## 反馈循环

已建立可信反馈循环：

- core 节点升级：`core/__tests__/nodes/schema-upgrade.test.ts`。
- 既有节点/模板回归：`core/__tests__/nodes/crud.test.ts`、`core/__tests__/templates/templates.test.ts`。
- UI/设置迁移：`src/lib/persistence/__tests__/settings.test.ts`、`test:ui`。
- 集成验证：`tsc --noEmit`、`contracts:check`、`test:core`、`lint`、`build`、`git diff --check`。

## 复现结果

- 当前模板编辑只生成新版本，并提示旧节点继续使用旧版本；没有列出使用该模板的节点，也没有显式升级动作。
- FileTree 已使用 `react-arborist` 虚拟化；保存闪烁不是缺少虚拟化，而是 `solomd:saved` 和随后的 `index-updated` 都会触发 `refreshRoot()`，并把 `rootLoading` 置为 true，导致整棵树短暂切到 loading。
- 每日笔记能力已有 `useDailyNotes`、命令面板和 Tags 面板按钮，但没有顶栏常驻入口和独立右侧栏 pane。
- FileTree header 仍有 `explorer.openFolder` 图标按钮。
- Markdown tab 的 `showOutline` 取决于全局设置默认值；默认 false 时打开 Markdown 不会弹出 Outline。当前 Outline 视觉仍带较重的旧式 header、键位标签和常驻快捷键状态条，与 `docs/原型参考/rightpanel.jsx` 的 H 层级/标题/行号紧凑行不一致。

## 假设列表

1. 若旧节点升级需求只需更新属性 schema，则新增同模板同层级的显式 `upgradeNodeSchema` 即可，不需要改磁盘契约。
2. 若 FileTree 闪烁来自全树 loading 刷新，则普通保存改为已展开父目录轻量刷新，并抑制保存引发的短窗口 index refresh，应消除整树闪烁。
3. 若 Daily 是已有能力缺入口，则复用 `useDailyNotes` 新增 `daily` 右侧栏 pane，比重写日历数据层风险更低。
4. 若 Outline 不能自动弹出来自 `showOutline=false` 默认，则 Markdown 新建/打开默认启用并由 App 保证右侧栏可见即可。
5. 若 Outline UI 不匹配来自组件结构和 CSS，则保留抽取/跳转逻辑，重写为原型参考的紧凑行展示。

## 插桩结果

未加入运行时调试日志。通过源码检查和测试验证：

- `upgradeNodeSchema` 保留兼容字段、新字段置空、移除旧字段、类型不兼容值置空，并拒绝跨模板/跨层升级。
- FileTree 保存事件不再直接进入 `rootLoading=true` 的全树刷新路径。
- Daily pane 已进入 `rsPaneOrder` 默认值和旧设置迁移，位置在 Search 前。
- Markdown 新建/打开默认启用 Outline；用户手动关闭后不对同一 tab 反复强开。
