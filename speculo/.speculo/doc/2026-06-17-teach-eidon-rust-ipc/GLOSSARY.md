# GLOSSARY — EIDON Rust IPC 术语表

> 持续更新：每节课学员真正理解的术语追加到此文件。

## Tauri 2 核心概念

- **Tauri Command（Tauri 命令）** — 用 `#[tauri::command]` 标记的 Rust 函数，自动暴露给前端 JS 通过 `invoke()` 调用。是前端→后端的 RPC（远程过程调用）机制。类比：HTTP API endpoint。

- **invoke / @tauri-apps/api/core** — 前端 JS 调用 Rust 命令的函数。用法：`import { invoke } from '@tauri-apps/api/core'; const result = await invoke('command_name', { arg1: 'value' });` 返回 Promise。

- **generate_handler!** — Tauri 宏，将多个 `#[tauri::command]` 函数注册到应用。所有命令必须在此列出才能被前端调用。类比：Express 的 `app.get('/route', handler)` 注册。

- **Tauri Event（Tauri 事件）** — 后端向前端推送消息的机制。后端用 `app_handle.emit("event-name", payload)` 发送，前端用 `listen("event-name", callback)` 接收。**单向推送，无返回值**。类比：WebSocket push / Server-Sent Events。

- **AppHandle** — 代表整个 Tauri 应用句柄。通过它可以：发送事件 (`emit`)、获取窗口、访问应用路径等。在命令参数中写 `app: AppHandle` 即可注入。

- **Tauri State** — 用 `app.manage(state)` 注册的共享状态，在命令中通过 `state: tauri::State<'_, MyState>` 注入访问。类比：依赖注入容器中的单例。

- **spawn_blocking** — `tauri::async_runtime::spawn_blocking(closure)` 将 CPU 密集型工作（如文件 I/O、git 操作）从主线程移到线程池执行，防止 UI 卡顿。命令函数声明为 `async fn`，内部使用此方法包装同步逻辑。

- **tauri.conf.json** — Tauri 应用配置文件，定义窗口大小、安全策略、bundle 信息等。

## Rust 概念

- **#[path = "..."]** — Rust 属性，指定模块文件的物理路径。EIDON 用它保持文件树扁平（如 `#[path = "editor/file_ops.rs"]` 而非深层嵌套模块目录）。

- **#[cfg(not(target_os = "android"))]** — 条件编译属性。被标记的代码仅在非 Android 平台编译。EIDON 用此将 git 功能排除在 Android 之外（libgit2 交叉编译困难）。

- **Result<T, String>** — Tauri 命令的标准返回类型。`Ok(T)` 表示成功，前端收到 `T`；`Err(String)` 表示失败，前端 catch 到错误信息字符串。

- **serde::Serialize / Deserialize** — Rust 序列化框架。`#[derive(Serialize)]` 的结构体可自动转为 JSON 传给前端；`#[derive(Deserialize)]` 的结构体可从 JS 传来的 JSON 参数自动解析。

- **Mutex / RwLock / Arc** — Rust 的线程安全共享状态工具。`Mutex` = 互斥锁（读写都独占）；`RwLock` = 读写锁（多读单写）；`Arc` = 原子引用计数（多线程共享所有权）。

- **Lazy / OnceLock** — 延迟初始化工具。`Lazy` = 首次访问时初始化；`OnceLock` = 只能写入一次的锁。用于全局单例状态。

## 本项目关键术语

- **workspace** — 用户打开的文件夹，包含 `.md`/`.markdown` 笔记文件。所有 git 操作和索引以此目录为根。

- **AutoGit** — 基于 libgit2 的自动版本历史功能。每次保存自动 commit，无需用户手动操作 git。

- **workspace index** — 全量扫描 workspace 中所有 markdown 文件，提取 wikilinks、backlinks、tags、headings 等信息，存于内存 + JSON 缓存。

- **watcher** — 基于 `notify` crate 的文件变更监听器。当外部程序修改了已打开的文件时通知前端。

- **self-write suppression** — 避免 "自己写的文件触发自己的 watcher" 的机制。`write_file` 后短暂时间内同名文件的变更事件被忽略。
