> **服务工作流：** `../03-tdd/03-tdd.md`
> **产物文件名：** `tdd/phase2-node-topology/tdd-plan.md`

# TDD Plan — 阶段2·节点拓扑闭环

## 阶段标识
`phase2-node-topology`

## 切片来源
来自 PRD US-7/8/9/10/11/12/14 + roadmap 阶段2。对齐工程层 ADR-0012（节点能力落 `core/nodes`）、ADR-0013（固定三层【节点】拓扑、深度=层级、L1 选模板且 L2/L3 继承父链）、ADR-0014（`.node/node.json` 写盘先过 zod 契约）、ADR-0016（提升为节点由用户点击触发）。

本阶段实现范围：节点 CRUD/提升的 core 数据层 + 生产可接线的文件系统边界 + 最小 UI 接线所需公共数据形状。节点感知 FileTree、NodeCreateDialog、NodeInspector 在 core 绿后继续作为同阶段后续切片接入。

## 公共接口
- `core/nodes/index.ts`
  - 扩展 `WorkspaceReader` 为可写 `NodeStore`：`listDir/readFile/writeFile/createDir/rename/exists`，路径均为 workspace 相对 POSIX 路径。
  - `createNode(store, { parentPath, name, templateLayer, fields?, now? })`：按 `parentPath` 物理深度创建 L1/L2/L3；L1 使用所选模板层，L2/L3 从父节点继承 `templateId/schemaVersion`；生成 `.node/node.json`、`README.md`、`AGENTS.md`。
  - `renameNode(store, { path, newName })`：重命名目录，`.node/node.json` 不改，ID 稳定。
  - `moveNode(store, { path, newParentPath })`：移动目录，只允许移动到能保持节点 `level` 与物理深度一致的位置；ID 稳定。
  - `promoteFolderToNode(store, { path, templateLayer, fields?, now? })`：把现有普通文件夹按当前物理深度提升为 L1/L2/L3 节点；已有文件不自动移动。
  - `updateNodeFields(store, { path, templateLayer, fields })`：按模板字段写扩展字段到 `node.json`。

## 行为优先级
1. 创建期硬强制：根→L1、L1→L2、L2→L3；L3 下不能再创建结构节点；L2/L3 必须继承父链模板。
2. 磁盘落点：每个结构节点目录包含 `.node/node.json`、`README.md`、`AGENTS.md`，写盘对象通过 `NodeSchema`。
3. 字段表单底座：6 类字段值按模板校验并写入 `fields`；未知字段拒绝。
4. 维护行为：重命名、移动后 ID 不变，扫描的 id→path 更新。
5. 存量转化：普通文件夹由用户触发提升为节点，保留已有内容，不自动整理。

## 第一个 Tracing Slice
切片①：`createNode` 从空 workspace 创建 L1→L2→L3，并用 `scanWorkspace` 重建出稳定 id→path。

失败信号：新增 `core/__tests__/nodes/crud.test.ts` 导入未定义的 `createNode`，测试红。

成功判据：三层【节点】目录、`.node/node.json`、README/AGENTS 均落盘；L2/L3 的 `templateId/schemaVersion` 继承 L1；`scanWorkspace` 能重建 3 个节点与映射。

## 验证命令
- `pnpm --dir app exec vitest run core/__tests__/nodes/crud.test.ts`
- `pnpm test:core`
- `pnpm contracts:check`
- `pnpm --dir app exec tsc --noEmit`
- `pnpm lint`
