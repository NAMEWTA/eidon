# Handoff

## 目标

**已完成：** `app/` 目录从混态三层重构为严格单向四层 `frontend → bridge → backend + shared`（ADR-0025）。

下一个会话的重点：
1. **合并分支**：`refactor/tauri2electron` → `main`（两个 commit 均已就绪）。

---

## 已完成

### ADR-0025 重构（5 阶段全绿）

| 阶段 | 内容 | 状态 |
|------|------|------|
| Phase 1 | `shared/models` + `shared/utils` + channels.ts（64→85 条通道） | ✅ |
| Phase 2 | `backend/{shell,ipc,services,domain,capabilities}` 迁移 + handlers | ✅ |
| Phase 3 | `bridge/ipc` 重写 + invoke() shim 删除 + 渲染侧调用点迁移（~56 处） | ✅ |
| Phase 4 | `src/` → `frontend/`、ESLint 四层边界、tsconfig/vite 别名 | ✅ |
| Phase 5 | ADR-0025 + AGENTS.md + CLAUDE.md + 过时 ADR 清理 + squash | ✅ |

**Commits（待合并主干）：**
- `d53592f` — refactor: Tauri 2/Rust → Electron 全 TypeScript 迁移 + frontend→bridge→backend+shared 单向四层重构
- `5c7d9f1` — fix: 将 stampGoalSetAtIfMissing 移至写盘前（syncBumpUpdated），保证 savedContent ≡ 盘上字节

**验证结果（全绿）：**
- `pnpm lint` → 0 违规
- `pnpm typecheck`（renderer + node）→ 0 error
- `pnpm test`（vitest）→ 187 passed / 30 files
- `pnpm contracts:check` → 3 files / 12 tests passed
- `electron-vite build` → main/preload/renderer 三进程全绿

### 关键架构变更

- **删除**：`src/`（→ `frontend/`）、`main/`（→ `backend/`）、`shared/domain/`（→ `backend/domain/`）、`shared/domain-types/`（→ `shared/utils/`）、`shared/ipc/types.ts`（wire 类型 → `shared/models/`）
- **新增**：`bridge/`、`backend/services/`、`shared/models/`、`shared/utils/`
- **wire 类型全 camelCase**（D7）：`hadBom/isDir/headSha/shortSha/...` 等 ~20+ 字段
- **IPC 通道**：64 → 85（+21 条 nodes/templates/todos/consistency 域）
- **ESLint 边界**：`eslint-plugin-boundaries` 四层单向强制，`@tauri-apps/*` 永久禁
- **ADR 清理**：0001/0009 删除（纯 Rust 前提），0006/0007 标 superseded，ADR-0025 新建

### 重要文件路径

- 架构权威：`speculo/.speculo/.config/adr/0025-app-directory-frontend-bridge-backend.md`
- IPC 通道单一事实源：`app/shared/ipc/channels.ts`
- 边界规则：`app/eslint.config.mjs`
- 后端入口：`app/backend/shell/index.ts`
- 桥接客户端：`app/bridge/ipc/client.ts`（仅 `eidonInvoke`，无旧 shim）

---

## 未完成

### 合并后可选细化（ADR-0025 §后续，非阻塞）

- 组件内部按角色细分组（`layout/navigation/editor/panels/dialogs/features/shared`）
- `composables/` → `hooks/` 改名
- `editor-extensions/` 从 `frontend/lib` 抽出独立顶层
- `frontend/lib` 纯文本解析器与 `backend/capabilities/knowledge` 去重收敛到 `shared/utils`

---

## 验证

已在本会话结束前完成全量验证：

```
pnpm lint        → exit 0（0 boundaries violations）
pnpm typecheck   → renderer 0 error / node 0 error
pnpm test        → 187 passed (187) across 30 test files
pnpm contracts:check → 3 files / 12 tests passed
electron-vite build → out/main/index.js + out/preload/index.cjs + out/renderer/index.html ✅
```

未运行：`pnpm dev` 手动冒烟（开 workspace → 新建节点 → 日历 → 待办 → 历史/diff → 搜索 → 导出）；建议合并前在本地完成一次冒烟。

---

## 推荐技能

下一个 agent 处理「合并 + 后续可选细化」时推荐读取：

- `speculo/skills/handoff/SKILL.md` — 如需再次生成交接
- `speculo/.speculo/.config/adr/0025-app-directory-frontend-bridge-backend.md` — 四层架构权威（D1–D8 决策依据）
- `speculo/.speculo/.config/adr/README.md` — ADR 登记表（取代链 + 当前架构权威参考）
- `AGENTS.md §2` — 目录结构 + 单向链规则（已更新至四层现状）

---

## 摘要

1. **ADR-0025 重构已 100% 完成**：`app/` 从混态三层重构为 `frontend → bridge → backend + shared` 四层，5 个阶段全绿后 squash 为单提交 `d53592f`，分支 `refactor/tauri2electron` 就绪。
2. **所有验证工具全绿**：lint/typecheck/187 tests/contracts:check/electron-vite build 均通过。
3. **bug fix 已 commit**：`stampGoalSetAtIfMissing` 移至写盘前（`5c7d9f1`），保证 savedContent ≡ 盘上字节，附回归测试。
4. **治理文档同步完成**：ADR-0025 新建，AGENTS.md/CLAUDE.md 更新，过时 ADR 0001/0009 删除、0006/0007 标 superseded。
5. **可选后续（非阻塞）**：组件细分组/composables→hooks/editor-extensions 抽出/lib 去重，均已在 ADR-0025 §后续中记录。
