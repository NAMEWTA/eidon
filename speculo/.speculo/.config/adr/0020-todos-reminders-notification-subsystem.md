# ADR-0020 · 节点级待办 + 定时提醒 + 通知子系统

**状态：** 已锁定
**日期：** 2026-06
**分支：** `refactor/eidon-base`

## 动机

EIDON 是本地优先的结构化知识 IDE。节点（尤其唯一内容承载层 L3）需要轻量待办 + 定时提醒能力：
落在节点本地、随节点迁移、完全离线、删缓存可重建。原 SoloMD 无此能力，本期新建。

## 决策与落点

依 AGENTS.md §4.1 第 5 条「新增其它功能域 → `core/` 建并列业务模块」，新增第 5 个 core 业务模块
`core/todos`（**不属** EIDON 数据层四模块，是节点级功能模块）：

- **`core/todos`（框架无关 TS）** 职责二分：
  1. 磁盘读写：每节点 `<nodePath>/.node/todos.json`（契约 `NodeTodoFileSchema`）；缺文件/坏 JSON 一律回退空文件，保「删缓存 → 遍历 `.node/` 100% 重建」不被单坏文件中断。
  2. 纯计算：`nextFireTime` / `collectDue` / `earliestFireAt`（提醒下次触发 / 到期筛选 / 最近一条），全纯函数、可在 Node 下单测。
  - **不 import `core/nodes` 内部**：节点路径列表由 UI 层喂入（`NodeRef`），避免对万级文件做第二次全树遍历。
  - **批量 IO**：`scanTodos` 用 `Promise.all` 并行读多节点，不逐节点 await（性能铁律，§5）。
- **契约（ADR-0014）**：`core/contracts/todos.ts`（`NodeTodoFile` / `TodoItem` / `Reminder`），re-export 自 `core/contracts/index.ts`；golden fixture `fixtures/contracts/todos.l3.json` + conformance 测试。
- **通知出口（ADR-0007）**：`core/bridge/notification.ts` 是唯一 Tauri 通知出口；`capabilities/default.json` 增 `notification:default/allow-notify/allow-is-permission-granted/allow-request-permission`，依赖 `@tauri-apps/plugin-notification`。
- **调度**：`src/lib/reminder-scheduler.ts` 据 `earliestFireAt` 只挂一个 `setTimeout`，到点派发通知后按 `nextFireTime` 滚动 / 标记 `notified` 写回。
- **UI**：`TodoListPanel`（全局聚合）/ `TodoCreateDialog` / `TodoRow` + `CalendarPanel`（日历整理箱）；store=`src/stores/todos.ts`（数据源=磁盘，**不**入 localStorage；节点列表取自 `useNodesStore`）。

## 非功能约束（呼应 §5）

- **离线**：无任何联网依赖。
- **可迁移 / 可重建**：待办随节点 `.node/todos.json` 自包含，拷贝 workspace 即带走；删 `.eidon/` 缓存不影响（真理源是 `.node/` plain files）。

## Consequences

- `pnpm lint && pnpm test:core && pnpm contracts:check && pnpm build` 全绿；`cargo check` 绿。
- `core/` 业务模块由「数据层四模块」扩为「四模块 + `todos` 功能模块」，AGENTS.md §2.2 已同步。
- 测试落点遵循统一约定：`core/__tests__/todos/`（与 nodes/templates 等一致）+ `core/__tests__/contracts/todos.conformance.test.ts`。
