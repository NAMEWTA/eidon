# Project Rules

记录跨所有 Speculo workflow 必须遵守的项目硬约束。

本文件由用户维护。AI 可以读取并遵守，但不得自动修改，除非用户明确要求。

## Rules

### 1. 单向依赖铁律

`frontend → bridge → backend(ipc→service→{domain,capability}) + shared`，ESLint 机器强制。不得绕过。
详见 AGENTS.md §2.1、ADR-0025。

### 2. 唯一接缝

`preload/` contextBridge `window.eidon` 是 frontend↔backend 唯一通信出口。禁止 frontend/bridge 直接 import `electron` 或 `ipcRenderer`。

### 3. 禁止清单

- `@tauri-apps/*` 全局永久禁止
- `electron` 仅限 `preload/` + `backend/{shell,ipc}`
- `react`/`zustand` 禁止在 `shared/`、`bridge/`、`backend/{domain,capabilities,services}` 中使用

### 4. 磁盘契约改动流程

改 `.node/node.json` / template / `.eidon` 形状：**先改 `shared/contracts/*.ts`（zod）+ `fixtures/contracts/` golden fixtures，再改解析**。`pnpm contracts:check` 必须绿。

### 5. Typed IPC 穷尽性

新增 IPC 通道必须在 `shared/ipc/channels.ts` 的 `IpcContract` 中声明 + 补全 `CHANNEL_PRESENCE`。`backend/ipc/register.ts` 启动时校验 handler 全覆盖（漏接即抛错）。

### 6. 提交前最低限度

`pnpm lint && pnpm typecheck && pnpm test:core` 全绿。改动磁盘契约时加跑 `pnpm contracts:check`。

### 7. 「分层」术语消歧

禁止裸用「三层」/「分层」。必须显式限定为「【代码】分层（四层）」或「【节点】三层」。
详见 AGENTS.md §0。
