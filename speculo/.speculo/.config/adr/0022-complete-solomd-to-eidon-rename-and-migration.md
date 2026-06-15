# ADR-0022 · 完成 solomd → eidon 全量改名（pre-launch，无迁移垫片）

**状态：** 已锁定
**扩展：** [ADR-0017](./0017-rename-solomd-to-eidon.md)（包名 + `.eidon` 系统区改名）
**订正：** [ADR-0019](./0019-physically-remove-ai-subsystem-keep-interface-stub.md) 保留物表中「`.solomd/` 运行时目录，EIDON 不读不写」一行——实为被保留的 GitHub 同步 / E2EE 模块在用，本 ADR 一并改名为 `.eidon-sync/` + `.eidon-encrypted/`。
**日期：** 2026-06
**分支：** `refactor/eidon-base`

## 动机

ADR-0017 完成了包名与 `.eidon/` 系统区改名，但代码内部仍遍布 `solomd` 标识：前端持久化键、
运行时 / Tauri 事件名、DOM 全局 / CSS 类 / 环境变量、工作区 `.solomd/` 目录、OS 钥匙串服务名、
甚至加密 wire-format 常量。EIDON 是一次**完整产品迭代重构、尚未上线**（ADR-0011），**不背任何
向后兼容 / 用户兼容包袱** —— 故一次性彻底改名，**不留任何迁移垫片**。

## 范围：全部改名为 eidon

| 面 | 改动 |
|----|------|
| 前端 localStorage 键 | `solomd.*` → `eidon.*`（settings/workspace/tabs/tiles/pomodoro/writingSession/recentEdits/session/basesViews/update 等） |
| 运行时 CustomEvent | `solomd:*` → `eidon:*`（发射 + 监听同改） |
| Tauri 事件 | `solomd://*` → `eidon://*`（Rust 发射 + TS 监听同改） |
| DOM 全局 / CSS / sentinel / env | `__solomd*`→`__eidon*`、`.solomd-print*`→`.eidon-print*`、`solomd-custom-theme`→`eidon-custom-theme`、`__solomd_truncated__`（跨层）、`SOLOMD_APP_STORE_BUILD`→`EIDON_APP_STORE_BUILD`、`"SoloMD CJK"`→`"EIDON CJK"`（字体名，已与 main.css 用法对齐，原本错配导致内嵌 CJK 字体不生效） |
| 工作区 / 用户级目录 | `.solomd/`→`.eidon-sync/`、`.solomd-encrypted/`→`.eidon-encrypted/`、盐 `.solomd-vault.json`→`.eidon-vault.json`、`~/.solomd/`→`~/.eidon-sync/`、`~/.solomd-language`→`~/.eidon-language`；FileTree / eidon-paths 的系统目录隐藏表同步补上 `.eidon-sync` / `.eidon-encrypted` |
| OS 钥匙串服务 | `solomd-encryption-key`→`eidon-encryption-key`、`solomd-github`→`eidon-github` |
| 加密 wire-format | `FILE_MAGIC` `b"SLMD"`→`b"EIDN"`、nonce 派生输入 `solomd-nonce-v1`→`eidon-nonce-v1`、探针 `SoloMD probe v1`→`EIDON probe v1` |

## 决策：不做迁移垫片

尚未上线、无存量用户数据，**不写任何 old→new 搬迁 / 回退代码**：

- **无** `migrate-keys.ts`（localStorage 不迁移，旧 `solomd.*` 键直接弃用）。
- **无** 钥匙串读时回退、**无** 工作区 / 用户级目录 `fs::rename` 搬迁。
- **加密 wire-format 一并改**（无存量加密库，无需冻结）；如本机开发期残留旧加密库，重新启用 E2EE 即可。

旧 `solomd.*` 状态若有（开发期自测残留），由开发者自行清理；不属本仓库职责。

## 附带清理（外部基建依赖归零）

随本轮删除依赖 `solomd.app` 域名的两处远程功能（pre-launch，用户后续自建）：

- **远程主题市场**：删孤儿 `stores/themes.ts` + `editor/themes.rs`（`theme_install`/`uninstall`/`list_installed`）+ 其在 `lib.rs`/`runner.rs` 的挂载与注册。**内置主题预设 + 自定义 CSS 主题保留不动。**
- **更新检查代理**：`check-update.ts` 去掉 `solomd.app/api/stats` 源，仅留 GitHub releases（eidon 仓库）直查。

## Consequences

- `pnpm lint && pnpm build && pnpm test:core && pnpm contracts:check` + `cd app/src-tauri && cargo check && cargo test` 全绿。
- 代码内 `solomd` 残留**归零**，仅剩 `core/ai/{index.ts,README.md}` 两处 `原 SoloMD …` 历史性说明（描述已删 AI 子系统的来历，属 ADR-0019 范畴，保留）。
