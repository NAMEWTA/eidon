# 术语表 · EIDON 全栈深度研究

> 本术语表记录用户在学习过程中**真正理解**的术语。每条 1-2 句，说清术语**是什么**，不说它做什么或怎么做。
> 术语间互相引用，后续定义优先使用已收录术语。理解加深时在原文上修订，不留过时条目。
>
> 权威源：`CONTEXT.md`（长期术语表）、`AGENTS.md`（工程指南）。

---

## 三层与架构

- **三层【代码】**：EIDON 软件分层的统称，由 `src`(React UI)、`core`(TS 业务核心)、`src-tauri`(Rust 能力壳) 三层组成，单向依赖不可逆。**禁止裸写为「三层」。**
- **三层【节点】**：EIDON 数据节点层级的统称，由 L1、L2、L3 三层组成，深度=层级铁律。**禁止裸写为「三层」。**
- **core/bridge/**：`app/core/bridge/` 目录，TS 代码访问 Rust 能力的**唯一合法出口**。ESLint allowlist 必须保持为 0（无例外）。
- **单向依赖**：`src→core→src-tauri` 的调用方向约束，由 `eslint-plugin-boundaries` 机器强制。反向 import 在 CI 会被拦截。

## 数据层四模块

- **nodes**：EIDON 数据层模块之一，负责节点身份(ULID)、node.json 读写、扫描建树、CRUD、提升为节点。
- **templates**：EIDON 数据层模块之一，负责多模板 schema（6类字段）的版本化管理、编辑生成新版、内置种子。
- **snapshots**：EIDON 数据层模块之一，负责版本能力归属。**不造新快照系统**，仅薄封装现有 git bridge（autoGit 不改）。
- **consistency**：EIDON 数据层模块之一，负责结构违规检测+标记（四类），只读不阻塞不自动改。

## 节点与数据

- **L1/L2/L3 节点**：workspace 根下第 1/2/3 层含 `.node/` 子目录的结构节点。L1/L2 为纯组织层，L3 为唯一内容承载层。第 4 层起为自由文件夹（无身份）。
- **节点身份（.node/node.json）**：节点的自包含身份文件，含 id/templateId/level/type/schemaVersion/fields/references/flags，随目录移动。
- **深度=层级铁律**：节点层级由物理位置唯一确定的规则——workspace 根下第 1 层为 L1、第 2 层为 L2、第 3 层为 L3。
- **元字段**：节点身份骨架字段（id/templateId/level/type/schemaVersion/createdAt/flags），与模板无关，初始化即生成，用户不可增删。
- **扩展字段**：模板定义的业务字段（限 6 类型：text/textarea/number/date/select/boolean），各模板可自行扩展，支持懒迁移。
- **模板版本化**：编辑模板生成新版本（旧版不改），旧节点保持旧 schemaVersion 合法存在，仅显式批量升级才迁移。
- **创建期硬强制**：通过 EIDON UI 只能按 根→L1→L2→L3→自由 路径创建节点，不存在越级创建入口。
- **提升为节点**：将普通文件夹按其当前物理深度提升为对应层级节点的操作，生成新 ULID + `.node/`。结构违规整改的主入口。

## 违规与一致性

- **结构违规**：工作区中不符合三层【节点】规则的状态，共四类：①前三层普通文件夹 ②L1/L2 内容文件 ③层级不符 ④.node/ 缺失。
- **可重建铁律**：删 `.eidon/` 索引缓存后，遍历 `.node/` + `.eidon/templates/` 可 100% 重建节点树/身份/字段/id→path 的产品层公理（AX-1/AX-4）。

## 系统与边界

- **EIDON workspace**：被 EIDON 管理的文件夹根目录，系统区为 `.eidon/`（templates + 索引缓存）。区别于旧 SoloMD 的 `.solomd/` 扁平工作区。
- **已删除 AI 子系统**：原 SoloMD 的 AI·Agent·Recipes 整块代码（Rust 4 目录 + Core TS 4 模块 + Bridge 8 文件 + 前端 ~15 组件 4 stores），2026-06 物理删除。`core/ai/` 仅留类型占位。
- **工程层 ADR**：`speculo/.speculo/.config/adr/` 下的架构决策记录（ADR-0001~0018），约束代码架构与数据层落点。引用须标「工程层 ADR-00XX」。
- **产品层 ADR**：`temp/EIDON_数据层架构决策记录_ADR.md` 中的十三块基石（ADR-001~013）+ 五公理（AX-1~5），产品愿景源。引用须标「产品层 ADR-00X」。

## Rust 运行时与线程模型

- **spawn_blocking**：Tauri 的异步线程池派发机制，将阻塞 I/O 从 IPC 单线程事件循环踢出到专用线程池，防止 UI 冻结。所有文件读写、walkdir 遍历、libgit2 操作均通过此模式包装。
- **Tauri IPC 线程**：Tauri invoke handler 所在的单线程事件循环，所有 `#[tauri::command]` 默认在此执行。同步阻塞会导致整个应用无响应。
- **`#[path]` 属性**：Rust 的模块路径重映射语法（`#[path = "folder/file.rs"]`），EIDON 用它将按领域分文件夹的模块扁平挂载到 crate 根，避免深层 `mod` 嵌套。
- **generate_handler!**：Tauri 的宏，用于注册所有 `#[tauri::command]` 到 invoke handler。每个命令按 `module::command` 格式列出。
- **Debouncer（notify_debouncer_mini）**：notify 事件去重器，将 OS 在短时间内发出的多个文件变更事件合并为一次回调，EIDON 配置 300ms 窗口。

## 编码与 I/O

- **BOM（Byte Order Mark）**：文件头 2-3 字节的编码标记。UTF-8 BOM=`EF BB BF`、UTF-16LE BOM=`FF FE`、UTF-16BE BOM=`FE FF`。是唯一 100% 可靠的编码信号，检测优先级最高。
- **chardetng**：Mozilla 的字符编码统计检测库，对无 BOM 文件通过字节频率模式推断编码（GBK/Big5/Shift_JIS/EUC-KR 等）。
- **encoding_rs**：Mozilla 的编码转换库，负责将检测到的编码字节流解码为 UTF-8。EIDON 用它做严格解码→宽松解码→lossy 回退三层容错。
- **原子保存（Atomic Save）**：编辑器的保存模式——先写临时文件，再 `rename` 覆盖目标。VSCode/TextEdit/Vim 均使用此模式。此操作替换文件 inode，导致直接 watch 文件会永久失聪。
- **self-write 抑制**：EIDON 写文件后通过全局 HashMap 记录时间戳，watcher 回调中检查并抑制 500ms 内的自写事件，避免「外部修改」对话框误触发。

## Rust 领域目录

- **editor/**：Rust 侧编辑器领域目录，包含文件操作（file_ops）、文件监听（watcher）、导出（pandoc）、主题（themes）。
- **knowledge/**：Rust 侧知识处理领域目录，包含全文搜索（search）、工作区索引（workspace_index）、拼写检查（spellcheck）、中文校对（cjk_proofread）。
- **git/**：Rust 侧版本控制领域目录，包含版本历史（git_history）、分支操作（git_ops）、GitHub 同步（github_sync）、云盘检测（cloud_folder）、E2EE 加密（crypto）。

---

*最后更新：2026-06-12 · 最新课程：Lesson 0002*
