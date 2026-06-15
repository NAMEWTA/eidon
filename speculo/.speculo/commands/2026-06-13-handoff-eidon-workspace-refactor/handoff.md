# Handoff

## 目标

EIDON 工作台交互重构：将 SoloMD 遗留的顶栏 30+ 按钮 + 右侧栏七面板垂直堆叠形态，重构为 IDE 风格的 **ActivityBar（左右双栏）+ 单面板抽屉** 布局。同步升级每日笔记为日历整理箱（落 `_日历/YYYY/YYYY-MM/YYYY-MM-DD.md`），替换品牌图标为黏土橙几何标，统一全部下拉浮层配色。

## 已完成

### 新布局骨架
- **`app/src/components/ActivityBar.tsx`**（新建）—— 左栏 explorer/search/calendar + 底栏 settings；右栏 outline/node/backlinks/tags/history；激活态黏土色 `::before` 2px 指示条。
- **`app/src/App.tsx`**（重写布局段）—— 旧 `side-sidebar` 堆叠 + `RsSplitter` 拖拽重排 + `sidebarCtx` 右键菜单全部删除；新布局 = `ActivityBar(左) + leftdrawer + content + rightdrawer + ActivityBar(右)`。抽屉互斥单开、`drawerSlide 0.16s` 滑入动画、`rd-header` 统一头部 + 关闭钮。
- 右抽屉面板（BacklinksPanel / TagsPanel / HistoryPanel / NodePropertiesPanel）的 `onClose` 改为可选，内部 `rs-pane-close` 按钮条件渲染。

### 日历 + 三层整理箱
- **数据层**（`core/nodes/index.ts`、`core/templates/index.ts`、`stores/nodes.ts`、`composables/useDailyNotes.ts`）—— 在前期已就绪：`CALENDAR_ROOT`、`calendarNotePath`、`ensureCalendarStructure`、`CALENDAR_TEMPLATE_SEED`、`ensureCalendarMonth`、`resolveDailyPath`→固定路径。
- **`app/src/components/CalendarPanel.tsx`**（新建）—— react-day-picker v10 + date-fns；上半日历（选中日高亮、今日加粗、有笔记日打点）；下半待办区（`- [ ]` checkbox 交互，勾选→回写磁盘 + 同步已打开 tab）。
- **`app/src/lib/daily-todos.ts`**（前期已就绪）—— `parseTodos` / `toggleTodo` 纯函数。
- **`app/src/components/SettingsPanel.tsx`**—— 删除 `dailyNotesFolder`/`dailyNotesFormat` 输入；替换为只读路径说明 `_日历/年/月/日.md`；删除 `showOutline`/`showFileTree`/`showBacklinks`/`showTagsPanel`/`outlineSide` 等退役设置控件。

### 设置层迁移
- **`app/src/lib/persistence/settings.ts`**—— 前期已就绪：`leftPanelView`/`rightPanelView` 字段 + `RETIRED_KEYS` 退役数组 + `loadSettings` 一次性迁移（`showFileTree:false → leftPanelView:null`）。
- **`app/src/stores/settings.ts`**—— 前期已就绪：退役 actions 全部移除。
- **`app/src/lib/reducers.ts`**—— 前期已就绪：旧 rsPane/toggleRightSidebar 纯函数已删。

### 组件精简
- **`app/src/components/Toolbar.tsx`**—— 删除 6 个按钮（打开文件/打开文件夹/侧栏开关组/每日笔记/搜索/设置）及对应 props。
- **删除文件**—— `app/src/components/RsSplitter.tsx`、`app/src/components/DailyPanel.tsx`。

### 快捷键/命令重映射
- **`app/src/composables/useCommands.ts`**—— 删除 `toggleRightSidebar`/`toggleBacklinks`/`toggleTagsPanel`/`toggleHistoryPanel`/`resetSidebarPanes` 五条命令；`toggleOutline`→全局右抽屉；`toggleFileTree`→左抽屉 explorer。
- **`app/src/lib/shortcuts.ts`**—— Ctrl+B → `toggleExplorer`；Ctrl+Alt+B 整体删除。
- **`app/src/composables/useShortcuts.ts`**—— `toggleExplorer` → `s.toggleLeftPanelView('explorer')`。

