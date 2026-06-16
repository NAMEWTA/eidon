# ADR-0023：为历史版本上限加入 git 修剪能力

**日期：** 2026-06-16  
**状态：** 已采纳  
**轨道：** 节点功能  
**相关 ADR：** 0015（快照复用现有 git）

---

## 上下文

EIDON 使用 AutoGit（ADR‑0015）为每次保存创建本地 git 快照。ADR‑0015 原文声明「本期不实现任何快照功能、autoGit 无需任何修改」。上线后被反馈仓库 `.git` 随日常使用持续膨胀、历史面板无上限也不可控——用户需要一个显式的版本历史上限。

## 决定

**扩展 `core/snapshots` 与 Rust `git_history` 模块，添加历史修剪能力：**

1. **新 Rust 模块** `src-tauri/src/git/git_prune.rs`（两个原子命令）：
   - `git_repo_size(folder) -> u64`：遍历 `.git/` 目录报告字节数（纯显示，无破坏性）。
   - `git_prune_history(folder, max_commits)`：读取 HEAD 一级父链 → 截断最旧的 `len - max_commits` 个提交，把保留部分的树重建为新的线性历史 + 运行系统 `git gc --prune=now`（若 git CLI 可用）回收磁盘。**仅在本机 git 缓存操作、不动 plain-file 真理源。**
2. **前端设置：**
   - `historyMaxVersionsPerFile`：历史面板显示上限（仅显示不改写）。
   - `historyMaxCommits`：整仓最大提交数（0 = 不限），自动提交后去抖修剪。
   - `historyMaxGitSizeMb`：`.git` 最大体积 MB（0 = 不限），gc 执行后仍超则逐步减半重修剪。
   - 默认值全部宽松（50 / 0 / 0），须用户显式设上限才触发修剪。
3. **前端 UI：** `SettingsPanel` 的「同步」区嵌入 `HistorySettings`（体积显示 + 数字输入 + 手动按钮）。
4. **编排：** `lib/history-prune.ts`：去抖调度 + 带界迭代（防死循环）；`useAutoCommit` 在每次成功提交后触发调度。

## 后果

- **打破 ADR‑0015 的「不做快照功能」约束。** 这个打破是审慎的：修剪只对 git 历史做破坏性压缩，不碰 plain-file 真理源；`.git` 在本仓库的「可重建」铁律中本就豁免（仅本机缓存，丢不丢不影响数据可迁移性）。
- **Rust 命令 +2**：`git_repo_size`、`git_prune_history`——按 ADR‑0009 分别在 `lib.rs`/`runner.rs` 注册。
- **`core/snapshots` 的 `SnapshotGateway` 新增两个方法**：`repoSize` / `pruneHistory`（原薄封装角色被扩展，但仍在接口层面保持隔离）。
- **风险：** `git prune` 不可逆——但保留的下限（≥10）防止误操作；默认 0=不限，老用户完全不受影响。首次启用上限时建议用户先备份 `.git`。
- **AGENTS.md / CLAUDE.md / ADR 索引** 需同步更新。
