> **服务工作流：** `../03-tdd/03-tdd.md`
> **产物文件名：** `verification.md`

# Verification — 阶段0·节点地基

## 已运行命令

| 命令 | 结果 |
|---|---|
| `pnpm contracts:check` | ✅ 5 files / 10 tests 全绿（node + template conformance + 旧 AI 契约） |
| `pnpm test:core` | ✅ 最终收口 18 files / 47 tests 全绿（含 id / scan / rebuild / templates / nodes / consistency / snapshots / e2e） |
| `pnpm --dir app exec tsc --noEmit` | ✅ exit 0（含 `ulid` 类型） |
| `pnpm lint` | ✅ exit 0（仅既有 `boundaries/element-types` 弃用告警 + FileTree hook warning，非错误；三层【代码】边界、`core/` 禁 UI、bridge allowlist=0 均通过） |
| `pnpm --dir app test:ui` | ✅ 8 files / 80 tests 全绿 |
| `pnpm build` | ✅ exit 0 |
| `cd app/src-tauri && cargo test` | ✅ Rust tests 全绿（1 ignored Ollama smoke；existing dead-code warning only） |

可重建回归（AX-1/AX-4）：`core/__tests__/nodes/rebuild.test.ts` —— 删除 `.eidon/` 后用反序 reader 重扫，节点树/身份/层级/字段/id↔path 与首次 100% 一致，证明重建只依赖磁盘 `.node/`、与枚举顺序无关。

## 未运行命令

- 根目录 `pnpm test:ui` 不存在代理脚本，已改用实际 workspace 命令 `pnpm --dir app test:ui` 并通过。
- 无阶段0 特有的剩余未运行命令；最终收口已补跑 build 与 Rust 测试。

## 调试残留检查

- 已 grep 新增/改动文件：无 `console.log`/`debugger`/`FIXME`/`@ts-ignore`/占位符残留。
- 无一次性脚本、无推测性功能：严格限定阶段0 边界——未实现节点 CRUD/提升（阶段2）、模板写入/种子/设置 UI（阶段1）、一致性违规检测（阶段3）、改名（阶段4）、任何 Rust 命令。
- `WorkspaceReader` 为注入接口（系统边界）；后续阶段已通过 `core/bridge/file.ts` 的 `createWorkspaceFileStore` 接入生产 file_ops 能力。

## 完成结论

阶段0·节点地基 **已完成并验证（verified）**：磁盘契约统一（`NodeSchema`/`TemplateLayerSchema`/`.eidon` 布局，ADR-0014）、ULID 节点身份、`core/nodes` 扫描建树（深度=层级 + id↔path）、删缓存重建回归全部绿。

**后续建议：**
- 阶段1 起，模板/节点写入器应复用 `templateLayerPath` / `createNodeId`，并在写入前过 `*Schema`（契约先行，改形状先改 zod+fixtures）。
- 生产 `WorkspaceReader` 实装时落 `core/bridge`（经 `editor/file_ops`），保持 `core/nodes` 纯函数可 Node 单测；若万级文件遍历性能不足再按 ADR-0009 加最小 `scan` 原子命令。
- `node.json` 的 `type` 取值与内置模板字段集待产品层 ADR / 阶段4(O-3) 定稿，届时只需更新 golden fixture，契约形状已锁。
- 未自动归档；归档与提交由用户决定（本工作流不自动 commit）。
