> **服务工作流：** `../03-tdd/03-tdd.md`
> **产物文件名：** `tdd/phase3-consistency/tdd-plan.md`

# TDD Plan — 阶段3·一致性检测 + 复用整合

## 阶段标识
`phase3-consistency`

## 切片来源
来自 PRD US-13/14 + roadmap 阶段3。对齐工程层 ADR-0015（版本/diff 直接用现有 git，`core/snapshots` 仅薄封装）与 ADR-0016（结构违规检测+FileTree 标记，不自动改写）。

## 公共接口
- `core/consistency/index.ts`
  - `detectStructureViolations(reader)`：只读扫描 workspace，返回 `violations` 与 `byPath`。
  - 违规类型：`plain-folder-in-node-zone`、`content-file-in-organizer`、`level-mismatch`、`node-metadata-invalid`。
- `core/snapshots/index.ts`
  - `getSnapshotStatus`、`initSnapshotHistory`、`commitSnapshot`、`listFileSnapshots`、`diffFileSnapshot`、`readFileSnapshot`、`restoreFileSnapshot`。
  - 通过可注入 `SnapshotGateway` 代理现有 git bridge，不新增快照语义。
- `src/components/FileTree.tsx`
  - 扫描一致性报告并渲染违规徽标。
  - 用户点击后手动 `Promote to node`、`Move into L3`、`Delete`；不自动修复。

## 行为优先级
1. 违规检测必须覆盖四类 roadmap 指定结构违规。
2. 检测必须只读，不能写 `.node/node.json`、不能移动或删除用户文件。
3. FileTree 打标并阻止直接打开 L1/L2 非白名单内容文件。
4. 版本/历史/diff/恢复走 `core/snapshots` 到既有 git bridge，不建 `.eidon/snapshots.git`。
5. 删除与搜索继续复用现有 FileTree 删除和 GlobalSearch，不新增平行系统。

## 第一个 Tracing Slice
切片①：外部构造含四类违规的临时 workspace，调用 `detectStructureViolations`。

失败信号：`core/consistency` 模块不存在，或检测缺类、写盘导致前后文件快照不一致。

成功判据：四类违规全部返回，L3 内容和第 4 层自由目录不误报，扫描前后文件快照完全一致。

## 验证命令
- `pnpm --dir app exec vitest run core/__tests__/consistency/consistency.test.ts`
- `pnpm --dir app exec vitest run core/__tests__/snapshots/snapshots.test.ts`
- `pnpm --dir app exec vitest run src/lib/__tests__/eidon-paths.test.ts`
- `pnpm test:core`
- `pnpm contracts:check`
- `pnpm --dir app exec tsc --noEmit`
- `pnpm lint`
