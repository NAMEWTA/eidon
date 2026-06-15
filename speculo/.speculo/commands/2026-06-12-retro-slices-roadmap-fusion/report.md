# Speculo Retro Report

## 复盘范围
本次复盘覆盖 `speculo/workflows/dev/` 下的 **I-to-issues** 工作流及其产物 `slices.md`，与 `03-tdd` 工作流中引用 `roadmap.md` 的交叉问题。复盘触发原因：`I-to-issues` 产出的 `slices.md` 过于单薄（仅 4 个 TODO 段），而 `speculo/.speculo/dev/eidon-base-roadmap/roadmap.md` 展示了成熟的信息密度（scope / architecture / phases / cross-cutting / dependency 五段结构 + XML phase 状态标记）。两者的职责重叠但格式不统一，导致 `03-tdd` 等其他工作流需要同时引用 `slices.md` 和 `roadmap.md` 两个不统一的文档。

时间范围：2026-06-12 单次会话，基于当前仓库状态。

## 信号来源
- `speculo/workflows/dev/I-to-issues/issues-slices.md` — 原规范仅 4 个 TODO 段，无 scope/architecture/cross-cutting/dependency
- `speculo/workflows/dev/_templates/issues-slices-template.md` — 对应模板同样单薄
- `speculo/workflows/dev/03-tdd/03-tdd.md` — 多处引用 `roadmap.md` 作为阶段状态源
- `speculo/workflows/dev/03-tdd/tdd-finish.md` — 引用 `roadmap.md`
- `speculo/workflows/dev/03-tdd/tdd-plan.md` — 引用 `roadmap.md`
- `speculo/workflows/dev/04-finalize/04-finalize.md` — 引用 `roadmap.md`
- `speculo/workflows/dev/04-finalize/completion-gate.md` — 引用 `roadmap.md`
- `speculo/workflows/dev/_templates/tdd-plan-template.md` — 引用 `roadmap.md`
- `speculo/.speculo/dev/eidon-base-roadmap/roadmap.md` — 成熟参考，展示五段结构 + XML phase 标记

## 改进提案

### 提案 1 · slices.md 信息密度不足，需融合 roadmap.md 的五段结构
- **标题：** `enhancement: slices.md 融合 roadmap 五段结构，统一为变更阶段单一事实源`
- **类型：** `enhancement`
- **优先级：** `priority:high`
- **根因：** `I-to-issues` 工作流产出的 `slices.md` 只有来源、切片列表、依赖顺序、用户确认、发布记录五个薄段，缺乏 roadmap.md 的 scope/architecture/cross-cutting/dependency 信息密度。两个文档职责重叠但格式不统一，导致 `03-tdd` 等下游工作流需要引用两个不同文档。
- **建议改动：**
  1. 重写 `speculo/workflows/dev/I-to-issues/issues-slices.md`，新增五段格式规范（§0 一句话战略、§1 IN/REUSE/OUT、§2 架构上下文、§3 切片含 XML phase 标记、§4 横切关注点、§5 依赖顺序速查）
  2. 重写 `speculo/workflows/dev/_templates/issues-slices-template.md`，对齐五段结构
  3. 将 `speculo/workflows/dev/` 内所有 `roadmap.md` 引用替换为 `slices.md`，包括 `03-tdd/03-tdd.md`、`03-tdd/tdd-finish.md`、`03-tdd/tdd-plan.md`、`04-finalize/04-finalize.md`、`04-finalize/completion-gate.md`、`_templates/tdd-plan-template.md`
- **验收标准：**
  - `issues-slices.md` 包含五段格式规范，每段有明确的填写引导
  - `issues-slices-template.md` 模板骨架完整覆盖五段
  - `grep "roadmap\.md" speculo/workflows/dev/` 仅在 meta-commentary 中出现（描述融合来源），无 actionable 引用
  - 新 `slices.md` 可独立作为变更阶段单一事实源，下游工作流无需再引用 `roadmap.md`
- **受影响资产：**
  - `speculo/workflows/dev/I-to-issues/issues-slices.md`
  - `speculo/workflows/dev/_templates/issues-slices-template.md`
  - `speculo/workflows/dev/03-tdd/03-tdd.md`
  - `speculo/workflows/dev/03-tdd/tdd-finish.md`
  - `speculo/workflows/dev/03-tdd/tdd-plan.md`
  - `speculo/workflows/dev/04-finalize/04-finalize.md`
  - `speculo/workflows/dev/04-finalize/completion-gate.md`
  - `speculo/workflows/dev/_templates/tdd-plan-template.md`
- **去重结论：** 新提案，仓库内无同类 issue

## 丢弃与降级项
无。本次复盘范围单一、聚焦明确，所有信号都归一到提案 1。

## 目标仓库
`NAMEWTA/Speculo`（默认框架反馈上游）

## 用户确认记录
用户确认：同意向 `NAMEWTA/Speculo` 提交 1 个 enhancement issue，无修改意见。

## 提交结果
| # | 标题 | Issue | 状态 |
|---|------|-------|------|
| 1 | `enhancement: slices.md 融合 roadmap 五段结构，统一为变更阶段单一事实源` | [#5](https://github.com/NAMEWTA/Speculo/issues/5) | ✅ 已创建 |

> 备注：仓库现有标签无 `priority:*` 系列，已用 `enhancement,documentation` 标签创建。如需优先级体系，可后续向仓库贡献标签。
