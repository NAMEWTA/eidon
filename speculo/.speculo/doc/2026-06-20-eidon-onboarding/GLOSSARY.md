# EIDON 术语表（新人速查）

> 完整消歧表见 `speculo/.speculo/.config/context/CONTEXT.md`。

## 双关词（禁裸用）

| 术语 | 限定写法 | 含义 |
|------|---------|------|
| 分层 | 【代码】分层（四层） | `frontend → bridge → backend(ipc→service→{domain,capability}) + shared` |
| 分层 | 【节点】三层 | L1 / L2 / L3 数据节点层级 |
| workspace | EIDON 受管根 | 含 `.eidon/` 系统区的目录 |
| AutoGit | 版本历史 | 普通编辑的 auto-commit，与 Agent Recipes 分支沙箱无关 |
| Agent | AGENTS.md | 仓库根目录的权威工程指南 |

## 核心术语

| 术语 | 定义 |
|------|------|
| **节点** | 含 `.node/` 子目录的文件夹，有 ULID 身份 |
| **普通文件夹** | 不含 `.node/`，第 4 层起自由使用 |
| **L1 / L2 / L3** | 三层节点级别，深度=物理层级 |
| **模板** | L1+L2+L3 字段集捆绑，版本化不可变，存 `.eidon/templates/` |
| **元字段** | 系统生成的不可增减字段（id/level/templateId/schemaVersion...） |
| **扩展字段** | 模板定义的用户可编辑字段（text/textarea/number/date/select/boolean） |
| **ULID** | 节点唯一标识符，不依赖路径 |
| **契约（contract）** | zod schema + golden fixture，磁盘形状的单一事实源 |
| **注入端口（store）** | domain 层通过接口获取文件 IO 能力，不直接调 capabilities |
| **IPC 通道** | 前端调后端的命名通道，85 条，在 `shared/ipc/channels.ts` 声明 |
| **eidonInvoke** | `bridge/ipc/client.ts` 的前端调用封装，等同于 `window.eidon.invoke(channel, req)` |
| **穷尽校验** | `backend/ipc/register.ts` 启动时确认所有声明的通道都有 handler |
| **结构违规** | 四类：缺 .node/ · L1/L2 有内容文件 · 深度≠level · .node/ 损坏 |
| **可重建铁律** | 删 `.eidon/` 缓存后从 `.node/` + `.eidon/templates/` 100% 重建节点树 |

## 目录速查

| 路径 | 是什么 |
|------|--------|
| `app/frontend/` | React UI 渲染层 |
| `app/bridge/ipc/` | 前后端契约边界（前端侧） |
| `app/backend/shell/` | Electron 主进程壳层 |
| `app/backend/ipc/` | IPC 接入层（handler 注册） |
| `app/backend/services/` | 编排层（组合 domain + capability） |
| `app/backend/domain/` | 业务规则（可单测） |
| `app/backend/capabilities/` | 底层能力（node:* + 库，可单测） |
| `app/shared/models/` | 纯 TS 类型定义 |
| `app/shared/contracts/` | zod 磁盘契约 |
| `app/shared/ipc/` | IPC 通道 + 事件契约 |
| `app/shared/utils/` | 纯函数工具 |
| `app/preload/index.ts` | contextBridge，frontend↔backend 唯一接缝 |
| `speculo/.speculo/.config/adr/` | 工程层 ADR（17 条） |
| `fixtures/contracts/` | golden fixtures（契约测试用） |

## 提交前命令

| 命令 | 作用 |
|------|------|
| `pnpm lint` | ESLint 四层边界检查 |
| `pnpm typecheck` | TypeScript 类型检查 |
| `pnpm test:core` | shared + backend 单元测试 |
| `pnpm contracts:check` | 契约 conformance 测试 |
| `pnpm dev` | 桌面开发（热重载） |
| `pnpm build` | typecheck + 构建 |
