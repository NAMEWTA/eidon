> **服务工作流：** `../03-tdd/03-tdd.md`
> **产物文件名：** `tdd/phase2-node-topology/implementation-log.md`

# Implementation Log — 阶段2·节点拓扑闭环

## 阶段标识
`phase2-node-topology`

## 循环记录

### 切片① · 节点 CRUD 公共 API
- **行为：** 通过 `core/nodes` 公共 API 创建 L1→L2→L3，写入 `.node/node.json`、`README.md`、`AGENTS.md`，并由 `scanWorkspace` 重建 id→path。
- **RED：** `core/__tests__/nodes/crud.test.ts` 引入 `createNode`/`NodeStore`，在模块不存在或接口缺失时失败。
- **GREEN：** `core/nodes/index.ts` 扩展 `NodeStore`，实现 `createNode`、父链模板校验、深度=层级强制、`NodeSchema.parse` 写盘。
- **REFACTOR：** 抽出 `validateFields`、`assertParentChain`、`writeNodeEnvelope`，保持节点拓扑逻辑集中在 `core/nodes`。
- **验证：** `pnpm --dir app exec vitest run core/__tests__/nodes/crud.test.ts core/__tests__/nodes/scan.test.ts core/__tests__/nodes/rebuild.test.ts` 通过，3 files / 8 tests。

### 切片② · 字段表单底座
- **行为：** 6 类字段按模板层校验并写回 `node.json.fields`；未知字段、错误 select、非 number、必填缺失均拒绝。
- **RED：** `updateNodeFields` 行为测试在函数缺失或未校验字段时失败。
- **GREEN：** `updateNodeFields(store, { path, templateLayer, fields })` 读取节点、校验 `templateId/level/schemaVersion`，再以模板字段规范重写扩展字段。
- **REFACTOR：** 复用 `validateFields`，避免创建与更新两条字段校验逻辑分叉。
- **验证：** `core/__tests__/nodes/crud.test.ts > updateNodeFields` 全绿。

### 切片③ · 重命名 / 移动 / 提升
- **行为：** 重命名和移动节点目录后 `.node/node.json` 原样随目录移动，ID 不变；移动必须保持物理深度与父链模板一致；普通文件夹可由用户触发提升为节点，保留已有内容。
- **RED：** `renameNode / moveNode` 与 `promoteFolderToNode` 测试在 ID 改变、模板链未校验或提升移动内容时失败。
- **GREEN：** 实现 `renameNode`、`moveNode`、`promoteFolderToNode`，并补 `assertNodeFitsParent`、`parentPathOf`、`basenameOf`。
- **REFACTOR：** 所有路径进入 core 前规范为 workspace 相对 POSIX 路径，避免 UI/Rust 路径分隔差异渗入业务规则。
- **验证：** `core/__tests__/nodes/crud.test.ts` 全绿。

### 切片④ · 生产接线与节点 UI
- **行为：** React store 可通过生产 `createWorkspaceFileStore` 调用 core 节点 API；FileTree 可扫描节点、显示 L1/L2/L3 徽标、打开 `NodeCreateDialog` 和 `NodeInspector`，并隐藏 `.node/` 导航项。
- **RED：** UI 接线前 `useNodesStore`、`NodeCreateDialog`、`NodeInspector` 不存在，FileTree 仍只有普通文件/文件夹入口。
- **GREEN：** 新增 `src/stores/nodes.ts`、`NodeCreateDialog.tsx`、`NodeInspector.tsx`，FileTree 接入 `scanWorkspace` 结果并把根/L1/L2 的新建入口改为节点创建。
- **REFACTOR：** FileTree 保留原可变树 + `forceUpdate` 迁移方式，只在上下文菜单和节点徽标处增量接线，降低对原 Explorer 行为的扰动。
- **验证：** `pnpm --dir app exec tsc --noEmit --pretty false` 通过；相关 core 与路径测试通过。

### 切片⑤ · L3 内容入口收紧
- **行为：** FileTree 只在扫描到的真实 L3 节点及其自由子目录内显示新建文件/文件夹；普通第 4 层目录链不因深度足够而放行。
- **RED：** `src/lib/__tests__/eidon-paths.test.ts` 新增 `canCreateContentInScannedL3` 行为测试，普通 `L1/L2/Plain/free` 应拒绝。
- **GREEN：** `src/lib/eidon-paths.ts` 新增 `canCreateContentInScannedL3(relativeDirPath, l3NodePaths)`；FileTree 从 `scannedNodes` 派生 L3 路径集合并调用该 helper。
- **REFACTOR：** 保留全局 open/save 的路径级守卫 `canWriteContentFileInEidonWorkspace`，FileTree 入口使用更强的扫描节点证据，二者职责分离。
- **验证：** `pnpm --dir app exec vitest run src/lib/__tests__/eidon-paths.test.ts src/composables/__tests__/useFiles.test.ts` 通过，2 files / 10 tests。

## 接口变化
- `core/nodes`：新增 `NodeStore`、`createNode`、`promoteFolderToNode`、`renameNode`、`moveNode`、`updateNodeFields`。
- `core/bridge/file`：新增 workspace 相对 `createWorkspaceFileStore`，通过现有 `editor/file_ops` 命令读写 `.node/` 与 `.eidon/`。
- `src/stores/nodes`：新增 Zustand store，暴露 scan/create/promote/rename/move/updateFields 与绝对路径转相对路径。
- `src/components/FileTree.tsx`：节点感知渲染、节点创建/提升/字段/移动入口、L3 内容入口收紧。
- `src/components/NodeCreateDialog.tsx`：创建/提升节点表单，按模板层渲染字段。
- `src/components/NodeInspector.tsx`：按节点绑定的模板版本编辑字段；模板缺失时展示孤儿字段 JSON。
- `src/lib/eidon-paths.ts`：新增 `canCreateContentInScannedL3`。

## 偏离计划
- 生产文件边界没有新增 Rust 命令，而是复用现有 `list_dir`/`read_file`/`write_file`/`fs_create_dir`/`fs_rename`/`fs_delete`，符合 roadmap “Rust 侧优先零新增”。
- UI 测试没有引入 jsdom/RTL；当前 Vitest 环境是 node。UI 接线由 TypeScript、FileTree 纯路径 helper 测试和 core API 测试覆盖，端到端运行验证留给 dev server/手测或后续 UI harness。

## 剩余切片
- 阶段2 无剩余必做切片。阶段3 继续处理一致性检测与版本/搜索/删除复用接线；阶段4 做品牌与端到端验收收口。
