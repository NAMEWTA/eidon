# EIDON Tauri 2 → Electron 迁移评估（修订版）

## Context

EIDON 当前基于 Tauri 2（Rust 后端 + React 前端），评估迁移到 Electron 的可行性与工作量。本评估聚焦：Rust 部分哪些修改/删除/重写，技术栈替换，以及新架构下 `core/` 的定位。

---

## 核心架构决策：`core/` 上移到 Main Process

### 当前架构（Tauri）

```
┌─ Renderer (浏览器沙箱) ─────────────────────────────┐
│  React 组件 → Zustand stores                         │
│       ↓                                              │
│  core/nodes, templates, todos, consistency           │ ← 业务逻辑在浏览器里跑
│       ↓                                              │
│  core/bridge/file.ts (WorkspaceFileStore)            │ ← 通过 invoke() 调 Rust
└──────────────────────────────────────────────────────┘
                        ↓ invoke("read_file", ...)
┌─ Rust (src-tauri) ──────────────────────────────────┐
│  file_ops, git_history, workspace_index, spellcheck  │ ← 能力层
│  → 直接操作文件系统                                    │
└──────────────────────────────────────────────────────┘
```

**问题**：业务逻辑 (`core/nodes`, `core/templates`, `core/todos`) 跑在浏览器沙箱里，每次文件读写都要 IPC 到 Rust → `invoke("read_file")` → `invoke("write_file")`。`core/` 模块通过依赖注入（`NodeStore` 接口）间接操作文件——这个接口层本身就是为跨越浏览器沙箱而存在的。

### 迁移后架构（Electron，推荐方案）

```
┌─ Renderer (Chromium) ───────────────────────────────┐
│  React 组件 → Zustand stores                        │
│       ↓                                              │
│  ipcRenderer.invoke('nodes.scan', workspace)         │ ← stores 变成薄 IPC 调用层
│  ipcRenderer.invoke('todos.list', ...)               │
│  ipcRenderer.invoke('file.read', path)               │
└──────────────────────────────────────────────────────┘
                        ↓ Electron IPC
┌─ Main Process (Node.js) ────────────────────────────┐
│  ipcMain.handle('nodes.scan', ...)                   │ ← 薄 dispatch 层
│       ↓                                              │
│  core/nodes/  ← 直接调 fs.readFile/writeFile          │ ← 业务逻辑在 Node.js 里跑
│  core/templates/                                     │   **可以 import 任何 Node SDK**
│  core/todos/                                         │
│  core/consistency/                                   │
│  core/ai/ → pi-coding-agent SDK                      │ ← 🎯 直接操作文件系统
│       ↓                                              │
│  services/ (文件监听、git、拼写检查、编码、转换...)      │
└──────────────────────────────────────────────────────┘
```

**优势**：
1. **消除桥接抽象**：`core/` 模块不再需要 `NodeStore`/`TemplateStore` 等注入接口，直接用 `fs.readFile`/`fs.writeFile`。这会删除一整层间接代码。
2. **任意 Node SDK 可用**：pi-coding-agent、任何 AI SDK、任何需要文件系统访问的库都能直接在 `core/ai/` 中使用。
3. **安全性更好**：文件系统访问在特权主进程，渲染进程只拿到处理后的 JSON 结果。
4. **性能提升**：`core/nodes/scan()` 不再需要为每个 `.node/node.json` 做一次 `invoke("read_file")` 往返。一次 IPC 调用，主进程内做所有文件 I/O，返回聚合结果。

### 什么必须保持共享（Renderer + Main 都能 import）

通过实际代码审查（14 个渲染进程文件从 `core/contracts/` 导入 *类型*）：

| 模块 | 保留位置 | 原因 |
|------|---------|------|
| **`core/contracts/`** | `shared/contracts/` | Zod schemas 及推断类型被 14 个组件/store 导入（全部 `import type`）。Zod 在 Node 和浏览器都可用。 |
| **`core/shared/`** | `shared/utils/` | `id.ts`（ULID 生成）被 stores 和 core 同时使用。`date.ts`、`errors.ts` 纯工具函数。 |

### 什么移入 Main Process

