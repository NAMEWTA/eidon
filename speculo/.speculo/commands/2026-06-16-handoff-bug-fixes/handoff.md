# Handoff

## 目标
按 `temp/bug/使用问题.md` 的 14 项使用问题 + 用户复审时追加的 3 项（删除高级设置 / Git 同步迁回 / 版本历史默认开启），共 17 项，逐项定位根因并修复。代码遵循 AGENTS.md 的三层【代码】单向依赖（`src→core→src-tauri`）与复用优先约束。

## 已完成

全部 17 项已完成，详见 `speculo/.speculo/commands/2026-06-16-handoff-bug-fixes/../../plans/temp-bug-plan-memoized-puddle.md`（计划文件）。

### 阶段一：低风险快速修复（7 项）
- **待办当天误判逾期** — `TodoListPanel.tsx` `refTime` 对 `item.due` 按 23:59:59.999 计，而非 00:00。
- **状态栏选区统计间距** — `StatusBar.tsx:46` 嵌套 CJK span 前补空格。
- **模板初始化重复 6 套** — `stores/templates.ts` `init()` 加模块级 `initInFlight: Map<string, Promise<Template[]>>` 在途去重守卫（根因：FileTree 与 TemplateManager 并发调 init 导致 TOCTOU 竞态）。
- **文件树图标右对齐** — `FileTree.tsx` `row-fill` 元素从行尾上移到文件名之后、徽标之前；CSS 去掉 `.ftree__template-mark` 的 `margin-left:auto`。
- **隐藏文件显隐开关** — 新增 `showHiddenFiles` 设置（全链路：接口/默认值/store/SettingsPanel/FileTree/i18n）；`FileTree.loadDir` 过滤 `.` 开头项 + `useEffect` 订阅开关刷新。
- **节点 AGENTS.md 层级内容 + 删 README** — `core/nodes/index.ts` 新增 `buildNodeAgentsDoc`（由 `splitPath` 各段 + `node.level/type` 生成层级结构文本）；删除 README.md 创建分支；保留白名单避免旧文件被标违规。
- **右键新建无反应** — `window.prompt` 在 Tauri WKWebView 失效（返回 null），改为应用内输入对话框（仿 `ftree__move` 样式）；头部「+」改为 `newFileInActiveL3`（`eidon-paths.ts` 新增 `findEnclosingL3Path` + 回退 selection/activeTab）。

### 阶段二：编辑器 / 标签 / 标题（5 项）
- **标题改名同步重命名** — `FilePropertiesPanel.tsx` `save()` 写盘成功后，若 `title` 与当前文件名 stem 不同，`invoke('fs_rename')` 并同步 tab + `dispatchEvent('eidon:saved')`。
- **标签 chip 输入 + 模糊匹配** — 新建 `lib/tags.ts` 抽取 `rankTags` 共享打分；`cm-tag-autocomplete.ts` 复用；新建 `TagInput.tsx` 渲染可删除 chip + 下拉候选。
- **点击标签按索引精确筛选** — `GlobalSearch.doSearch` 识别 `#tag` 查询，直接读 `workspaceIndex.tags.files[]` 构造命中列表（根因：全文搜 `#tag` 匹配不到 frontmatter 的 `tags:[tag]`）。
- **live 模式图片渲染** — `cm-config.ts` `richExtensionsFor` 签名改为 `(getTab:()=>Tab, ...)` 实时读当前 tab，消除 filePath 闭包陈旧；`Editor.tsx` 新增 `tab.filePath` 变化时重配 rich compartment。
- **新建对话框替换 prompt +「+」建 md** — 见阶段一最后一项。

### 阶段三：较大改动（2 项）
- **概览页 + 取消 Untitled + pet 触发** — 新建 `OverviewPanel.tsx`（欢迎区+快速操作+统计，复用 `nodes/tags/entries/todos` stores）；`App.tsx` 内容区三元判断 `basesOpen ? <BasesView/> : (overviewOpen || tabCount===0) ? <OverviewPanel/> : <TileRoot/>`；`EidonPet.handleClick` dispatch `eidon:open-overview`；`stores/tabs.ts` 删除关闭/切换时的 `if(tabs.length===0) newTab()`。
- **历史版本修剪 + ADR‑0023** — 见下阶段四最后一项。

