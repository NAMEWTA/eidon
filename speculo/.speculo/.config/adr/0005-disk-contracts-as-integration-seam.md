# ADR-0005 · 完整重构，磁盘契约为集成接缝

EIDON 是完整重构，**不背任何旧数据迁移 / 向后兼容**包袱（呼应 ADR-0011）。磁盘上跨消费方共享的结构用**契约 + 共享 golden fixtures** 防漂移：契约以 `app/shared/contracts/*.ts`（zod）为单一事实源，`fixtures/contracts/` 提供 golden 样本，测试加载 golden fixtures 做 conformance。

EIDON 数据层的全部磁盘契约（`.node/node.json`、`.eidon/templates/*` template schema、`.eidon/` 系统区布局）统一纳入此机制（详见 ADR-0014）。node.json / template 是「删缓存 → 从文件 100% 重建节点树」的核心接缝，最需防漂移。

## Consequences

改契约先改 zod + fixtures，fixtures 红了即代表破坏跨消费方一致性、或破坏扫描重建一致性（AX-1/AX-4）。

---
> **注：** 实现路径以 ADR-0025（四层架构）与 AGENTS.md §2 / 代码为准。