| 模块 | 当前代码 | 迁移后 |
|------|---------|--------|
| `core/nodes/` | 通过注入的 `NodeStore` 接口操作文件 | 直接用 `fs` 读写 `.node/` 目录 |
| `core/templates/` | 同上，`TemplateStore` 接口 | 直接用 `fs` 读写 `.eidon/templates/` |
| `core/todos/` | `TodoFileStore` 接口 | 直接用 `fs` 读写 `.node/todos.json` |
| `core/consistency/` | `ConsistencyReader` 接口 | 直接用 `fs` + `fast-glob` |
| `core/snapshots/` | 直接 `import {bridge/git}`（唯一越界导入） | 调用同进程 git service |
| `core/ai/` | 空占位（throw-on-call stub） | **直接 import pi-coding-agent SDK** |
| `core/bridge/` | Tauri invoke/event 封装 | 不再需要——IPC 通道在 `electron/ipc-handlers/` |

---

## Part A: Rust 模块迁移分类

### 类别 1：直接删除（Electron 内置替代）— ~420 行

| Rust 代码 | 功能 | Electron 替代 |
|-----------|------|---------------|
| `runner.rs` 菜单 (~250行) | 原生菜单 + i18n + 三轴缩放快捷键 | `Menu.buildFromTemplate()` |
| `runner.rs` 窗口管理 (~120行) | 关闭拦截、钳制、显示器感知 | `BrowserWindow` 事件 + `screen` API |
| `runner.rs` macOS 语言 (~30行) | objc2 → NSUserDefaults | `app.setLocale()` (Electron 25+) |
| `file_ops.rs` print_webview (~10行) | WKWebView 打印 | `webContents.print()` |
| Tauri 5 个插件 | opener/dialog/clipboard/notification/window-state | `shell`/`dialog`/`clipboard`/`Notification`/`electron-window-state` |

### 类别 2：TypeScript 重写（跑在 Main Process 的 Node.js）— ~2,910 行

所有重写都是 "同算法不同语言"，但现在可以直接用 `fs`、`child_process`、`crypto` 等 Node 内置模块：

| 模块 | 行数 | Main Process 实现 |
|------|------|-------------------|
| `file_ops.rs` | ~410 | `fs.readFile`/`writeFile` + `jschardet`/`iconv-lite` 编码检测 |
| `search.rs` | ~100 | `fast-glob` + 逐行 `fs.createReadStream` |
| `workspace_index.rs` | ~880 | `gray-matter` + RegExp，JSON 缓存到磁盘 |
| `cjk_proofread.rs` | ~530 | 直接端口到 TypeScript，相同 Unicode 范围，零外部依赖 |
| `cloud_folder.rs` | ~390 | 纯字符串路径匹配 + `uuid` |
| `dev_bridge.rs` | ~540 | `net.createServer()` — 更简单（`executeJavaScript` 返回 Promise） |
| `app_build.rs` | ~35 | `process.env.EIDON_APP_STORE_BUILD` |
| `runner.rs` 语言偏好 | ~25 | `fs.readFileSync` + `fs.writeFileSync` |

### 类别 3：Rust Crate → npm 包替换（全部在 Main Process）

| Rust Crate | npm 替代 | 风险 |
|------------|----------|------|
| `git2` (libgit2) | `isomorphic-git` + `child_process.exec('git')`（仅 prune/gc） | ⚠️ 最高 |
| `chardetng`+`encoding_rs` | `jschardet` + `iconv-lite` | 🟡 中（CJK） |
| `spellbook` (Hunspell) | `nspell`（纯 JS，同格式复用字典） | 🟡 中 |
| `notify` | `chokidar`（VS Code 同款） | ✅ 低 |
| `walkdir` | `fast-glob` | ✅ 低 |
| `calamine` (XLSX) | `xlsx` (SheetJS) | ✅ 低 |
| `quick-xml`+`zip` (DOCX) | `adm-zip`+`fast-xml-parser` | ✅ 低 |
| `csv` | `csv-parse` | ✅ 低 |
| `htmd` (HTML→MD) | `turndown` | ✅ 低 |
| `pdf-extract` | `pdfjs-dist` (Mozilla) | ✅ 低 |
| `serde_yaml` | `gray-matter` | ✅ 低 |
| `sha2` | `crypto.createHash('sha256')` (Node 内置) | ✅ 低 |
| `keyring` | `keytar` 或 `safeStorage` (Electron 内置) | ✅ 低 |
| `argon2`+`chacha20poly1305` | `argon2-browser` (WASM) + `@noble/ciphers` | 🟡 中 |
| `reqwest` | `fetch()` (Node 18+) | ✅ 低 |
| `tokio` | Node.js event loop | ✅ 低 |

