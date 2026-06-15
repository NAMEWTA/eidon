# EIDON 全栈深度研究 · 优化提示词

> 将此提示词粘贴给 AI 助手（Claude Code / Codex / Kiro 等），逐模块执行深度研究。
> 建议按 Phase 顺序执行，每个 Phase 完成后再进入下一个。
> 每个 Phase 产物为 `.speculo/doc/2026-06-12-eidon-deep-research/lessons/<编号>.html`。

---

## Phase 0 — 全局架构理解（地基）

**目标：** 建立对三层【代码】架构、目录结构、单向依赖规则、核心术语的完整心智模型。

**执行指令：**

1. 通读 `AGENTS.md` 全文（这是权威指南），理解：
   - 三层【代码】vs 三层【节点】的双关消歧（§0）
   - 单向依赖 `src→core→src-tauri` 的铁律（§2.1）
   - `core/bridge/` 是访问 Rust 的唯一出口（allowlist=0）
   - 四个数据层模块的职责边界（§3）
   - 已删除的 AI·Agent·Recipes 清单（§6）
2. 通读 `speculo/.speculo/.config/context/CONTEXT.md`，掌握全部术语定义（模板/节点/L1-L3/元字段/扩展字段/提升为节点/结构违规等）
3. 阅读 `app/core/index.ts`，列出所有公开 API
4. 阅读 `app/src-tauri/src/lib.rs`，列出所有注册的 Tauri 命令及其所属模块

**产物要求：**
- 画出一张三层架构图（标注每层模块、数据流向、约束边界）
- 输出一份术语速查表（≥20 条，每条一句话）

---

## Phase 1 — 前端 Markdown 渲染全链路（从磁盘字节到屏幕像素）

**目标：** 追踪一条 Markdown 文件从 Rust 磁盘读取到 React DOM 渲染的完整数据流。

**执行指令：**

### 1.1 Rust 侧：文件读取与编码检测
- 阅读 `app/src-tauri/src/editor/file_ops.rs` 全文，重点：
  - `read_file` 命令：`spawn_blocking` 异步包装 → `read_file_inner`
  - 编码检测链：BOM sniff → chardetng → encoding_rs 解码 → lossy UTF-8 fallback
  - `detect_language()` 函数：如何从扩展名判断语言类型
  - `FileReadResult` 结构体：content/encoding/language/had_bom 四个字段的含义
- 回答：如果一个 GBK 编码的 `.md` 文件包含非法字节，会发生什么？

### 1.2 Bridge 层：TS 侧的 Tauri 调用封装
- 阅读 `app/core/bridge/file.ts` 全文，重点：
  - `invoke<FileReadResult>("read_file", {path})` 的 TS 类型封装
  - `createWorkspaceFileStore(workspace)` 如何将绝对路径抽象为 workspace-relative 操作
  - `normalizeRelPath` / `joinWorkspacePath` / `relativeWorkspacePath` 路径工具函数
- 回答：为什么 `core/bridge/` 是唯一允许 `invoke()` 的地方？ESLint 如何强制执行？

### 1.3 前端侧：内容加载到编辑器
- 阅读 `app/src/composables/useFiles.ts`，追踪 `openPath()` 的完整逻辑：
  - 如何调用 bridge 读取文件内容
  - 如何创建 tab、设置 content/savedContent
  - dirty 状态管理：`isDirty()` 判断逻辑
- 阅读 `app/src/stores/tabs.ts`，理解 Zustand store 的 slice 设计：
  - Tab 数据结构（id/filePath/fileName/content/savedContent/language...）
  - `persist()` 方法如何做 localStorage 手工保真持久化

### 1.4 Markdown 解析管道（markdown-it 插件链）
- 阅读 `app/src/lib/markdown.ts` 全文，重点：
  - markdown-it 初始化配置（html/linkify/typographer/breaks）
  - 插件链顺序与各自职责：
    1. `markdown-it-front-matter` — YAML front matter 剥离
    2. `markdown-it-anchor` — 标题锚点生成
    3. `@vscode/markdown-it-katex` — 行内/块级 LaTeX 公式
    4. `markdown-it-footnote` — 脚注 `[^1]`
    5. `markdown-it-mark` — `<mark>` 高亮
    6. 内联 task-lists 规则（替代不可用的 `@hedgedoc/markdown-it-task-lists`）
  - highlight.js 集成：`hljs.highlight(code, {language})` + `hljs.highlightAuto(code)` 回退
  - Mermaid 块特殊处理：保留 `language-mermaid` class，后处理在 Preview 中
  - front matter 捕获：`lastFrontMatterRaw` 模块级变量（为什么可以这样做？线程安全？）
