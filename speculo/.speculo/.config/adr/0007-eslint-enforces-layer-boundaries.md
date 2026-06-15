# ADR-0007 · 三层边界由 ESLint 在 CI 强制

`src → core → src-tauri` 单向链 + Core 内部依赖规则由 `eslint-plugin-boundaries` + `no-restricted-imports` 机器强制（`app/eslint.config.mjs`），CI 拦截：`core/bridge/` 之外禁止 `invoke()` / import `@tauri-apps/api`（allowlist 维持 0）；`src/` 不得直触 Tauri；`core/` 禁止 import `react` / `zustand` / 任何 UI 框架；业务模块不得 import 对方内部路径。