**结论：零 Rust 保留。无需 native addon 或 sidecar。**

---

## Part B: 新架构详细设计

### B.1 目录结构变更

```
app/
├── shared/                         # ← 新：Renderer + Main 共享
│   ├── contracts/                  # 从 core/contracts/ 移入
│   │   ├── node.ts                 # Zod schemas + 推断类型
│   │   ├── template.ts
│   │   └── todos.ts
│   └── utils/                      # 从 core/shared/ 移入
│       ├── id.ts                   # ULID 生成 (crypto.getRandomValues)
│       ├── date.ts                 # Unix 时间戳转换
│       └── errors.ts               # CoreError 类
│
├── src/                            # Renderer（不变）
│   ├── components/                 # React 组件 — 零修改
│   ├── stores/                     # Zustand stores — 改为调 ipcRenderer.invoke
│   ├── composables/                # 改为调 ipcRenderer.invoke
│   ├── lib/                        # CodeMirror 扩展等 — 零修改
│   └── styles/                     # 零修改
│
├── electron/                       # ← 新：Electron Main Process
│   ├── main.ts                     # BrowserWindow、Menu、IPC 注册入口
│   ├── preload.ts                  # contextBridge 暴露有限 API
│   │
│   ├── ipc-handlers/               # 薄 dispatch 层（~25 个 handler）
│   │   ├── nodes.handler.ts        # → core/nodes
│   │   ├── templates.handler.ts    # → core/templates
│   │   ├── todos.handler.ts        # → core/todos
│   │   ├── consistency.handler.ts  # → core/consistency
│   │   ├── files.handler.ts        # → services/files
│   │   ├── git.handler.ts          # → services/git
│   │   ├── search.handler.ts       # → services/search
│   │   ├── index.handler.ts        # → services/workspace-index
│   │   ├── spellcheck.handler.ts   # → services/spellcheck
│   │   ├── convert.handler.ts      # → services/conversion
│   │   ├── pandoc.handler.ts       # → services/pandoc
│   │   ├── cjk.handler.ts          # → services/cjk-proofread
│   │   ├── cloud.handler.ts        # → services/cloud-folder
│   │   ├── watcher.handler.ts      # → services/file-watcher
│   │   └── window.handler.ts       # → BrowserWindow 控制
│   │
│   ├── core/                       # ← 从 app/core/ 移入（业务逻辑）
│   │   ├── nodes.ts                # 直接用 fs 替代 NodeStore 接口
│   │   ├── templates.ts            # 直接用 fs 替代 TemplateStore 接口
│   │   ├── todos.ts                # 直接用 fs 替代 TodoFileStore 接口
│   │   ├── consistency.ts          # 直接用 fs 替代 ConsistencyReader 接口
│   │   ├── snapshots.ts            # 调用同进程 services/git
│   │   └── ai.ts                   # → import pi-coding-agent SDK 🎯
│   │
│   └── services/                   # ← 文件系统能力层（原 Rust 功能）
│       ├── files.ts                # Node.js fs 封装 + 编码检测
│       ├── encoding.ts             # jschardet + iconv-lite
│       ├── file-watcher.ts         # chokidar
│       ├── workspace-index.ts      # gray-matter + walk + JSON 缓存
│       ├── search.ts               # fast-glob + 行扫描
│       ├── spellcheck.ts           # nspell + 用户字典
│       ├── cjk-proofread.ts        # 6 个检测器，TypeScript 端口
│       ├── conversion/
│       │   ├── docx.ts             # adm-zip + fast-xml-parser + turndown
│       │   ├── xlsx.ts             # xlsx (SheetJS)
│       │   ├── pdf.ts              # pdfjs-dist
│       │   ├── html.ts             # turndown
│       │   ├── csv.ts              # csv-parse
│       │   └── pptx.ts             # adm-zip + fast-xml-parser
│       ├── git/
│       │   ├── history.ts          # isomorphic-git (log, diff, read, status)
│       │   ├── auto-commit.ts      # isomorphic-git (add + commit)
│       │   ├── branches.ts         # isomorphic-git (branch, checkout)
│       │   └── prune.ts            # child_process.exec('git ...')
│       ├── pandoc.ts               # child_process.exec('pandoc ...')
│       ├── cloud-folder.ts         # 纯路径检测
│       ├── session.ts              # JSON 会话文件 + uuid
│       └── dev-bridge.ts           # net.createServer + executeJavaScript
│
├── core/                           # ← 删除（内容移入 electron/core/ 和 shared/）
└── src-tauri/                      # ← 整体删除
```