- 回答：如果一个代码块标注了 `mermaid`，markdown-it 输出的 HTML 是什么样子的？后续谁处理它？

### 1.5 React 渲染面（Preview.tsx）
- 阅读 `app/src/components/Preview.tsx` 全文，重点：
  - 如何获取 markdown-it 渲染后的 HTML
  - `processMermaid()` — Mermaid 图表的后渲染流程（如何找到 `<code class="language-mermaid">` 并用 mermaid.run() 替换）
  - KaTeX CSS 如何加载
  - 代码块如何与 highlight.js 主题 CSS 配合
  - wiki 链接 `[[...]]` 的点击处理（如何派发 `solomd:wiki-open` 事件）
  - `dangerouslySetInnerHTML` — 安全考量（CSP 策略是什么？为什么允许？）
- 阅读 `app/src/styles/preview.css`，理解渲染面的 CSS 布局策略
- 阅读 `app/src/styles/hljs-theme.css`，理解代码高亮主题系统

**产物要求：**
- 画一张「Markdown 渲染全链路」流程图，从 Rust `fs::read()` 到 React DOM commit，标注每一步的数据变换
- 回答上述所有「回答」问题

---

## Phase 2 — Rust 系统资源管理深度研究

**目标：** 理解 Rust 侧每个模块的职责、命令协议、系统资源管理策略。

**执行指令：**

### 2.1 文件系统操作（editor/file_ops.rs）
- 完整阅读该文件，列出所有 `#[tauri::command]` 及其签名
- `spawn_blocking` 模式：为什么文件 I/O 必须脱离 IPC 线程？（见 `feedback_tauri_sync_command_audit.md`）
- 编码处理全流程：BOM sniff → chardetng → encoding_rs → lossy fallback
- `write_file` 如何保持原编码回写？
- `list_dir` 的隐藏文件过滤逻辑
- `fs_delete` / `fs_rename` / `copy_file` 的错误处理策略

### 2.2 文件监听（editor/watcher.rs）
- 使用什么 crate 做文件系统监听？（notify）
- `WatcherState` 如何管理多个监听句柄？
- 防抖/去重策略：文件变更事件如何避免重复触发？
- 事件如何从 Rust 传递到 TS 侧？（Tauri event emit）

### 2.3 工作区索引（knowledge/workspace_index.rs）
- 索引数据结构：如何存储文件列表/反向链接/标签？
- 增量索引 vs 全量重建策略
- `resolve()` 命令：如何从 wiki 链接 `[[...]]` 找到对应文件路径？
- `rescan()` 的触发时机与性能考量

### 2.4 全文搜索（knowledge/search.rs）
- 搜索算法：简单字符串匹配还是索引加速？
- `search_in_dir` 命令的递归策略
- 大文件/二进制文件的跳过逻辑

### 2.5 Git 版本管理（git/git_history.rs + git/git_ops.rs）
- auto-commit 机制：何时自动提交？commit message 格式？
- `git_file_history` → `git_file_diff` → `git_file_at_version` → `git_rollback_file` 的完整时光机链路
- Android 条件编译：为什么 git 模块在 Android 上禁用？（libgit2 交叉编译问题）

### 2.6 GitHub 同步 + 加密（git/github_sync.rs + git/crypto.rs）
- PAT token 存储：OS keychain（keyring crate）
- E2EE 加密链路：passphrase → Argon2id → key → XChaCha20-Poly1305 → 加密每个 .md
- push/pull 流程与冲突解决策略

### 2.7 拼写检查 + CJK 校对（knowledge/spellcheck.rs + knowledge/cjk_proofread.rs）
- spellcheck 后端是什么？（nlprule / hunspell）
- CJK 校对的正则/规则匹配策略：如何标记常见中文错别字？

**产物要求：**
- 画一张「Rust 命令全景图」，列出所有 Tauri command、所属模块、参数签名
- 标注每个命令的线程模型（spawn_blocking / 同步 / 异步）

