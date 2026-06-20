# ADR-0020 · 节点级待办 + 定时提醒 + 通知子系统

**状态：** 已锁定
**日期：** 2026-06
**分支：** `refactor/eidon-base`

## 动机

EIDON 是本地优先的结构化知识 IDE。节点（尤其唯一内容承载层 L3）需要轻量待办 + 定时提醒能力：
落在节点本地、随节点迁移、完全离线、删缓存可重建。原 SoloMD 无此能力，本期新建。

## 决策与落点

依 AGENTS.md §4.1 第 5 条「新增其它功能域」，新增节点级功能模块：

- **`app/backend/domain/todos`（框架无关 TS）** 职责二分：
  1. 磁盘读写：每节点 `<nodePath>/.node/todos.json`（契约 `NodeTodoFileSchema`）；缺文件/坏 JSON 一律回退空文件，保「删缓存 → 遍历 `.node/` 100% 重建」不被单坏文件中断。
  2. 纯计算：`nextFireTime` / `collectDue` / `earliestFireAt`（提醒下次触发 / 到期筛选 / 最近一条），全纯函数、可在 Node 下单测。
  - **不 import `nodes` domain 内部**：节点路径列表由 UI 层喂入（`NodeRef`），避免对万级文件做第二次全树遍历。
  - **批量 IO**：`scanTodos` 用 `Promise.all` 并行读多节点，不逐节点 await（性能铁律）。
- **编排** `app/backend/services/todo-service`：构造注入端口 → 调 domain → 过 shared/contracts → emit（如有事件）。
- **契约（ADR-0014）**：`app/shared/contracts/todos.ts`（`NodeTodoFile` / `TodoItem` / `Reminder`）；golden fixture `fixtures/contracts/todos.l3.json` + conformance 测试。
- **通知出口**：`app/bridge/ipc/notification.ts` 前端包装 → `backend/ipc/handlers/native.handlers.ts` 接线 → Electron `Notification` API（main process）。
- **调度**：`app/frontend/lib/reminder-scheduler.ts` 据 `earliestFireAt` 只挂一个 `setTimeout`，到点派发通知后按 `nextFireTime` 滚动 / 标记 `notified` 写回。
- **UI**：`TodoListPanel`（全局聚合）/ `TodoCreateDialog` / `TodoRow` + `CalendarPanel`（日历整理箱）；store=`frontend/stores/todos.ts`（数据源=磁盘，**不**入 localStorage；节点列表取自 `useNodesStore`）。
- **IPC 通道**：`todos:scan` / `todos:readNode` / `todos:writeNode`（在 `shared/ipc/channels.ts` 注册，`backend/ipc/handlers/todos.handlers.ts` 接线）。

## 非功能约束

- **离线**：无任何联网依赖。
- **可迁移 / 可重建**：待办随节点 `.node/todos.json` 自包含，拷贝 workspace 即带走；删 `.eidon/` 缓存不影响（真理源是 `.node/` plain files）。

## Consequences

- `pnpm lint && pnpm typecheck && pnpm test:core && pnpm contracts:check` 全绿。
- 测试落点：`app/shared/__tests__/contracts/todos.conformance.test.ts` + `app/backend/domain/__tests__/todos/`。

---
> **注：** 实现路径以 ADR-0025（四层架构）与 AGENTS.md §2 / 代码为准。