### B.2 IPC 通道设计

**核心原则**：Renderer 不直接调 `read_file`/`write_file`，而是调业务语义的 IPC：

```typescript
// ─── Renderer: stores 变成薄 IPC 调用层 ───

// stores/nodes.ts（改造后）
import { ipcRenderer } from 'electron'; // 通过 preload 或 bridge

export const useNodesStore = create<NodeStoreState>(() => ({
  // 原来：await nodeStore.scanNodes(workspace)  // nodeStore 是注入的 WorkspaceFileStore
  // 现在：一次 IPC 调用，main 里完成所有文件 I/O
  scanNodes: async (workspace: string) =>
    ipcRenderer.invoke('nodes:scan', workspace),

  createNode: async (workspace: string, parentPath: string, ...) =>
    ipcRenderer.invoke('nodes:create', { workspace, parentPath, ... }),
}));

// stores/tabs.ts — 文件读写
// 原来：await invoke("read_file", { path })
// 现在：await ipcRenderer.invoke('file:read', path)

// stores/gitHistory.ts — git 操作
// 原来：await invoke("git_file_history", { folder, filePath, limit })
// 现在：await ipcRenderer.invoke('git:file-history', folder, filePath, limit)
```

```typescript
// ─── Main Process: handler → core → service ───

// electron/ipc-handlers/nodes.handler.ts
import { ipcMain } from 'electron';
import { scanNodes, createNode, promoteToNode } from '../core/nodes';
import { getWorkspace } from '../services/workspace';

ipcMain.handle('nodes:scan', async (_event, workspace: string) => {
  return scanNodes(workspace);  // 直接读 .node/ 目录
});

ipcMain.handle('nodes:create', async (_event, args) => {
  return createNode(args.workspace, args.parentPath, args.config);
});

// electron/core/nodes.ts（改造后）
// 原来：export function scanNodes(store: NodeStore, root: string): Promise<NodeTree>
// 现在：export async function scanNodes(root: string): Promise<NodeTree>
//       直接用 fs.readdir/fs.readFile，无需注入的 store 参数
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export async function scanNodes(root: string): Promise<NodeTree> {
  const nodeDir = path.join(root, '.node');
  const entries = await fs.readdir(nodeDir, { withFileTypes: true });
  // ... 同算法，不同的文件读取方式
}
```

### B.3 Stores 改造：注入接口消除

当前 `core/nodes.ts` 的函数签名：
```typescript
// 现在（Tauri）：依赖注入模式——因为浏览器里不能直接读文件
export async function scanNodes(
  store: NodeStore,        // ← 注入的 bridge 适配器
  root: string
): Promise<NodeTree>
```

迁移后（Main Process）：
```typescript
// 迁移后（Electron main）：直接调 fs，无需注入
export async function scanNodes(
  root: string
): Promise<NodeTree>
```

这意味着 **`core/nodes`、`core/templates`、`core/todos` 的函数签名会简化**——所有 `store: XxxStore` 参数消失。这是一次性清理，改动聚焦且机械。

### B.4 pi-coding-agent 集成路径

pi-coding-agent SDK 需要 Node.js 环境（文件系统 + 进程管理）。当前 Tauri 架构下无法使用（Rust 端是另一套生态）。迁移后：

