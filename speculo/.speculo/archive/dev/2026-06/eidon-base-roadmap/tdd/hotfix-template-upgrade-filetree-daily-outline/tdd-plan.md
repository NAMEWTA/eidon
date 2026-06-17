> **服务工作流：** `../03-tdd/03-tdd.md`
> **产物文件名：** `tdd/hotfix-template-upgrade-filetree-daily-outline/tdd-plan.md`

# TDD Plan

## 阶段标识
hotfix-template-upgrade-filetree-daily-outline

## 切片来源
用户直接请求 + `dev/H-diagnose`：模板旧节点升级、保存后 FileTree 闪烁、每日笔记常驻入口、Explorer 标题按钮清理、Markdown 大纲自动右栏展示与 UI 调整。

## 公共接口
- `core/nodes.listNodesUsingTemplate(reader, templateId)`：列出使用某模板的节点。
- `core/nodes.upgradeNodeSchema(store, { path, templateLayer })`：显式把单个节点升级到同模板同层级的新 schemaVersion。
- `useNodesStore.upgradeSchema(...)`：UI store wrapper。
- `TemplateManager`：展示当前模板的已使用节点，并提供“升级属性”动作。
- `Toolbar({ onOpenDaily })` + `DailyPanel` + `RsPaneId='daily'`：每日笔记右侧栏入口。
- FileTree 保存事件：普通文件保存不再触发全树 loading 刷新。

## 行为优先级
1. 节点升级必须显式触发，不自动迁移；同 templateId/level 才能升级。
2. 升级保留兼容字段值，新增字段为 `null`，移除字段被丢弃，类型不兼容的旧值置 `null`。
3. 普通 Markdown 保存不让 FileTree 进入 root loading，也不折叠已展开目录。
4. Daily 按钮常驻顶栏 Search 之前，点击只打开右侧 Daily pane。
5. 打开 Markdown 默认启用 Outline，并保证右侧栏可见；用户关闭后不反复强开同一标签。

## 第一个 Tracing Slice
先写 core 节点升级测试，锁定旧节点字段迁移语义；再接 TemplateManager 和 UI shell。

## 验证命令
- `pnpm --dir app exec vitest run core/__tests__/nodes/schema-upgrade.test.ts core/__tests__/nodes/crud.test.ts core/__tests__/templates/templates.test.ts src/lib/persistence/__tests__/settings.test.ts`
- `pnpm --dir app exec tsc --noEmit --pretty false`
- `pnpm contracts:check`
- `pnpm --dir app test:ui`
- `pnpm test:core`
- `pnpm lint`
- `pnpm build`
- `git diff --check`
