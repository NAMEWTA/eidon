# ADR-0006 · Core 采用「内核 + 业务模块 + 单向依赖规则」结构

`core/` 分稳定内核（`bridge/` 唯一 Tauri 出口、`contracts/` zod 契约、`shared/` 纯工具）与业务模块（各自 `index.ts` 暴露公共 API）。依赖规则：业务模块只依赖内核与 `shared`、不互相 import 内部；只有 `bridge/` 能 import `@tauri-apps/api`；全层禁止 UI 框架（保证可在 Node 下纯函数式单测）。

EIDON 数据层按本规则新增**四个并列业务模块** `core/nodes` / `core/templates` / `core/snapshots` / `core/consistency`（详见 ADR-0012）。

## Consequences

新功能域唯一落点 = `core/` 新业务模块文件夹（含 `index.ts`）；如需 Rust 能力，则在 `src-tauri/src/` 建对称领域文件夹（ADR-0009）。
