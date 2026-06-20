# ADR-0015 · 版本 / diff 直接复用现有 git（autoGit 不改，不做快照功能）

**状态：** 已锁定（对应用户明确指令「autoGit 即可，无需快照实现；利用 git 做 diff 对比即可」；体现 ADR-0011「以现有系统为基底」）
**扩展：** [ADR-0023](./0023-git-history-pruning.md)（审慎打破"不做快照功能"约束，加入 git 历史修剪能力）

EIDON 的版本能力**直接复用现有 git（autoGit），autoGit 无需任何修改，本期不实现任何「快照功能」**：

- **历史 / diff 对比 / 恢复** = 直接用现有 git 的 log / diff / checkout 能力（`backend/capabilities/git/history.ts` + HistoryPanel，基于 isomorphic-git）。够用即止。
- **不新建** `.eidon/snapshots.git` 私有仓库、**不做**保存/快照解耦、**不做**二进制策略、**不做**路径↔ID 历史补偿。这些都属「另造快照系统」，与「以现有系统为基底、复用优先」相悖。
- `backend/domain/snapshots` 仅作为版本能力在后端的 typed 归属（薄封装现有 git bridge），**不新增实现逻辑**。

> **消歧：** 此「autoGit / git 版本」指普通编辑的 auto-commit 历史，与已移出范围的 Agent Recipes 分支沙箱无关（ADR-0018）。

## Consequences

- 零新增快照能力；版本 / 历史 / diff / 恢复语义以现有 iso-git 实现为准。
- 若未来确有「私有快照仓库 / 路径↔ID 补偿」的硬需求，再作为独立决策另立 ADR，不在本期。
- **ADR-0023 审慎打破"不做快照功能"约束**（2026-06）：新增 git 历史修剪能力，仅对 `.git/` 做破坏性压缩（不碰 plain-file 真理源），以控制仓库膨胀。修剪是不可逆操作，默认关闭，须用户显式设上限才触发。

---
> **注：** 实现路径以 ADR-0025（四层架构）与 AGENTS.md §2 / 代码为准。
>
> **注：** 实现路径以 ADR-0025（四层架构）与 AGENTS.md §2 / 代码为准。
