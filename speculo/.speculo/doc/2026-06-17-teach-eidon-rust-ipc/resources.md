# Resources — EIDON Rust IPC 学习资源

## 一手资料（最高优先级）

- **Tauri 2 官方文档 — Calling Rust**
  https://v2.tauri.app/develop/calling-rust/
  覆盖：`#[tauri::command]`、参数注入、`generate_handler!`、错误处理。
  何时取用：学习如何写一个新的 Tauri Command。

- **Tauri 2 官方文档 — Events**
  https://v2.tauri.app/develop/events/
  覆盖：`emit`/`listen`、事件 payload 类型、事件权限配置。
  何时取用：学习 Rust→前端推送消息。

- **Tauri 2 官方文档 — Menu**
  https://v2.tauri.app/learn/menu/
  覆盖：`MenuBuilder`、`SubmenuBuilder`、`on_menu_event`、快捷键。
  何时取用：学习原生菜单开发。

- **The Rust Book**
  https://doc.rust-lang.org/book/
  覆盖：Rust 基础语法、所有权、错误处理、并发。
  何时取用：看不懂 Rust 代码时查阅。

## 本项目源码（按阅读顺序）

1. `app/src-tauri/src/main.rs` — 二进制入口，了解 tokio runtime 创建
2. `app/src-tauri/src/runner.rs` — 核心文件，所有命令注册和事件处理
3. `app/src-tauri/src/editor/file_ops.rs` — 最简单的 Command 示例，适合新手阅读
4. `app/src-tauri/src/editor/watcher.rs` — Event + State + Command 三合一
5. `app/src-tauri/src/knowledge/workspace_index.rs` — 全局状态 + watcher + 缓存
6. `app/src-tauri/Cargo.toml` — 依赖声明，了解用了哪些 crate
7. `app/core/bridge/tauri.ts` — 前端 bridge 层，了解前端如何封装 invoke/listen

## 社区资源

- **Tauri 2 GitHub Discussions**
  https://github.com/tauri-apps/tauri/discussions
  遇到 Tauri 框架问题时的问答社区。

- **Rust Users Forum**
  https://users.rust-lang.org/
  Rust 语言层面的问题讨论。

- **The Tauri Blog**
  https://v2.tauri.app/blog/
  Tauri 2 新特性和最佳实践。
