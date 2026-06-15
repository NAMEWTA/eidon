# ADR-0014 · EIDON 磁盘契约统一规范化（纳入 zod + golden fixtures）

**状态：** 已锁定（扩展 ADR-0005 至 EIDON 数据层；对应 decision-log R-3 升格）

EIDON 数据层的全部磁盘契约**统一纳入既有防漂移体系**（ADR-0005 的 `core/contracts/` zod 单一事实源 + `fixtures/contracts/` 跨语言 golden fixtures），不另起炉灶：

| 契约 | 落点 | 角色 |
|---|---|---|
| `.node/node.json` | `core/contracts/node.ts` | 节点身份+元/扩展字段，扫描重建的核心接缝 |
| `.eidon/templates/{id}/L{n}.{name}.v{ver}.json` | `core/contracts/template.ts` | 三层名字+字段集，版本化不可变 |
| `.eidon/` 系统区布局 | 契约/常量集中声明 | 系统区目录形态（见 ADR-0017） |

**统一规范化要点：**
- **改形状先改 zod + fixtures，再改解析。** fixtures 红即代表破坏「删缓存→从 `.node/`+`.eidon/templates/` 100% 重建节点树」的一致性（产品层 AX-1/AX-4）。
- node.json 保留 `references:[]` / `flags:{}` 字段（本期空值、不写业务逻辑），契约层先定形状，为后续迭代（链接、软态体系）零成本衔接。
- 真理源 = plain files（Markdown + JSON）；SQLite / 索引 = 可删可重建的运行时缓存。

## Consequences

- 本期 conformance：`pnpm contracts:check` 覆盖 node/template；提交改契约必跑。
- 后续若引入 trash 等磁盘元数据，同样先进契约再实现（不在本期）。
