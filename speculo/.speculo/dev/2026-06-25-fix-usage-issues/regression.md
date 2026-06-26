> **服务工作流：** `../../../../workflows/dev/H-diagnose/H-diagnose.md`
> **产物文件名：** `regression.md`

# Regression

7 组问题全部落地。下表「验证」分两类：**自动**（typecheck/lint/vitest/build 已绿）与 **手动**（需 `pnpm dev` 跑应用目检）。

## 确认原因

- **AI 工具缺 edit（B1）**：pi-SDK `tools` 白名单连带过滤 customTools（`agent-session.js:1839` 的 `isAllowedTool`）。
  EIDON 传 `tools:[read,grep,find,ls]` 而把 edit/write/bash/notify/subagent/search_kb/read_node 经 customTools 注入 →
  名字不在白名单 → 被 SDK 全部剔除。**已确认（源码级）**。
- **文件树定位重叠（BUG1/A）**：reveal 时三处并管开合状态（openIds + 命令式 arborist.open + data 预载）+ 逐祖先多次
  setTreeData + 冗余双 scrollTo 交错，致虚拟列表行 top 错位。**按假设 1 修复**（单一真相源 + 单次提交 + 单次滚动）。

## 修复摘要

- **B1**：`backend/domain/ai/session.ts` 新增 `mergeSdkAllowedTools(infoToolNames, customTools)`，把 customTool 名并入 `tools`
  白名单（门控版同名 customTool 覆盖 SDK 裸内置，权限档闸门仍生效）。
- **A**：`FileTree.tsx` `revealActiveFileInTree` 重写为「合并 open 集合 → 一次 loadOpenDescendants → 单次 setTreeData/
  setOpenIds（同步 ref）→ commit 后单次 open+select+scroll」，并 reveal 期间抑制并发刷新。
- **D（Split）**：`PaneTabBar.tsx` i18n（tabMenu.splitRight/Down/closePane）；「+」旁加 Split Right/Down + 多窗格时关闭「×」；
  `splitPane(paneId,dir,'')` 分出空白窗格（`PaneContent` 空态提示）。
- **E（新建 md）**：`eidon:new-markdown` 事件 + App 托管的 `NewMarkdownDialog`（预填 `YYYY-MM-DD-.md`，光标落扩展名前）；
  `useFiles.createMarkdownAt` 统一在目标 L3 建文件并写 `initialMarkdownContent()`；FileTree 本地名称框同步改默认名+frontmatter。
- **C2（配色）**：导出复用 `liveEditHighlightStyle`，source 模式也用 `--md-*`/`--syn-*` 调色板；选中底色 0.25→0.42。
- **C1（右键菜单）**：`cm` host onContextMenu → `EditorContextMenu`；加粗/倾斜/删除线（复用 `expandSnippet`）、加入 AI
  对话（文本/引用，经 `ai.pendingInsert` + Composer 消费）、复制相对/绝对路径+行号（`formatPathWithLineRange`）。
- **B2（默认助手）**：`ProvidersFile.defaultAgentId` + `agents:get/setDefault` 通道；`ensureDefaultAgent` 优先用它；
  AgentTab「设为默认」+ 角标；AiPanel「默认助手（名）」。
- **F2（树 picker）**：`NodeTreePicker`（L1>L2>L3 层级树）取代平铺 L3 列表，移动对话框复用。
- **F3（多选）**：FileTree Cmd/Ctrl+点击 `selectedIds` 多选 + 批量拖拽。
- **F1（节点降级）**：`relocateNode`（domain）+ `nodes:relocate` 全链；深度 1-3 重写 level、深度≥4 剥离 `.node/` 变普通文件夹；
  FileTree 结构节点右键「移动/降级到…」走树 picker。

## 回归测试（自动，已绿）

- `mergeSdkAllowedTools`：`backend/domain/ai/__tests__/session.test.ts`（并集 + 去重 + 无 customTools）。
- `formatPathWithLineRange`：`frontend/lib/__tests__/eidon-paths.test.ts`（单行/跨行/光标）。
- `relocateNode`：`backend/domain/__tests__/nodes/crud.test.ts`（L2→L3 重挂 + 子树身份剥离 + L3→普通文件夹 + 自身内拒绝 + 删缓存重扫一致）。
- `ProvidersFile.defaultAgentId`：契约/store 测试更新已绿。

## 重新验证

- 自动全绿：`pnpm typecheck` ✓ / `pnpm lint` ✓ / `pnpm test:core`（136）✓ / `pnpm test:ui`（118）✓ /
  `pnpm contracts:check`（24）✓ / `pnpm build` ✓。
- **手动待验（`pnpm dev` 目检）**：BUG1 定位不重叠；Split 空白窗格与关闭；编辑器右键各项；md 配色与选中清晰度；
  新建 md 两入口弹日期名框并写 frontmatter；AI 问工具列表含 edit；设默认助手生效；移动对话框树形；Cmd+点击多选；
  L1/L2/L3 右键降级（含 L3→普通文件夹）。

## 清理与后续

- 无 `[DEBUG-*]` 插桩残留（BUG1 直接按确认假设修复，未落运行期日志）。
- F1 改动核心数据模型不变量（深度=层级的「降级」语义）：建议后续补一条 ADR 记录「relocate/身份剥离」并与 ADR-0013/0016 对齐；
  re-level 仅改 `level`、保留旧模板字段，模板层不符依赖既有一致性徽标整改（非静默改用户字段）。