---

## Phase 3 — EIDON 数据层四模块深度研究（本期新建核心）

**目标：** 完全理解 nodes/templates/snapshots/consistency 四个模块的内部实现。

**执行指令：**

### 3.1 节点系统（core/nodes/）
- 阅读 `core/nodes/index.ts` 及所有内部文件，重点：
  - `scanWorkspace(reader, rootPath)` — 如何从物理目录树构建 `NodeTree`？
    - 深度=层级铁律如何实现？（第 1/2/3 层目录 → L1/L2/L3，第 4 层起自由）
    - ULID 身份如何生成与持久化到 `.node/node.json`？
    - `id→path` 映射如何构建？
  - `createNode(input)` — 创建节点的完整流程（模板选择/层级校验/文件白名单）
  - `promoteFolderToNode(input)` — 「提升为节点」的实现：
    - 如何从物理深度推断层级？
    - 如何继承父链？
  - `moveNode` / `renameNode` / `updateNodeFields` / `upgradeNodeSchema`
  - `.node/node.json` 的读写：如何与 `bridge/file.ts` 的 `WorkspaceFileStore` 接口协作？
- 回答：「可重建铁律」如果删掉 `.eidon/` 缓存，扫描重建会丢什么？不会丢什么？

### 3.2 模板系统（core/templates/）
- 阅读 `core/templates/index.ts` 及所有内部文件，重点：
  - 模板 schema 的 JSON 结构（元字段 vs 扩展字段）
  - 6 种字段类型（text/textarea/number/date/select/boolean）如何定义与校验？
  - 版本化策略：`createTemplate` → `editTemplate`（生成新版本，旧版不改）
  - 懒迁移：旧节点保持旧 `schemaVersion`，仅 `upgradeNodeSchema` 时升级
  - `initWorkspaceTemplates(store, workspace)` — 内置种子模板的初始化逻辑
  - `deleteTemplate` — 孤儿模板态处理

### 3.3 版本/快照（core/snapshots/）
- 阅读 `core/snapshots/index.ts`，理解：
  - 如何薄封装现有 git bridge（不是另造快照系统！）
  - `commitSnapshot` / `listFileSnapshots` / `diffFileSnapshot` / `restoreFileSnapshot` 的调用链
  - 与 `git/git_history.rs` 的对应关系

### 3.4 结构一致性（core/consistency/）
- 阅读 `core/consistency/index.ts`，理解：
  - `detectStructureViolations(reader, rootPath)` 的四种检测算法：
    ① 前三层普通文件夹 → `folder-without-node`
    ② L1/L2 出现内容文件 → `content-in-org-layer`
    ③ 节点深度与 level 不符 → `level-mismatch`
    ④ `.node/` 缺失/损坏 → `node-missing`
  - 输出 `ConsistencyReport` 的结构
  - 为什么「只读、不阻塞、不自动改」？（设计哲学）

### 3.5 契约层（core/contracts/）
- 阅读 `core/contracts/index.ts`，理解：
  - node.json 的 zod schema 定义
  - template schema 的 zod 定义
  - `.eidon/` 系统区布局的 zod 定义
  - golden fixtures 的作用：为什么改形状必须先改 zod + fixtures？

**产物要求：**
- 画一张「数据层四模块协作图」，标注模块间的调用关系和数据流向
- 回答上述所有「回答」问题

---

## Phase 4 — 前端状态管理与数据流

**目标：** 理解 Zustand store 体系、持久化策略、跨组件数据流。

**执行指令：**

### 4.1 Store 全景
- 列出 `app/src/stores/` 下所有 store 文件及其职责
- 阅读每个 store，理解：
  - State 形状
  - 核心 actions
  - `persist()` 方法：哪些数据持久化到 localStorage？key 命名规则？
  - 跨 store 依赖：哪个 store 读别的 store？（注意反模式——见 memory `[[cross-store-localstorage-techdebt]]`）

### 4.2 关键数据流追踪
- **Tab 生命周期**：`newTab()` → `activate()` → 编辑 → `autoSaveDirtyTabs()` → `closeTab()` → `persist()`
- **文件树刷新**：watcher 事件 → `useFileWatcher` → store 更新 → `FileTree` 重渲染
- **节点扫描**：`useNodesStore.scan()` → `core/nodes.scanWorkspace()` → bridge.file.listDir → Rust list_dir
- **设置持久化**：`useSettingsStore` 的 subscribe → persist 模式
- **窗格布局**：`useTilesStore` 的 tile tree 结构与 `TileRoot` 的递归渲染

