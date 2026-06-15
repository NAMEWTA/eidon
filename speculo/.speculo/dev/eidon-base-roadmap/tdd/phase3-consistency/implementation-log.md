> **服务工作流：** `../03-tdd/03-tdd.md`
> **产物文件名：** `tdd/phase3-consistency/implementation-log.md`

# Implementation Log — 阶段3·一致性检测 + 复用整合

## 阶段标识
`phase3-consistency`

## 循环记录

### 切片① · 四类结构违规只读检测
- **行为：** `detectStructureViolations` 检测前三个物理深度里的普通文件夹、L1/L2 内容文件、节点 level 与物理深度不符、`.node/node.json` 缺失/损坏。
- **RED：** `core/__tests__/consistency/consistency.test.ts` 构造四类违规 workspace，模块缺失或检测缺类时失败。
- **GREEN：** 新增 `core/consistency/index.ts`，以注入 reader 只读遍历，解析 `NodeSchema`，按路径生成 `violations` 和 `byPath`。
- **REFACTOR：** 抽 `readNodeState`、`pushViolation`、`ORGANIZER_FILE_ALLOWLIST`，保证检测逻辑可读且不引入写操作。
- **验证：** `pnpm --dir app exec vitest run core/__tests__/consistency/consistency.test.ts` 通过。

### 切片② · FileTree 违规标记与手动整改入口
- **行为：** FileTree 打开/刷新 workspace 时扫描一致性，节点行显示违规徽标；L1/L2 内容文件点击打开被阻止；用户可手动提升普通文件夹或把非法内容移动到指定 L3。
- **RED：** FileTree 没有 `violationsByPath`、不渲染违规标记、直接打开 organizer 内容文件时违背 PRD US-13。
- **GREEN：** FileTree 接入 `detectStructureViolations(createWorkspaceFileStore(path))`，渲染 `ftree__violation-badge`，上下文菜单新增 `Promote to node` 与 `Move into L3`。
- **REFACTOR：** 整改仍复用既有节点 API 与 `fs_rename`，未增加自动修复流程。
- **验证：** `pnpm --dir app exec tsc --noEmit --pretty false` 通过；一致性 core 测试通过。

### 切片③ · 版本能力归属薄封装
- **行为：** EIDON 数据层通过 `core/snapshots` 暴露版本/历史/diff/恢复 API，但只调用现有 git bridge。
- **RED：** `core/__tests__/snapshots/snapshots.test.ts` 注入 fake gateway；若 `core/snapshots` 不存在或参数映射错误则失败。
- **GREEN：** 新增 `core/snapshots/index.ts`，把 `workspaceStatus`、`initWorkspace`、`autoCommit`、`fileHistory`、`fileDiff`、`fileAtVersion`、`rollbackFile` 映射为 EIDON 公共 API。
- **REFACTOR：** 类型别名复用 `core/bridge/git`，不重测 Rust git 实现。
- **验证：** `pnpm --dir app exec vitest run core/__tests__/snapshots/snapshots.test.ts` 通过。

### 切片④ · 删除 / 搜索复用检查
- **行为：** 删除继续走 FileTree 现有 `fs_delete`；搜索仍由 `GlobalSearch` 与 workspace index 提供；不新建 parallel deletion/search 模块。
- **RED：** 若新增 `.eidon/trash` 或并行搜索模块，将超出 roadmap 阶段3 范围。
- **GREEN：** 保持 FileTree 删除逻辑与 App 右侧 `GlobalSearch` 挂载不变，仅在 FileTree 上叠加节点/违规信息。
- **REFACTOR：** 无。
- **验证：** 代码审计：`FileTree.tsx` 删除仍调用 `fs_delete`；`App.tsx` 仍挂 `GlobalSearch`；无 `.eidon/trash` 实现。

## 接口变化
- 新增 `core/consistency` 公共模块与 `StructureViolation` 数据形状。
- 新增 `core/snapshots` 公共模块，作为版本能力归属出口。
- `FileTree.tsx` 新增一致性扫描、违规徽标和手动整改入口。

## 偏离计划
- 未做独立一致性面板、自动补全、自动整理、回收站三关，均为 roadmap OUT。
- `core/snapshots` 没有新增任何磁盘目录或快照仓库，严格按 ADR-0015 只薄封装现有 git。

## 剩余切片
- 阶段3 无剩余必做切片。阶段4 继续完成品牌/系统区/端到端验收收口。