```typescript
// electron/core/ai.ts（改造后）
import { PiAgent } from '@earendil-works/pi-agent-core';
import { createAiModel } from '@earendil-works/pi-ai';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export async function runAiOnWorkspace(workspace: string, prompt: string) {
  // 直接读取工作区文件作为 context
  const files = await collectWorkspaceFiles(workspace);

  const agent = new PiAgent({
    model: createAiModel({ provider: 'anthropic', model: 'claude-sonnet-4-6' }),
    workspace: workspace,
    tools: ['read_file', 'write_file', 'search'],  // 直接操作真实文件系统
  });

  return agent.run(prompt, { context: files });
}

// electron/ipc-handlers/ai.handler.ts
ipcMain.handle('ai:run', async (_event, workspace: string, prompt: string) => {
  return runAiOnWorkspace(workspace, prompt);
});
```

pi 作为一个 **在 main process 中运行的 coding agent**，可以直接：
- 读取工作区文件作为上下文
- 搜索/修改文件
- 执行 shell 命令（`child_process`）
- 通过 pi 的 tool calling 机制操作文件系统

这是 Tauri 架构无法做到的事情（Tauri 的 AI 能力必须在 Rust 端或 WebView 端各自实现，无法像 Node.js 这样统一）。

---

## Part C: 迁移影响面分析

### 需要修改的文件

| 层级 | 文件数 | 改动类型 |
|------|--------|---------|
| `core/contracts/` → `shared/contracts/` | 4 | 移动目录，导入路径更新 |
| `core/shared/` → `shared/utils/` | 4 | 移动目录，导入路径更新 |
| `core/nodes/`, `templates/`, `todos/`, `consistency/`, `ai/` → `electron/core/` | 5-6 | 移动 + 移除注入接口参数，改为直接 `fs` |
| `core/snapshots/` → `electron/core/` | 1 | 移动 + `../bridge/git` 导入 → `../services/git` |
| `core/bridge/` | 7 | **删除**。IPC 通道在 `electron/ipc-handlers/` 重新定义 |
| `src/stores/*.ts` | ~14 | `invoke()` → `ipcRenderer.invoke()`，`createWorkspaceFileStore` → 按业务语义拆分 IPC 调用 |
| `src/composables/*.ts` | ~10 | 同上 |
| `src/components/*.tsx` | ~5 | 少量 bridge 直接调用者（`FileTree`、`PaneContent` 等） |
| `src/lib/*.ts` | ~8 | 少量 bridge 直接调用者（`cm-spellcheck`、`cm-image-paste` 等） |
| **总计需修改** | **~60 文件** | 其中 ~40 个是机械替换 |

### 完全不需要修改的文件

- 所有 React 组件（除少数 bridge 直接调用者）：`Editor.tsx`、`Preview.tsx`、`CommandPalette.tsx`、`SettingsPanel.tsx` 等
- 所有 CodeMirror 扩展：`cm-config.ts`、`cm-live-preview.ts`、`cm-wikilink.ts`、`cm-frontmatter.ts` 等
- 所有 shadcn/ui 组件（`components/ui/`）
- 所有 lib 纯函数：`frontmatter.ts`、`markdown.ts`、`tags.ts`、`wikilinks.ts` 等
- 所有样式文件
- i18n 系统
- **所有测试**：`core/__tests__/` 中的测试逻辑不变（纯函数测试，不依赖 Tauri）

---

## Part D: 风险评估

### 最高风险 🔴

**`git_prune.rs`（200行）→ isomorphic-git 无等价物**
- 使用 libgit2 底层 `commit()` API 重写提交树
- 缓解：`child_process.exec('git reflog expire --all && git gc --prune=now')`
- 如果系统未安装 git：隐藏设置页中的"修剪历史"选项。此功能本身就是低频高级操作

### 新增风险 🟡

**依赖注入消除的连锁改动**
- `core/nodes`、`core/templates`、`core/todos` 中所有函数签名的 `store: XxxStore` 参数都要移除
- 影响所有调用方：stores、handler、测试
- 但改动是机械的——每个函数少一个参数，函数体内 `store.readFile()` → `fs.readFile()`
- 预估工作量已包含在 "core 上移" 的 3 人天中

### 降低的风险 🟢

**IPC 调用次数大幅减少**
- 当前：`scanNodes()` 对每个 `.node/node.json` 都做一次 `invoke("read_file")`（100 个节点 = 100 次 IPC 往返）
- 迁移后：`scanNodes()` 在 main process 内完成所有 `fs.readFile`（100 个节点 = 1 次 IPC 往返）
- **性能显著提升**

