# ADR-0018 · AI·Agent·Recipes 不在 EIDON 产品范围内

**状态：** 已锁定（对应用户指令「AI·Agent·Recipes 模块暂时移出，后续独立改造」）

EIDON 2.0 的产品范围**不含** AI·Agent·Recipes（AI 对话 / 自动化 Recipes / 联网触发 / RAG / capture / REST / MCP / cloud）。其现有代码作为基底保留在仓库，但 EIDON **不挂载、不依赖、不在本期实现或改动**。

> **2026-06 起由 [ADR-0019](./0019-physically-remove-ai-subsystem-keep-interface-stub.md) 接替**：处置方式升级为物理删除全部 AI 相关能力（页面按钮、设置项、后端逻辑），`core/ai/` 仅留类型接口占位（`index.ts` + `README.md`），为未来接入其他 AI 预留空间。删除清单、保留物、找回路径详见 ADR-0019。

未来若做 AI，是一次**独立重建**（区别于本期产品），届时按需重订其架构，与本期节点 + 模板内核解耦演进。本期数据模型为之零成本预留：node.json 的 `references` 字段、节点内 `AGENTS.md` 占位（不在本期实现）。

## Consequences

- 本期数据层（ADR-0012 四模块）不 import 任何 AI·Agent·Recipes 相关模块；ESLint 边界（ADR-0007）保证不回流。
- 对应 UI 入口（Agent 面板 / Recipes 设置等）本期不挂载。
