> **服务工作流：** `../../../../workflows/dev/H-diagnose/H-diagnose.md`
> **产物文件名：** `diagnosis.md`

# Diagnosis

## 用户症状

保存（⌘S）时 toast 报错：

```
快照失败: Error: Error invoking remote method 'git:autoCommit': Error: file is outside workspace: /Users/wta/Documents/notes/222/3/4/README.md
```

终端 main 进程同步抛出同一异常（`app/out/main/index.js` → `autoCommit`）。

## 反馈循环

- 主循环：`pnpm dev` + 保存 `222/3/4/README.md` → 观察终端与 toast。
- 确定信号：`pnpm test:core` 新增 `git-client` / `ops` 单测（symlink relPath + 越界 autoCommit 不抛错）。

## 复现结果

- 稳定复现：打开工作区内 L3 路径文件 → ⌘S → `git:autoCommit` 硬抛 `file is outside workspace`。
- 用户确认：文件**在工作区内**，属别名/符号链接导致 `currentFolder` 与 `filePath` 字面前缀不一致。
- 终端日志（2026-06-26 08:59）：`folder` 与 `filePath` 未在同一字面路径树下，`relPath` 返回 `null`。

## 假设列表

1. **relPath canonical 兜底不足**（已确认）：`git-client.relPath` 仅对父目录 realpath，`realpathSync(dir)` 抛错时整段 fallback 失败；中间段 symlink/别名未覆盖。预测：硬化 relPath 后 inside-alias 可解析相对路径。
2. **autoCommit 对越界 filePath 硬抛**（已确认）：`ops.autoCommit` 在 `rel === null` 时 throw，阻断整次快照；而 `autoCommit(null)` 本意为全量暂存。预测：软降级为 `pathspec = null` 后保存不再 toast 失败。
3. **currentFolder 持久化为另一真实目录**（已排除）：用户确认文件在工作区内；更可能是别名而非陈旧 MRU。
4. **活动 tab filePath 来自工作区外打开**（已排除）：用户选择 inside-alias。

## 插桩结果

- 在 `autoCommit` 的 `rel === null` 分支加入 `console.warn`，打印 `folder`、`filePath`、`canonFolder`、`canonParent`（与修复合并：warn 后回退全量 stage，不再 throw）。
- 静态分析 + 用户 inside-alias 确认：根因 = 假设 1 + 2 叠加；无需再阻塞于人工复现插桩值。
