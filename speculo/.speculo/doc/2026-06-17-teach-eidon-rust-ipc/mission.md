# Mission: 理解 EIDON 前端↔Rust 后端全链路通信

## Why（为什么学）

你是 Rust 和 Tauri 2 新手，当前看不懂 `app/src-tauri/src/` 下 Rust 代码如何与前端
（Vue/React/TypeScript WebView）交互通信。理解了整套 IPC 机制和目录数据流后，你就能：
- 自己新增一个 Tauri 命令
- 自己新增一个后端→前端事件推送
- 看懂任何一个 `.rs` 文件在整体架构中的位置

## Success（成功标准）

1. 能说出前端↔Rust 之间的 **4 种通信方式**，并举例
2. 能画出 `invoke('command', args)` 从前端到 Rust 再返回的**完整调用链**
3. 能说出 `runner.rs` 中 `.invoke_handler(generate_handler![...])` 为何是命令注册中心
4. 能说出 Rust 目录中每个文件的职责和它属于哪一层
5. 能独立新增一个简单的 `#[tauri::command]` 并从前端调用

## Constraints（约束）

- 所有内容基于当前代码库真实代码（`fix/bug-fix2` 分支，2026-06-17）
- 教学语言：中文
- 目标读者：Rust 初学者，已懂 TypeScript/JavaScript
- 每节课 ≤ 15 分钟可完成

## Out of scope（不在此次范围）

- Tauri 2 的安装配置、项目脚手架搭建
- Rust 语言基础语法教学
- 前端 Vue/React 组件细节
- Electron vs Tauri 对比
