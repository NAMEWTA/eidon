# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**请先阅读 [`AGENTS.md`](./AGENTS.md)。**

本仓库的所有目录结构、目录规范、目录层级规则、开发规范、扩展约束、分层边界与注意事项，
均以 `AGENTS.md` 为唯一权威来源。开始任何工作前请通读该文件；架构决策的「为什么」见工程层
ADR `speculo/.speculo/.config/adr/`（登记表 `adr/README.md`，`AGENTS.md` §7 有索引）。

本项目为 **EIDON**（由 SoloMD 颠覆性重构 1.x→2.x 而来）。「三层」一词双关，禁裸用：
`三层【代码】`=`src/core/src-tauri`；`三层【节点】`=`L1/L2/L3`（见 `AGENTS.md` §0）。

All directory structure, conventions, layering rules, development practices, and constraints
live in `AGENTS.md` — treat it as the single source of truth. Read it before doing any work here.
