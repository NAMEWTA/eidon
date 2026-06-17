> **服务工作流：** `../03-tdd/03-tdd.md`
> **产物文件名：** `tdd/phase4-finalize/tdd-plan.md`

# TDD Plan — 阶段4·改名收口 + 端到端贯通

## 阶段标识
`phase4-finalize`

## 切片来源
来自 PRD US-15/16 + roadmap 阶段4。对齐 ADR-0017（solomd→EIDON 改名 + `.eidon` 系统区）、ADR-0014（磁盘契约统一）、ADR-0018（AI·Agent·Recipes 不在 EIDON 范围，旧代码作基底保留不挂载）。

## 公共接口
- `app/package.json`、`app/index.html`、`app/src-tauri/tauri.conf.json`、`AboutDialog`、i18n：可见产品身份为 EIDON。
- `core/contracts` / `core/templates`：系统区为 `.eidon/templates/`。
- `core/__tests__/eidon/e2e.test.ts`：模板→节点→L3 内容→删缓存→拷贝 workspace→重建的端到端验收。
- `App.tsx` / `SettingsPanel.tsx`：旧 AI·Agent·Recipes 面板不挂载，设置内模板管理挂载。

## 行为优先级
1. 可见品牌与系统区落到 EIDON / `.eidon`。
2. 内置模板字段集落在 `BUILTIN_TEMPLATE_SEEDS`，作为普通模板文件首次写入。
3. 端到端闭环证明 workspace 可迁移、可删缓存重建。
4. 版本/自动保存/搜索继续复用现有能力，不新增 parallel 功能。
5. 旧 AI·Agent·Recipes 代码保留但不挂载、不作为 EIDON 数据层依赖。

## 第一个 Tracing Slice
切片①：core 端到端验收测试创建模板、创建 L1/L2/L3、写 L3 Markdown、删除 `.eidon` 运行时缓存、复制 workspace 并重扫。

失败信号：任一模板文件、节点 ID、字段、L3 内容或 id↔path 映射在删缓存/复制后丢失。

成功判据：复制后的 workspace 仍能从 `.eidon/templates/` 与 `.node/node.json` 重建同一节点树、字段和内容。

## 验证命令
- `pnpm --dir app exec vitest run core/__tests__/eidon/e2e.test.ts`
- `pnpm contracts:check`
- `pnpm test:core`
- `pnpm --dir app exec tsc --noEmit`
- `pnpm lint`
- `pnpm build`
- `cd app/src-tauri && cargo test`
