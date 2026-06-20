# 学习使命：EIDON 新人上手

**日期：** 2026-06-20
**状态：** confirmed

## Why

EIDON 项目已完成为期数月的颠覆性重构（SoloMD 1.x→2.x、Tauri/Rust→Electron、三层→四层架构）。当前代码库稳定，架构清晰，但缺乏系统的新人上手文档。新人（开发者/AI 助手）面对 85 条 IPC 通道、四层单向架构、600+ 源文件时容易迷失。

本课程目标是：**让一个刚接触项目的新人，学完 6 节课后能够独立进行功能迭代和代码优化。**

## Success（可观测成功标准）

- [ ] 能画出四层架构图并解释每层职责与单向依赖规则
- [ ] 能在 5 分钟内定位任一功能的代码跨越了哪些文件（从 `shared/ipc/channels.ts` → `backend/capabilities/` → `backend/services/` → `backend/ipc/handlers/` → `bridge/ipc/` → `frontend/`）
- [ ] 能独立新增一个带 IPC 通道的简单功能（如新增一个 `shell:getAppVersion` 通道）
- [ ] 能解释节点三层拓扑（L1/L2/L3）的创建规则和结构强制逻辑
- [ ] 能说出 `pnpm lint` 在机器层面强制了哪些边界

## Constraints（约束）

- 纯文档教学，不涉及代码修改
- 每节课 < 15 分钟可读完
- 使用 HTML 格式，将来可浏览器打开复习
- 引用真实代码路径，确保与实际代码一致

## Out of Scope

- 不教 React/Zustand/CodeMirror 基础（假设已有前端基础）
- 不教 Electron 原理（假设了解 Electron 主进程/渲染进程模型）
- 不涉及产品层 ADR（产品愿景），只涉及工程层 ADR
- 不涉及已删除的 AI·Agent·Recipes 子系统
