# ADR-0009 · src-tauri 领域文件夹 + 扁平模块（#[path]）

`src-tauri/src/` 的特性文件按领域归入文件夹（与 `core/` 业务模块对称），但模块仍以 `#[path="<folder>/X.rs"]` 声明在 **crate 根做同级**——扁平模块树，文件夹只是磁盘分组、**无 `mod.rs`**。换来 `app_lib::<mod>::*` 公共路径、`super::` 交叉引用、`android` cfg 全部 1:1 不变。

EIDON 数据层 Rust 侧优先零新增（复用现有 `editor/file_ops` 做 `.node/` 读写与遍历）；仅当万级文件遍历性能不足，才按本规则建一个最小领域文件夹放 `scan` 原子命令（见 ADR-0012）。

## Consequences

`tests/` / `examples/` 保持扁平（Cargo 只从直属文件发现 target）；资源目录留原位。新功能域：建领域文件夹 + 在 `lib.rs` / `runner.rs` 各加一行 `#[path]`。
