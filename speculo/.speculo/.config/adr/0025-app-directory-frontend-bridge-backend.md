# ADR-0025 · app/ 目录 = frontend → bridge → backend + shared 单向四层

**状态：** 已执行（2026-06）

## 背景

`app/` 早期为 `src(渲染) → shared(契约+domain) → main(ipc→capability)` 三层【代码】，但实际调用链已**混态**：

1. **业务逻辑散落三处**：`shared/domain/*`（节点/模板/待办/一致性）在**渲染侧双跑**；`src/composables/useFiles` 等是隐式 service 层；`src/stores/*` 在 Zustand store 里做编排——没有单一后端编排层。
2. **`src/lib/` 杂物间**（~50 文件）混放 6 种性质代码（CodeMirror 扩展 / 业务解析 / 导出 / 纯工具 / 持久化 / UI 配置）。
3. **wire 类型残留蛇形字段**（`had_bom`/`is_dir`/`head_sha`…），属早期接口历史遗留，已无约束。
4. **`shared/domain/` 既定义类型又实现业务逻辑**，违反「共享层仅数据模型」。
5. **`src/ipc/` 桥接设计良好但地位模糊**（名义上是渲染层内部工具，实为架构支柱）。

**决策：** 重构为严格单向四层 **`frontend(纯 UI) → bridge(桥接) → backend(接收→编排→业务→底层资源) + shared(数据模型/契约/纯工具)`**，业务逻辑全部归后端、ESLint 机器强制边界。本 ADR 经 Grill Me 压力测试锁定 8 项子决策（产物见 `speculo/.speculo/commands/2026-06-19-grill-me-app-directory-refactor/report.md`）。

## 已确认的子决策（D1–D8）

1. **D1 业务逻辑全入 backend**：`shared/domain/*` 迁 `backend/domain/`，经 IPC 通道暴露（前端零业务逻辑）。
2. **D2 backend 三层**：`ipc(接入) → services(编排) → {domain(业务规则,注入端口)/capabilities(底层资源,纯 node)}`；domain 纯函数注入端口，可脱 electron 单测。
3. **D3 bridge 顶层目录**：前后端契约边界提升为与 frontend/backend/shared 平级的顶层。
4. **D4 store 瘦身为 UI 缓存**：保留 Zustand store（细粒度订阅性能），但改调 bridge IPC，不再 import domain。
5. **D5 `src/lib` 按性质拆分**：纯解析器 → `shared/utils`（可两端共用）/ CodeMirror 扩展、UI 辅助 → frontend / 业务约束、导出 → backend。
6. **D6 `shared/models` 与 `contracts` 分离**：models = 纯 TS 类型（实体/VO/注入端口/wire 形状）；contracts = zod 磁盘契约（单一事实源）。
7. **D7 wire 类型统一 camelCase**：消除蛇形历史包袱（`hadBom`/`isDir`/`headSha`…），生产端（backend capabilities）与消费端（frontend）同步。
8. **D8 单提交历史**：分阶段推进、每阶段可验证，末尾 squash 为一个干净 commit。

## 新架构：四层单向链

```
frontend/ (纯 UI；React 19 + Zustand)
  │  只 import bridge + shared；运行时唯一接缝 window.eidon
  ▼
bridge/ (前后端契约边界，渲染侧运行)
  │  ipc/(eidonInvoke + 各域包装 + platform 平台面)；只碰 shared 契约 + window.eidon
  ▼ preload contextBridge（唯一物理接缝）
backend/ (全部后端能力；Electron main + Node)
  │  shell/(壳) → ipc/(handler 接入,穷尽校验 85 通道)
  │            → services/(编排:构造能力层 store → 调 domain → 过契约 → emit)
  │            → { domain/(业务规则,注入端口,可单测) , capabilities/(纯 node:*+库) }
  ▼
shared/ (框架无关叶子；四层皆可 import)
     models/(纯 TS 类型) · contracts/(zod 磁盘契约) · ipc/(通道+事件契约) · utils/(纯函数:id/date/path/calendar/reminders/parsers)
```

**关键变化（相对早期三层）：**
- `src/` → `frontend/`（纯 UI）；`src/ipc/` → `bridge/ipc/`（提升为顶层桥接）；`main/` → `backend/{shell,ipc,services,domain,capabilities}`。
- `shared/domain/` → `backend/domain/`（仅业务逻辑 + 便捷再导出）；类型 → `shared/models/`；纯函数（路径/日历/提醒数学、文本解析）→ `shared/utils/`；`shared/domain-types/` 并入 `shared/utils/`。
- 新增 `backend/services/`（编排层）+ `backend/services/workspace-store.ts`（注入端口的能力层实现，替代渲染侧 `createWorkspaceFileStore`）。
- 新增 21 条数据域 IPC 通道（nodes/templates/todos/consistency），总数 64→85；`shared/ipc/types.ts`（蛇形 wire）删除，形状迁 `shared/models`（camelCase）。
- `src/ipc/client.ts` 的旧命令名兼容 shim + `COMMAND_MAP` 删除；调用点改类型安全 `eidonInvoke('<域>:<动作>')`。
- ESLint `eslint-plugin-boundaries` 边界改为四层单向；domain/capability/service 禁 electron（可单测），frontend/bridge 禁 electron（只走 window.eidon）。

**原则不变**（仅承载结构调整）：单向依赖 + 唯一后端出口（window.eidon/preload）+ 领域分层 + 磁盘契约单一事实源 + typed IPC 穷尽校验。

## 取代关系

- **取代 0006**（Core「内核+业务模块」结构）：`core/` 命名与结构由 `backend/{domain,services}` + `shared/models` 取代；「内核+注入网关业务模块」原则存活。
- **取代 0007**（ESLint【代码】边界）：边界对象从 `src/shared/main` 三层改为 `frontend/bridge/backend/shared` 四层；机器强制原则核心存活、规则更细。

## 落点更新（二次开发）

- **新增节点/模板/待办/一致性能力** → `backend/domain/<域>`（业务规则）+ `backend/services/<域>-service`（编排）+ `shared/ipc/channels`（加通道）+ `backend/ipc/handlers/<域>.handlers`（接线）+ `bridge/ipc/<域>`（前端包装）。
- **新增纯文本解析/路径/时间数学**（两端或渲染侧同步需要）→ `shared/utils`。
- **新增数据类型** → `shared/models`；**改磁盘形状** → `shared/contracts`（zod）+ fixtures 先行。
- **前端禁 import backend**；前端经 `bridge/ipc` 调后端，纯 UI 关注点留 `frontend/`。

## 验证

`pnpm lint`（边界 0 违规）+ `pnpm typecheck`（renderer + backend/preload/shared/bridge 双 tsconfig 0 error）+ `pnpm test:core`（shared+backend）+ `pnpm test:ui`（frontend）+ `pnpm contracts:check` + `electron-vite build`（三进程）全绿。

## 后续（已落地）

四层架构落定后又完成一轮规范化清理：组件按角色细分组（`layout/navigation/editor/panels/dialogs/features/shared`）、`composables/` → `hooks/`、CodeMirror 扩展 `cm-*` 抽出为 `frontend/editor-extensions/`、删除无引用死代码（`wikilinks`/`app-build`）、平台面 `bridge/ipc/tauri.ts` → `bridge/ipc/platform.ts`（中性命名）。纯文本解析器经审计确认与后端 `capabilities/knowledge` 无真重复，留 `frontend/lib`。