### 4.3 Composables 层
- 阅读 `app/src/composables/` 下所有 hooks，理解各自职责：
  - `useFiles` — 文件打开/保存/关闭/自动保存
  - `useCommands` — 命令调色板中的命令注册与执行
  - `useShortcuts` — 全局快捷键绑定
  - `useFileWatcher` — 外部文件变更处理
  - `useAutoCommit` — Git 自动提交调度
  - `useSessionRestore` — 跨设备 session 恢复
  - `useBasesView` — Bases 视图（多 workspace 管理）

**产物要求：**
- 画一张「Zustand Store 依赖图」，标注数据流向和持久化策略
- 写出至少 3 条完整的用户操作→状态变更→持久化→Rust 调用的链路

---

## Phase 5 — 综合：端到端核心链路追踪

**目标：** 将前面所有知识点串联，写出 6 条完整的端到端链路。

**执行指令：**

对于以下每条用户操作，从前端事件处理开始，逐层追踪到 Rust 系统调用或 DOM 渲染，写出每一步的文件路径、函数名、数据变换：

### 链路 1：打开一个 Markdown 文件
```
用户双击 FileTree 中的 .md 文件
  → ??? (FileTree.tsx)
    → ??? (useFiles / bridge)
      → ??? (Rust file_ops)
        → ??? (编码检测)
          → ??? (内容返回到 Editor/Preview)
```

### 链路 2：编辑并自动保存
```
用户在 CodeMirror 中输入文字 → onBlur 触发
  → ??? (autoSaveDirtyTabs)
    → ??? (bridge/file.ts write_file)
      → ??? (Rust file_ops::write_file)
        → ??? (编码处理 + fs::write)
```

### 链路 3：外部程序修改文件后刷新
```
外部编辑器修改 .md → Rust watcher 检测
  → ??? (Tauri event)
    → ??? (useFileWatcher)
      → ??? (FileChangedDialog / 自动重载)
```

### 链路 4：Markdown 预览渲染
```
Editor content → ??? (markdown-it 插件链)
  → ??? (HTML string)
    → ??? (Preview.tsx dangerouslySetInnerHTML)
      → ??? (Mermaid 后处理)
        → ??? (KaTeX 渲染)
          → ??? (代码高亮 CSS 应用)
```

### 链路 5：全文搜索
```
用户在 GlobalSearch 输入关键词
  → ??? (invoke "search_in_dir")
    → ??? (Rust search.rs 搜索算法)
      → ??? (结果返回到 SearchResults 组件)
```

### 链路 6：Git 时光机回退
```
用户在 HistoryPanel 选择历史版本 → 点击恢复
  → ??? (invoke "git_rollback_file")
    → ??? (Rust git_history.rs)
      → ??? (git2 checkout)
        → ??? (文件重载到 Editor)
```

**产物要求：**
- 每条链路用「文件:行号」引用源码，精确到函数名
- 标注每一步的数据类型变换（例如：`Raw bytes → UTF-8 String → Tab.content → markdown-it tokens → HTML string → DOM`）
- 汇总所有链路到一张总图

---

## 执行要求（全局）

1. **每读完一个文件，必须输出**：该文件的职责一句话 + 关键导出清单
2. **每完成一个 Phase，写一课 HTML 笔记**（使用 T-teach 课程模板，保存到 `lessons/` 目录）
3. **不要跳过任何文件**：标注 `【现有·复用】` 的模块同样需要读（它们是地基）
4. **代码引用格式**：`文件路径:行号`，例如 `app/src-tauri/src/editor/file_ops.rs:22`
5. **遇到不理解的设计决策**，查阅对应的工程层 ADR（`speculo/.speculo/.config/adr/ADR-00XX.md`）
6. **全程中文交流**，代码注释保留原文

---

## 参考资源优先级

1. **一手资料（最高优先）**：源码本身 + AGENTS.md + ADR
2. **二手资料**：CONTEXT.md + roadmap 文档
3. **Cargo.toml / package.json**：依赖清单揭示能力边界
