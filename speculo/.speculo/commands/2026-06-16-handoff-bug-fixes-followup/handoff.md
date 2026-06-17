# Handoff

## 目标
修复 handoff（`speculo/.speculo/commands/2026-06-16-handoff-bug-fixes/handoff.md`）完成后用户在实际使用中遇到的 3 个后续问题。

## 已完成

全部 3 项已完成，详见计划文件 `speculo/.speculo/commands/2026-06-16-handoff-bug-fixes-followup/../../plans/speculo-speculo-commands-2026-06-16-han-pure-taco.md`。

### 问题 1：HTML5 backend 重复崩溃
- **根因**：react-arborist `<Tree>` 内 `TreeProvider` 无条件创建 `DndProvider(HTML5Backend)`，`disableDrag`/`disableDrop` 不阻止。快速卸载重挂时旧后端异步清理与新后端创建竞态。
- **修复**：`FileTree.tsx` 新增模块级单例 `noopDndBackend` 桩后端 → 传入 `<Tree dndBackend={noopDndBackend}>`；`scheduleRefresh` / `refreshRoot` 默认 `showLoading: false`，仅首次加载显式传 `true`。loading guard 保留为防御层。

### 问题 2：新 workspace 快照失败
- **根因**：`useAutoCommit.ensureInitialized` 以 `gh.status` 判空跳过 `refreshStatus`，workspace 切换后使用旧 workspace 缓存状态误判已初始化 → `commit` 调用 `open_repo` 对新路径失败。
- **修复**：`useAutoCommit.ts` `ensureInitialized` 判空条件增加 `gh.folder !== folder`，切工作区时强制重查状态。

### 问题 3：概览页布局只占一半宽度
- **根因**：`.overview` CSS 缺少 `flex: 1`，父容器 `.content` 为 `flex row`，子元素按内容宽度自适应（~720px）。
- **修复**：`components.css` `.overview` 增加 `flex: 1`。

## 未完成

- **问题 1 走查**：用户反馈「新建文件之后」经确认无具体问题，无需处理。
- **问题 2 衍生**：`git_init_workspace_inner` 中 `create_dir_all` 失败时错误消息为 `"create workspace folder: ..."` 而非 `"git open failed: ..."`——这是不同错误路径，本回合未处理（需 Rust 层改动）。
- **运行期验证**：`pnpm dev` 启动 Tauri 桌面应用做端到端手动回归——因无 GUI 环境未执行。建议接手后执行：① 切换 workspace 确认快照不报错；② 反复新建文件 / 切换 workspace 确认无 HTML5 backend 崩溃；③ 宽屏下点击 pet 确认概览页填满全宽。

## 验证

| 验证项 | 状态 |
|--------|------|
| `tsc --noEmit` | 0 error ✓ |
| `pnpm test:core` | 15 files / 64 tests ✓ |
| `npx vitest run src` | 14 files / 114 tests ✓ |
| `pnpm lint` | 仅 deprecation warnings（非新增）✓ |
| `cargo test` | 所有测试通过 ✓ |
| `pnpm dev`（GUI 端到端） | 未执行，需人工验证 |

## 推荐技能

- `run` — 启动 Tauri 应用手动回归三项修复
- `code-review` — 对本回合 diff 做安全/正确性审查
- `verify` — 确认每项改动在运行期实际生效

## 摘要
1. 修复 react-arborist 多次创建 HTML5Backend 竞态崩溃：模块级 noopDndBackend 桩后端 + refresh 默认不卸载 Tree。
2. 修复 workspace 切换时快照误判已初始化：`ensureInitialized` 增加 folder 一致性检查（1 行改动）。
3. 修复概览页宽屏下只占一半宽度：`.overview` CSS 增加 `flex: 1`（1 行改动）。
4. 3 项改动均在 `src/` 层，不涉及 `core/` 或 `src-tauri/`，遵循三层单向依赖。
5. 全量测试绿色（178 TS + Rust 全部通过），无 TypeScript / lint 错误。
