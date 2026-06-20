# ADR-0017 · 本期纳入 solomd → EIDON 全面改名 + `.eidon/` 系统区

**状态：** 已完成（由 ADR-0022 扩展并收尾）
**扩展：** [ADR-0022](./0022-complete-solomd-to-eidon-rename-and-migration.md)

因 EIDON 2.0 不背兼容包袱（ADR-0011），改名**本期纳入**：

- **品牌 / 标识：** packageName（`solomd` → `eidon`）、窗口标题、about、i18n 文案统一为 EIDON。仓库已名 `eidon`。
- **系统区目录：** EIDON 数据层系统区 = `.eidon/`（`templates/` + 节点系统 + 运行时索引缓存）。这是节点 / 模板 / 版本 / 一致性的落盘根。
- **旧 `.solomd/`：** 属旧产品遗留，不在 EIDON 范围内（ADR-0018）；不背向后兼容，无需双系统区共存逻辑，本期不读写、不迁移。

> **消歧（CONTEXT.md）：** 「workspace」从「SoloMD 任意扁平文件夹（系统区 `.solomd/`）」语义重定义为「EIDON 受管根（系统区 `.eidon/`）」。

## Consequences

- 改名是机械但面广的改动（packageName / 窗口 / i18n / 文档）；无兼容包袱使其低风险。
- EIDON 数据层一律用 `.eidon/`。
- ADR-0022 将改名推进到全量（含 localStorage 键、事件名、DOM 全局、OS 钥匙串、加密 wire-format），无迁移垫片。

---
> **注：** 实现路径以 ADR-0025（四层架构）与 AGENTS.md §2 / 代码为准。