### 阶段四：追加需求（3 项）
- **删除 reveal + customCss** — 全链路清理：`persistence/settings.ts`（字段+默认值+RETIRED_KEYS）、`stores/settings.ts`（声明+实现）、`SettingsPanel.tsx`（UI+pickCustomCss）、`useFiles.ts`（两处分支）、`App.tsx`（import+reconcile 分支）、`useCommands.ts`（2 条命令）、`custom-theme.ts`（文件删除）、i18n（14 行死键）、`preview.css`/`useFiles.test.ts` 同步。
- **Git 同步迁回设置‑同步 + 泛化** — `SettingsPanel.tsx` 在 `data-cat="sync"` 区挂载既有的 `<GithubSyncSettings />`（之前完全未引用但组件/Rust 后端完整）；i18n 标题和 intro 泛化为「Git 远程同步（按 workspace）」+ 多提供商文案。
- **历史版本修剪（完整）+ ADR‑0023** — 新 Rust 模块 `git/git_prune.rs`（`git_repo_size` + `git_prune_history`，含单元测试）；`lib.rs`/`runner.rs` 双注册；`core/bridge/git.ts` + `core/snapshots/index.ts` + `stores/gitHistory.ts` 扩展；前端设置项 `historyMaxVersionsPerFile` / `historyMaxCommits` / `historyMaxGitSizeMb`（`stores/settings.ts` clamp + 默认值 50/0/0）；`lib/history-prune.ts` 去抖调度 + 带界迭代；`useAutoCommit` 每次提交后触发修剪；`HistorySettings.tsx` 在设置‑同步区嵌入数字输入 + .git 体积显示 + 手动按钮；ADR‑0023 登记。

## 未完成

- **问题 5 体积上限**：Rust `git_prune_history` 仅按提交数修剪；体积上限由前端迭代调用逼近（逐步减半保留数 + 检查 gc 是否生效），但若 `git gc` CLI 未安装则磁盘无法真正回收——已在 UI 标注。
- **行内图片 live 渲染**：`cm-live-blocks` 只渲染整行图片（`IMAGE_LINE_RE`）；`cm-image-paste` 在光标处插入可能带出悬挂的行内图片——已用实时 getter 消除文件路径陈旧，行内图片支持未做，留后续。
- **运行期验证**：`pnpm dev` 启动 Tauri 桌面应用做端到端手动回归——因无 GUI 环境未执行。建议接手后执行：① 新建工作区创建 L1→L3 节点，确认 AGENTS.md 含层级结构、无 README.md；② 标签 chip 输入，空格成 chip、有模糊候选；③ 点击标签看到文件列表；④ live 模式下整行图片是否渲染；⑤ 无打开文件时显示概览页、点宠物打开。`pnpm test:core` 与 `cargo test` 已跑通。

## 验证

| 验证项 | 状态 |
|--------|------|
| `tsc --noEmit` | 0 error ✓ |
| `pnpm test:core` | 15 files / 64 tests ✓ |
| `pnpm exec vitest run src` | 14 files / 114 tests ✓ |
| `pnpm lint` | 仅 deprecation warnings ✓ |
| `cargo test` | 50 tests（含 git_prune ×1）✓ |
| `pnpm contracts:check` | 未绕开（问题 10 不改 node.json 契约）|
| `pnpm dev`（GUI 端到端） | 未执行，需人工验证 |

## 推荐技能

- `code-review` — 对本次 diff 做安全/正确性审查
- `run` — 启动 Tauri 应用手动回归
- `verify` — 确认每项改动在运行期实际生效

## 摘要
1. 修复 17 项使用问题与功能需求，覆盖文件树/编辑器/标签/待办/模板/历史版本/概览页/Git 同步全栈。
2. 新增 Rust `git_prune` 模块 + ADR‑0023，为版本历史上限加入破坏性修剪能力。
3. 新增 3 个前端组件：`OverviewPanel`、`TagInput`、`HistorySettings`；1 个共享库 `lib/tags.ts`；1 个编排模块 `lib/history-prune.ts`。
4. 删除 `revealInFileTreeOnOpen` 与 `customCssPath` 两设置全链路；Git 同步面板首次实际挂载进设置‑同步，文案泛化为通用 Git。
5. TypeScript + Rust 全套测试绿色（178 TS + 50 Rust + 0 lint error）。
