# Docs Sync Report

> **服务工作流：** `dev/D-docs-sync/D-docs-sync.md`
> **Change：** `2026-06-16-docs-sync-init`
> **日期：** 2026-06-16

## Range

首次运行（全量审计模式）。基线 `5ca3181` == HEAD，无增量 diff。

## Diff Summary

不适用。用户要求全量审计（对照代码库逐项核查），非 git-diff 差量同步。

## Mapping

| 问题 | 文件 | 修正 |
|------|------|------|
| ADR-0023 存在于 `adr/` 目录但未列入索引 | AGENTS.md §7 | 追加 `0023（git 历史修剪能力，扩展 0015）` |
| 技术栈表缺少 Vite（实际构建工具） | README.md | UI 行追加 `+ Vite`，与 AGENTS.md §1.2 对齐 |
| 缺少对外文档交叉引用 | README.md | 新增「相关文档」小节，链接 AGENTS.md / CLAUDE.md / ADR / docs/ |

## Synced Docs

- **README.md** — 技术栈补 Vite + 新增相关文档小节
- **AGENTS.md** — §7 ADR 索引补 ADR-0023

## Verification

`pnpm lint` + `pnpm test:core` 不受文档修改影响（仅 .md 文件变更）。

## State

| 字段 | 旧值 | 新值 |
|------|------|------|
| `last_sync_sha` | `5ca3181b...` | `5ca3181b...`（不变，HEAD 未推进） |
| `total_syncs` | `0` | `1` |
| `synced_docs` | `[]` | `["README.md", "AGENTS.md"]` |
| `last_sync_run_at` | `2026-06-16T11:18:58Z` | `2026-06-16T11:26:46Z` |
