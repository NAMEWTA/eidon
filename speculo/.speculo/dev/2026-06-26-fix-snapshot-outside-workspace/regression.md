> **服务工作流：** `../../../../workflows/dev/H-diagnose/H-diagnose.md`
> **产物文件名：** `regression.md`

# Regression

## 确认原因

**根因（双重叠加）：**

1. `app/backend/capabilities/git/git-client.ts` 的 `relPath` 在 workspace 根或文件路径存在符号链接/别名时，canonical fallback 不完整（`realpathSync(dir)` 抛错即整段失败；未对完整文件路径 realpath）。
2. `app/backend/capabilities/git/ops.ts` 的 `autoCommit` 在 `relPath` 返回 `null` 时硬抛 `file is outside workspace`，阻断整次快照；而 `pathspec = null` 本就是「全量暂存工作区」语义。

**排除：** `currentFolder` 持久化为完全不同目录（用户确认 inside-alias）；未改 `workspace.ts` 归一化。

## 回归测试

| 文件 | 用例 |
|------|------|
| `app/backend/capabilities/git/__tests__/git-client.test.ts` | 普通相对路径；workspace 为 symlink 别名；越界返回 null |
| `app/backend/capabilities/git/__tests__/ops.test.ts` | 越界 `filePath` 不抛错且仍能提交；工作区内单文件路径可提交 |

## 修复摘要

- **`relPath`**：`realpathSync(dir)` try/catch 回退；文件存在时对完整路径 realpath 再 stripPrefix；父目录 canonical 仍保留。
- **`autoCommit`**：`rel === null` 时 `console.warn` + 回退 `pathspec = null`（全量 stage），不再 throw。
- **用户可见：** 保存不再出现 `快照失败: file is outside workspace`；别名根下文件应能正常进 per-file 历史；极端越界仍全量快照工作区。

## 重新验证

```
pnpm lint        ✓
pnpm typecheck   ✓
pnpm test:core   ✓ 141 passed（含 5 条新增 git 单测）
```

手动：`pnpm dev` 保存 `222/3/4/README.md` — 待用户确认 toast 与 History 面板。

## 清理与后续

- 保留 `[git:autoCommit]` warn 作为运维信号（非临时插桩）。
- 若仍有个别路径无法 relPath 解析，可考虑在 `setFolder` 时 `realpathSync` 归一 workspace 根（本期未做）。
