# ADR-0012 · EIDON 数据层落点 = `core/` 四个并列业务模块 + Rust 对称领域

**状态：** 已锁定（对应 decision-log D-5；落实 ADR-0006「新功能域→新业务模块」）

EIDON 数据层按**细模块切分**落在 `core/`，新增**四个**并列业务模块，以可扩展性 + 可读性为首要目标：

```
core/
├── nodes/        # 节点拓扑：ULID 身份(复用 core/shared/id) · node.json 读写
│                 #   · 扫描建树(遍历→识别 .node/→深度=层级→id→path) · 创建/重命名(ID不变)/移动/提升为节点
├── templates/    # 多模板 schema：6 类字段 · 版本化不可变写入 .eidon/templates/{id}/L{n}.{name}.v{ver}.json
│                 #   · 编辑生成新版本 · 删除→孤儿模板态 · 内置种子 · 给设置内的模板管理 UI 供数据
├── snapshots/    # 版本能力的归属：直接复用现有 git(autoGit)，不实现任何快照功能(见 ADR-0015)
│                 #   · 仅薄封装现有 git bridge 暴露 历史/diff/恢复；不新增逻辑、不改 autoGit
└── consistency/  # 结构一致性：扫描检测四类结构违规 + 产出 FileTree 标记(见 ADR-0016)
                  #   · 本期只检测+标记，软态身份系统/自动补全/一致性面板留后续
```

每模块各自 `index.ts` 暴露公共 API、只依赖内核（`bridge`/`contracts`/`shared`）、**禁 import 任何 UI 框架、不互相 import 内部路径**（ADR-0006/0007）。

**为什么四个细模块而非一个大 `core/eidon/`：** 四模块职责边界清晰、低耦合（身份/拓扑、schema、版本、一致性），分开后单测、阅读、未来按需深化都不牵动彼此。这是为可扩展性 + 可读性付的结构税，与单人多领域、长期演进的定位一致。

**复用优先、Rust 侧优先零新增（呼应 ADR-0001/0009/0011）：** `.node/` 读写与目录遍历复用现有 `editor/file_ops`；扫描建树先在 Core(TS) 经现有 file bridge 完成；版本/diff 复用现有 git；删除/搜索复用现有 FileTree 删除 / GlobalSearch。仅当万级文件遍历性能不足，再按 ADR-0009 加一个最小 `scan` 原子命令。

## Consequences

- 四类扩展唯一落点：节点能力进 `nodes`、schema 进 `templates`、版本进 `snapshots`（仅复用）、违规检测进 `consistency`。
- `core/bridge/` 增 node/template/scan 的 typed wrapper；file/git/search wrapper 直接复用（allowlist 维持 0）。
