# ADR-0001 · Core 运行在 webview，Rust 保留「能力型编排壳」

业务逻辑写在 `core/`（TS），但生产环境**运行在 webview 内**（被 `src/` 直接 import），并非独立进程。凡 webview 给不了的能力——文件系统原子 I/O、目录遍历、OS keychain、git 调用等——**保留在 Rust** 做薄编排壳。因此 `src-tauri/` 有两类合法职责：**原子操作 + 能力型编排**，而非纯「原子操作层」。

EIDON 数据层据此落点：节点扫描建树、`.node/`/`node.json` 读写、template 读写等业务逻辑写在 Core(TS)（可 Node 单测），经现有 `editor/file_ops` 等 Rust 原子命令完成磁盘 I/O。Rust 侧优先零新增，仅在万级文件遍历性能不足时按 ADR-0009 加一个最小 `scan` 原子命令（见 ADR-0012）。