---

## Part E: 工作量估算

| 阶段 | 内容 | 人天 |
|------|------|------|
| 项目脚手架 | `package.json`、`electron-builder.yml`、`vite.config.ts`、`main.ts`、`preload.ts` | 3 |
| 目录重组 | `core/` → `electron/core/` + `shared/`，更新所有导入路径 | 2 |
| 依赖注入消除 | `nodes`/`templates`/`todos`/`consistency` 移除 store 参数，改为直接 `fs` | 3 |
| Stores 改造 | 14 个 store 从 `invoke` + `WorkspaceFileStore` 改为 `ipcRenderer.invoke` | 3 |
| 菜单迁移 | i18n 菜单从 Rust 到 JS | 2 |
| 窗口管理 | 关闭拦截、钳制、状态恢复 | 2 |
| 文件 I/O + 编码 | Node `fs` + `jschardet`/`iconv-lite` | 5 |
| 文件监听 | `chokidar` + 自写抑制 | 3 |
| 工作区索引 | `gray-matter` + 正则 + JSON 缓存 | 5 |
| 全文搜索 | `fast-glob` | 1 |
| 拼写检查 | `nspell` + 用户字典 | 2 |
| CJK 校对 | TypeScript 端口 | 2 |
| 文件转换 | DOCX/XLSX/PDF/HTML/CSV/PPTX | 5 |
| Git 操作 | `isomorphic-git` + 系统 git | 8 |
| 云文件夹 + 会话 | 路径检测 + `uuid` | 2 |
| Pandoc | `child_process` | 1 |
| IPC handlers | ~25 个 handler（薄 dispatch 层） | 2 |
| CI/CD | 删除 Rust，更新 release workflow | 2 |
| 测试 | 原有 core 测试 + 集成测试 | 10 |
| 代码签名 | macOS 公证 + Windows 签名 | 3 |
| 文档 | README + AGENTS.md + CLAUDE.md | 1 |
| **总计** | | **~67 人天（~13.5 人周）** |

**现实时间线**：单人全职 8-12 周；双人 6-8 周。

---

## Part F: 关键结论

### pi-coding-agent 可行性

✅ **完全可行且是此架构的核心优势**。pi 需要：
1. Node.js 运行时 — Electron main process 就是 Node.js
2. 文件系统访问 — `fs` 模块在 main process 中完整可用
3. 工作区上下文 — 直接 `fs.readdir` + `fs.readFile` 收集
4. 多 provider LLM — pi 的 `@earendil-works/pi-ai` 可在 main process 中使用 `fetch()` 调 API

pi 可以作为 `electron/core/ai.ts` 的直接依赖，在 main process 内操作真实文件系统，结果通过 IPC 返回给 renderer 展示。

### 核心取舍

| 优势 | 代价 |
|------|------|
| 统一 npm 技术栈，零 Rust/Cargo | 二进制体积 ~130 MB（vs ~12 MB） |
| `core/` 直接用 `fs`，消除注入接口层 | 内存 ~200-400 MB（vs ~80-150 MB） |
| 任意 Node SDK 可用（pi、AI、等） | ~13.5 人周迁移工作量 |
| CI 构建 ~15 分钟（vs ~45 分钟） | 编码检测准确度轻微下降（CJK） |
| Chrome DevTools 完整调试 | |
| 跨平台 Chromium 一致性 | |
| 无需 Linux WebKit 系统依赖 | |

---

## 验证方案

1. **core 单元测试**：原有 `core/__tests__/` 测试继续通过（测试纯逻辑，mock `fs`）
2. **IPC 集成测试**：对每个 handler 编写 `ipcMain.handle` → handler → 结果的链路测试
3. **手动回归**：macOS/Windows/Linux 逐项验证全部 48 个命令
4. **编码回测**：CJK 编码测试集验证 `jschardet`+`iconv-lite` 准确度
5. **Git 回测**：10/100/1000 提交的仓库验证 isomorphic-git
6. **性能基线**：对比 Tauri vs Electron 的冷启动、内存、文件操作延迟
7. **pi 集成验证**：用 pi 在工作区执行文件读写/search 任务
