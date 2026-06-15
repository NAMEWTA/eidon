# 学习使命：EIDON 全栈深度研究

## Why
我需要完全理解 EIDON 项目的每一层：从 React UI 到 TypeScript 业务核心到 Rust 系统能力壳，
掌握从前到后的全链路代码逻辑与数据流转化。目标不是「了解项目」，而是「能独立修改任何一层并预判影响」。

## Success（可观测成功标准）
1. 能画出完整的三层【代码】架构图 + 关键数据流图
2. 能手写出任一条用户操作从前端到 Rust 磁盘的完整调用链（至少 5 条核心链路）
3. 能解释 Markdown 渲染管道的每一步（从文件字节到屏幕像素）
4. 能说明 Rust 侧每个模块的职责、命令签名、与 TS 侧的桥接方式
5. 能阐述 EIDON 数据层四模块（nodes/templates/snapshots/consistency）的内部实现细节
6. 能独立完成任一模块的小功能新增或 bug 修复

## Constraints
- 必须通读所有核心源码（不能只看文档）
- 每条链路必须追踪到 Rust 系统调用或 DOM 操作才算到底
- 学习产物：架构图 + 链路图 + 术语表 + 至少 5 篇课程笔记

## Out of scope
- AI·Agent·Recipes 旧子系统（已物理删除，core/ai 仅占位）
- 产品层 ADR 的远期愿景（不实现的部分不做深究）
- UI 细节样式（Tailwind CSS 类名不逐行研究）