### CSS
- **`app/src/styles/main.css`**—— 新增 `--menu-bg`/`--menu-border`/`--menu-shadow` 等统一浮层 token。
- **`app/src/styles/components.css`**—— 新增 ActivityBar（`.activitybar`/`.ab-btn`/`.ab-divider`/`.ab-spacer`）、抽屉（`.leftdrawer`/`.rightdrawer`/`.rd-header`/`drawerSlide`）、CalendarPanel（`.calendar-panel__*`/react-day-picker 映射）、统一浮层（`.dropdown__menu`→`var(--menu-*)`、dropdown item hover/active 规范）。
- **`app/src/styles/tailwind.css`**—— `--color-popover` → `var(--menu-bg)`。
- 删除 `.toolbar__brand-logo` 的 `image-rendering: pixelated`。

### i18n
- **zh.ts / en.ts**—— 新增 `activitybar.*`（9 键）、`calendar.*`（3 键）、`settings.dailyNotesPath`；替换 `dailyNotesFolder`+`dailyNotesFormat`→`dailyNotesPath`。

### 品牌图标
- **`app/public/eidon-logo.svg`**—— 替换为三层几何标（圆角矩形横条、黏土橙系、透明底）。
- **`scripts/generate-brand-icon.mjs`**—— 注释更新。

## 未完成

| 项目 | 优先级 | 说明 |
|------|--------|------|
| **Brand 图标完整套装** | 中 | `node scripts/generate-brand-icon.mjs` 生成 PNG(16-1024) + GIF 动画；`pnpm --dir app exec tauri icon temp/eidon-icon-1024.png` 重生成 `app/src-tauri/icons/` 全平台图标。当前脚本的 PNG 光栅化仍为旧像素塔逻辑，需改为几何 SDF 渲染。 |
| **CSS 退役块清理** | 低 | `components.css` 中 `.side-sidebar*` / `.sidebar-ctx*` / `.rs-pane-*` 块仍存在（无运行时影响，约 120 行）。 |
| **i18n 退役键清理** | 低 | `rsPane` / `rightSidebar` / 旧 settings 显示键（如 `showFileTree`/`showBacklinks` 等）仍存在（TypeScript 类型安全，无运行时影响）。 |
| **Tauri 桌面端实测** | 高 | `pnpm dev` 日历闭环：首开 workspace→点日历→自动建 `_日历/2026/2026-06`→创建日记→写入 `- [ ]`→面板勾选→落盘+tab 同步+打点。web 端可测 UI，但文件操作需 Tauri 后端。 |
| **单测补充** | 中 | `core/__tests__/nodes/calendar.test.ts`（`ensureCalendarStructure` 幂等/裸目录提升/层级冲突）已建文件待填；`app/src/lib/__tests__/daily-todos.test.ts` 已建文件待填。 |

## 验证

| 检查项 | 结果 |
|--------|------|
| `tsc --noEmit` | ✅ 0 错误 |
| `pnpm lint` | ✅ 0 错误（仅 2 个预存 deprecation 警告） |
| `pnpm test:core` | ✅ 13 文件 / 48 测试 |
| `pnpm contracts:check` | ✅ 2 文件 / 8 测试 |
| `pnpm build` | ✅ Vite 构建成功（~6.5s） |

## 推荐技能

下一个 agent 接手时建议优先读取或调用：

- **`verify`** — 启动 `pnpm dev` 或 `pnpm dev:web` 浏览器实测日历闭环、抽屉切换动画、浮层配色
- **`code-review`** — 审查新组件（ActivityBar / CalendarPanel）和 App.tsx 布局重写的正确性
- **`run`** — Tauri 桌面端启动并手验全流程

## 摘要

1. **IDE 双抽屉布局上线**：ActivityBar 左右双栏 + leftdrawer/rightdrawer 单面板切换，替代旧 7 面板垂直堆叠 + RsSplitter 拖拽重排。
2. **日历整理箱闭环**：`_日历/YYYY/YYYY-MM/YYYY-MM-DD.md` 固定路径 + react-day-picker v10 日历 + 待办 checkbox 交互（创建/勾选/回写磁盘/同步 tab）。
3. **全部 TypeScript/测试/构建通过**：0 tsc 错误、48 core 测试、8 契约测试、Vite 构建 6.5s。
4. **品牌图标已替换 SVG**，PNG 多尺寸 + GIF + Tauri 平台图标待脚本重跑生成。
5. **退役代码已物理删除**（RsSplitter / DailyPanel / 旧 sidebar 系统），CSS 和 i18n 死代码保留待后续低风险清理。
