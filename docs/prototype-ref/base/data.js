/* ============================================================
   EIDON 基座 v2 — Sample Data & Icons
   严格遵循 ADR-001~013 + 五条公理 + PRD 第一步范围
   不含 AI / Todo / 通知 / 标签 / 双向链接
   ============================================================ */

// ─── SVG 图标库 ──────────────────────────────────────────────
window.EidonIcons = {
  chevRight: `<svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4 L10 8 L6 12"/></svg>`,
  chevDown:  `<svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6 L8 10 L12 6"/></svg>`,
  files:     `<svg viewBox="0 0 16 16" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2 3.5A1.5 1.5 0 0 1 3.5 2H9l3.5 3.5V13a1.5 1.5 0 0 1-1.5 1.5H3.5A1.5 1.5 0 0 1 2 13Z"/><path d="M9 2v3.5H12.5"/></svg>`,
  search:    `<svg viewBox="0 0 16 16" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5 L14 14" stroke-linecap="round"/></svg>`,
  template:  `<svg viewBox="0 0 16 16" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2" y="2" width="12" height="3" rx="0.5"/><rect x="2" y="6.5" width="5.5" height="7.5" rx="0.5"/><rect x="8.5" y="6.5" width="5.5" height="3.5" rx="0.5"/><rect x="8.5" y="11" width="5.5" height="3" rx="0.5"/></svg>`,
  shield:    `<svg viewBox="0 0 16 16" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M8 1.5 L13.5 4V8.5C13.5 11.5 11 13.5 8 14.5 5 13.5 2.5 11.5 2.5 8.5V4Z"/><path d="M6 8.5l1.5 1.5 3-3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  trash:     `<svg viewBox="0 0 16 16" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2.5 4.5h11M5.5 4.5V3a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 .5.5v1.5M4 4.5l.5 9a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5l.5-9"/><path d="M6.5 7v4M9.5 7v4"/></svg>`,
  settings:  `<svg viewBox="0 0 16 16" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="2"/><path d="M8 1.5v1.8M8 12.7v1.8M1.5 8h1.8M12.7 8h1.8M3.7 3.7l1.3 1.3M11 11l1.3 1.3M3.7 12.3l1.3-1.3M11 5l1.3-1.3"/></svg>`,
  outline:   `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 4h10M5 8h8M7 12h6"/></svg>`,
  props:     `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2" y="2.5" width="12" height="11" rx="1"/><path d="M2 6.5h12M5.5 2.5v11"/></svg>`,
  history:   `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2.5 8A5.5 5.5 0 1 0 4 4.5"/><path d="M2 2v3h3"/><path d="M8 5.5V8.5l1.5 1.5"/></svg>`,
  plus:      `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M8 3v10M3 8h10"/></svg>`,
  close:     `<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>`,
  more:      `<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><circle cx="3.5" cy="8" r="1.3"/><circle cx="8" cy="8" r="1.3"/><circle cx="12.5" cy="8" r="1.3"/></svg>`,
  doc:       `<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M3.5 1.5H9L12.5 5V14a.5.5 0 0 1-.5.5H4a.5.5 0 0 1-.5-.5V2a.5.5 0 0 1 .5-.5z"/><path d="M9 1.5V5H12.5"/></svg>`,
  image:     `<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="2" y="3" width="12" height="10" rx="1"/><circle cx="5.5" cy="6.5" r="1.2"/><path d="M2.5 13l3.5-3.5 2.5 2.5 2-2 3 3"/></svg>`,
  pdf:       `<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M3.5 1.5H9L12.5 5V14a.5.5 0 0 1-.5.5H4a.5.5 0 0 1-.5-.5V2a.5.5 0 0 1 .5-.5z"/><path d="M9 1.5V5H12.5"/><text x="8" y="11.5" text-anchor="middle" font-size="4" font-family="sans-serif" fill="currentColor" stroke="none">PDF</text></svg>`,
  warning:   `<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M8 2L14.5 13.5H1.5Z"/><path d="M8 7v3M8 11.5v.5"/></svg>`,
  branch:    `<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="4" cy="4" r="1.5"/><circle cx="4" cy="12" r="1.5"/><circle cx="12" cy="6" r="1.5"/><path d="M4 5.5v5M4 8c3 0 4.5-1.5 6.5-2"/></svg>`,
  restore:   `<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2.5 8A5.5 5.5 0 1 0 4 4.5"/><path d="M2 2v3h3"/></svg>`,
  diff:      `<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="4" cy="4" r="1.8"/><circle cx="12" cy="12" r="1.8"/><path d="M4 5.8V12M12 10.2V4" stroke-dasharray="1.5 1.5"/></svg>`,
  offline:   `<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2 2l12 12"/><path d="M5 8.5A5 5 0 0 1 8.5 8M10.5 7A5.5 5.5 0 0 1 14 5M2 5a5.5 5.5 0 0 1 1.5-1M7.5 11.5A1.5 1.5 0 1 1 10.5 11.5"/></svg>`,
  check:     `<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l3.5 3.5 6.5-7"/></svg>`,
  refresh:   `<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 8A5 5 0 0 1 11.5 4"/><path d="M9.5 4H12V1.5"/><path d="M13 8A5 5 0 0 1 4.5 12"/><path d="M6.5 12H4V14.5"/></svg>`,
  orphan:    `<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="6" r="2.5"/><path d="M3.5 13.5c0-3 2-4.5 4.5-4.5s4.5 1.5 4.5 4.5"/><path d="M12 2l2 2M14 2l-2 2"/></svg>`,
  disconnected: `<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-dasharray="2.5 1.5"><rect x="2.5" y="2.5" width="11" height="11" rx="1"/></svg>`,
  outOfPlace:`<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M8 2L2 8l6 6 6-6z"/><path d="M8 5v6M5.5 8h5"/></svg>`,
  upgrade:   `<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 13V3M3 8l5-5 5 5"/></svg>`,
  split:     `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2" y="3" width="12" height="10" rx="1"/><path d="M8 3v10"/></svg>`,
  preview:   `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M1.5 8C2.5 5 5 3 8 3s5.5 2 6.5 5c-1 3-3.5 5-6.5 5S2.5 11 1.5 8Z"/><circle cx="8" cy="8" r="2"/></svg>`,
  copy:      `<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="5" y="5" width="8" height="10" rx="1"/><path d="M5 4V3a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h1"/></svg>`,
};

// ─── Workspace 元状态 ──────────────────────────────────────
window.WorkspaceMeta = {
  path: "~/EIDON-Workspace",
  name: "EIDON-Workspace",
  initialized: true,
  branch: "main",
  online: false,
  largeFileThresholds: { fluent: 2, bigFile: 10 },
  autoOrganize: false,
  filesIndexed: 142,
  nodesCount: 11,
  lastScannedAt: "刚刚",
  diskWritesQueued: 0,
  // 5 类异常：outOfPlace / clutter / orphan / disconnected（运行时软态，不持久化）/ repair
  consistencyIssues: { outOfPlace: 1, clutter: 1, orphan: 1, disconnected: 0, repair: 1 },
};

// ─── 模板定义（三层名+字段集，版本化不可变）─────────────────
window.TEMPLATES = [
  {
    id: "scholar",
    name: "科研",
    glyph: "研",
    color: "oklch(0.68 0.14 35)",
    colorDim: "oklch(0.30 0.06 35)",
    builtin: false,
    desc: "研究方向 → 课题 → 资料。适合跟踪多个研究领域。",
    createdAt: "2024-09-14",
    currentVersionByLevel: { 1: 1, 2: 2, 3: 1 },
    // 节点数量（用于"编辑模板"提示）
    nodeCountByVersion: { 2: { 1: 1, 2: 2 } },
    versions: {
      1: {
        1: { levelName: "研究方向", fields: [
          { key: "领域", type: "select", required: true, options: ["AI/ML", "HCI", "系统", "理论", "交叉"] },
          { key: "立项年", type: "number" },
          { key: "活跃", type: "boolean", default: true },
          { key: "目标", type: "textarea" },
        ]},
        2: { levelName: "课题", fields: [
          { key: "经费（万）", type: "number" },
          { key: "进度", type: "select", options: ["筹备", "进行中", "暂停", "已结题"], default: "进行中" },
          { key: "起止", type: "date" },
          { key: "摘要", type: "textarea" },
        ]},
        3: { levelName: "资料", fields: [
          { key: "类型", type: "select", options: ["实验", "笔记", "论文", "数据集", "其他"] },
          { key: "重要", type: "boolean" },
          { key: "备注", type: "text" },
        ]},
      },
      2: {
        2: { levelName: "课题", fields: [
          { key: "经费（万）", type: "number" },
          { key: "进度", type: "select", options: ["筹备", "进行中", "暂停", "已结题"], default: "进行中" },
          { key: "起止", type: "date" },
          { key: "合作单位", type: "text" },
          { key: "摘要", type: "textarea" },
        ]},
      },
    },
  },
  {
    id: "dev",
    name: "开发",
    glyph: "开",
    color: "oklch(0.62 0.12 235)",
    colorDim: "oklch(0.27 0.06 235)",
    builtin: false,
    desc: "产品线 → 特性 → 任务。适合工程产品跟踪。",
    createdAt: "2024-11-02",
    currentVersionByLevel: { 1: 1, 2: 1, 3: 1 },
    nodeCountByVersion: {},
    versions: {
      1: {
        1: { levelName: "产品线", fields: [
          { key: "代号", type: "text" },
          { key: "对外发布", type: "boolean" },
          { key: "上线日期", type: "date" },
        ]},
        2: { levelName: "特性", fields: [
          { key: "状态", type: "select", options: ["计划", "开发中", "灰度", "已上线", "下架"], default: "计划" },
          { key: "工时（天）", type: "number" },
          { key: "优先级", type: "select", options: ["P0", "P1", "P2", "P3"] },
          { key: "摘要", type: "textarea" },
        ]},
        3: { levelName: "任务", fields: [
          { key: "负责人", type: "text" },
          { key: "截止日期", type: "date" },
          { key: "已完成", type: "boolean" },
          { key: "备注", type: "text" },
        ]},
      },
    },
  },
  {
    id: "default",
    name: "默认",
    glyph: "默",
    color: "oklch(0.58 0.04 80)",
    colorDim: "oklch(0.26 0.02 80)",
    builtin: true,
    desc: "档案 → 项目 → 资料。首次初始化的内置模板，可编辑可删除。",
    createdAt: "2024-09-14",
    currentVersionByLevel: { 1: 1, 2: 1, 3: 1 },
    nodeCountByVersion: {},
    versions: {
      1: {
        1: { levelName: "档案", fields: [
          { key: "主题", type: "text" },
          { key: "建档日期", type: "date" },
          { key: "说明", type: "textarea" },
        ]},
        2: { levelName: "项目", fields: [
          { key: "状态", type: "select", options: ["进行中", "已完成", "已归档"] },
          { key: "描述", type: "textarea" },
        ]},
        3: { levelName: "资料", fields: [
          { key: "类型", type: "text" },
          { key: "重要", type: "boolean" },
        ]},
      },
    },
  },
];

// ─── 节点树 ───────────────────────────────────────────────
// flags: { outOfPlace, orphan, orphanTemplate }  clutterFiles: [{name,type}]（前三层白名单外杂物示例）
window.NODES = [
  // ── L1: 深度学习研究 (scholar) ──
  { id: "n-dlr", level: 1, templateId: "scholar", schemaVersion: 1, parentId: null,
    name: "深度学习研究", createdAt: "2024-09-14",
    readme: "## 深度学习研究\n\n聚焦**小样本学习**与**多模态对齐**两个方向，关注从有限标注中提取鲁棒表征的归纳框架。\n\n### 当前重点\n1. 对比学习在低资源场景下的稳定性\n2. 视觉-语言对齐的跨域泛化\n3. Prompt 设计对 meta-learning 的影响",
    fields: { "领域": "AI/ML", "立项年": 2023, "活跃": true, "目标": "找到一个能在跨域场景稳定迁移的小样本框架，并在3个公开 benchmark 上刷新 SOTA。" },
    flags: {},
    clutterFiles: [{ name: "论文草稿_v2.pdf", type: "pdf", size: "1.2MB" }],
  },

  // ── L2: 小样本学习 (scholar, schema v1 —— 旧版!) ──
  { id: "n-fsl", level: 2, templateId: "scholar", schemaVersion: 1, parentId: "n-dlr",
    name: "小样本学习", createdAt: "2024-09-20",
    readme: "## 小样本学习\n\n围绕 **Prototypical Networks** 与 **MAML** 的实验跟踪。重点探索 prompt-based meta-learning 在 NLP 低资源场景的适用性。",
    fields: { "经费（万）": 50, "进度": "进行中", "起止": "2025-03", "摘要": "探索小样本设置下 Prompt-based Meta-learning 的稳定性，收集实验数据并发表期刊论文一篇。" },
    flags: {},
    clutterFiles: [],
  },

  // ── L3: 实验记录 (scholar) ──
  { id: "n-exp", level: 3, templateId: "scholar", schemaVersion: 1, parentId: "n-fsl",
    name: "实验记录", createdAt: "2024-10-01",
    readme: "存放所有 Prototypical Networks 相关的实验运行记录和分析。",
    fields: { "类型": "实验", "重要": true, "备注": "主实验集，所有结果需在这里留档" },
    flags: {},
    clutterFiles: [],
  },

  // ── L3: 文献综述 (scholar) — 大文件示例 ──
  { id: "n-lit", level: 3, templateId: "scholar", schemaVersion: 1, parentId: "n-fsl",
    name: "文献综述", createdAt: "2024-11-10",
    readme: "2024年小样本学习相关文献综述与批注。",
    fields: { "类型": "论文", "重要": true, "备注": "综述文件较大，仅基础编辑模式" },
    flags: {},
    clutterFiles: [],
  },

  // ── L2: 多模态对齐 (scholar, schema v2 —— 最新版) ──
  { id: "n-mma", level: 2, templateId: "scholar", schemaVersion: 2, parentId: "n-dlr",
    name: "多模态对齐", createdAt: "2025-01-08",
    readme: "## 多模态对齐\n\n研究视觉-语言预训练模型在小样本跨域场景的对齐机制，重点关注 CLIP 系列模型的表征可迁移性。",
    fields: { "经费（万）": 80, "进度": "进行中", "起止": "2025-06", "合作单位": "清华计算机系", "摘要": "研究 CLIP 等多模态预训练模型在跨域小样本场景的对齐质量与泛化能力。" },
    flags: {},
    clutterFiles: [],
  },

  // ── L3: 调研笔记 (scholar) ──
  { id: "n-survey", level: 3, templateId: "scholar", schemaVersion: 1, parentId: "n-mma",
    name: "调研笔记", createdAt: "2025-01-15",
    readme: "多模态对齐领域的调研笔记，持续更新。",
    fields: { "类型": "笔记", "重要": false, "备注": "" },
    flags: {},
    clutterFiles: [],
  },

  // ── L1: EIDON开发 (dev) ──
  { id: "n-eid", level: 1, templateId: "dev", schemaVersion: 1, parentId: null,
    name: "EIDON开发", createdAt: "2024-11-02",
    readme: "## EIDON 开发产品线\n\nEIDON 本地知识工作台的完整工程跟踪。当前处于**第一步基座**阶段（三层结构 + 模板 + 编辑器 + 版本快照）。",
    fields: { "代号": "EIDON-v1", "对外发布": false, "上线日期": "2026-09-01" },
    flags: {},
    clutterFiles: [],
  },

  // ── L2: 编辑器核心 (dev) ──
  { id: "n-core", level: 2, templateId: "dev", schemaVersion: 1, parentId: "n-eid",
    name: "编辑器核心", createdAt: "2024-11-15",
    readme: "Markdown 编辑器的核心模块，含解析、渲染、大文件降级策略。",
    fields: { "状态": "开发中", "工时（天）": 14, "优先级": "P0", "摘要": "实现三档降级编辑器：≤2MB 全功能 / 2~10MB 基础 / >10MB 只读。" },
    flags: {},
    clutterFiles: [],
  },

  // ── L3: Markdown解析 (dev) ──
  { id: "n-mdp", level: 3, templateId: "dev", schemaVersion: 1, parentId: "n-core",
    name: "Markdown解析", createdAt: "2024-11-20",
    readme: "解析器选型与实现，含 CodeMirror 6 集成方案。",
    fields: { "负责人": "林", "截止日期": "2025-02-28", "已完成": false, "备注": "优先完成基础解析，高亮后补" },
    flags: {},
    clutterFiles: [],
  },

  // ── L2: 实验调研 ← ⚠ 越界节点！scholar课题被移入dev产品线 ──
  { id: "n-oop", level: 2, templateId: "scholar", schemaVersion: 1, parentId: "n-eid",
    name: "实验调研", createdAt: "2024-12-10",
    readme: "从「深度学习研究」移过来的调研课题，记录 EIDON 实验设计中参考的 HCI 研究资料。",
    fields: { "经费（万）": 0, "进度": "进行中", "起止": "2025-01", "摘要": "EIDON 原型测试与用户调研参考资料整理" },
    flags: { outOfPlace: true },
    clutterFiles: [],
  },

  // ── L3: 调研报告 (scholar, under n-oop) ──
  { id: "n-oopchild", level: 3, templateId: "scholar", schemaVersion: 1, parentId: "n-oop",
    name: "用户访谈", createdAt: "2024-12-15",
    readme: "用户访谈记录与分析。",
    fields: { "类型": "笔记", "重要": true, "备注": "7人访谈，2026年1月完成" },
    flags: {},
    clutterFiles: [],
  },

  // ── 孤儿节点：原本是 L3，父节点已删，恢复到了根 ──
  { id: "n-orphan", level: 3, templateId: "scholar", schemaVersion: 1, parentId: null,
    name: "知识整理方法论", createdAt: "2024-10-08",
    readme: "关于知识整理方法论的笔记，原父节点已被删除后恢复到工作区根。",
    fields: { "类型": "笔记", "重要": false, "备注": "待归位" },
    flags: { orphan: true, originalLevel: 3, originalParentId: "n-deleted-research" },
    clutterFiles: [],
  },
];

// ─── 节点内文件 ──────────────────────────────────────────
window.NODE_FILES = {
  "n-exp": [
    { id: "f-exp1", name: "实验1_ProtoNet.md",  type: "md",    sizeKB: 6.2,  sizeMode: "fluent" },
    { id: "f-exp2", name: "实验2_MAML.md",      type: "md",    sizeKB: 9.1,  sizeMode: "fluent" },
    { id: "f-img1", name: "accuracy_curve.png", type: "image", sizeKB: 124,  sizeMode: "fluent" },
  ],
  "n-lit": [
    { id: "f-lit1", name: "文献综述_v3.md",  type: "md", sizeKB: 2355, sizeMB: 2.3, sizeMode: "bigFile" },
  ],
  "n-survey": [
    { id: "f-survey1", name: "多模态调研.md", type: "md", sizeKB: 24.3, sizeMode: "fluent" },
  ],
  "n-mdp": [
    { id: "f-mdp1", name: "编辑器设计文档.md", type: "md", sizeKB: 11.4, sizeMode: "fluent" },
    { id: "f-mdp2", name: "测试用例.md",        type: "md", sizeKB: 3.8,  sizeMode: "fluent" },
  ],
  "n-oopchild": [
    { id: "f-oop1", name: "用户访谈记录.md", type: "md", sizeKB: 7.2, sizeMode: "fluent" },
  ],
  "n-orphan": [
    { id: "f-orphan1", name: "方法论笔记.md", type: "md", sizeKB: 8.5, sizeMode: "fluent" },
  ],
};

// ─── 文件内容（Markdown 示例）───────────────────────────
window.FILE_CONTENTS = {
  "f-exp1": `# 实验1 — Prototypical Networks 基线测试

**日期：** 2024-10-12 ｜ **运行环境：** NVIDIA A100 × 4

## 实验设置

- **数据集：** miniImageNet (64/16/20 split)
- **Episode 配置：** 5-way 1-shot / 5-way 5-shot
- **Backbone：** ResNet-12
- **训练轮次：** 60,000 episodes

## 结果汇总

| 配置 | Acc (5-way 1-shot) | Acc (5-way 5-shot) |
|------|-------------------|-------------------|
| 基线 (ResNet-12) | 60.37 ± 0.83 | 78.02 ± 0.57 |
| + 数据增强 | 62.11 ± 0.79 | 79.84 ± 0.52 |
| + 温度调参 τ=0.05 | **64.18 ± 0.76** | **81.56 ± 0.49** |

## 结论

温度参数 τ 对原型距离计算的影响显著（+3.8% on 1-shot）。建议后续实验统一使用 τ=0.05。

## 下一步

- [ ] 在 tieredImageNet 上重跑同一组超参数
- [ ] 引入 cross-attention 进行特征对齐
- 对比 SimpleShot 与 ProtoNet 在同等设置下的差距

> **备注：** 这份实验使用的是未做 augmentation 的原始 split，数值与 paper 对齐。`,

  "f-exp2": `# 实验2 — MAML 对比测试

**日期：** 2024-10-25 ｜ **状态：** 进行中

## 目的

将 MAML（Model-Agnostic Meta-Learning）与实验1的 ProtoNet 基线做公平对比，控制 Backbone 和数据集一致。

## 已知挑战

MAML 的二阶梯度在 ResNet-12 上内存消耗极大，需切换到 first-order MAML (FOMAML)。

## 初步结果（未完成）

| 配置 | Acc (5-way 1-shot) |
|------|-------------------|
| FOMAML + ResNet-12 | 57.2 ± 1.1 |
| ProtoNet + ResNet-12 | 60.37 ± 0.83 |

## 当前状态

训练尚未收敛，epoch 50/100，预计 2024-11-01 完成全部 runs。`,

  "f-survey1": `# 多模态对齐调研笔记

**更新：** 2025-01-20

## 核心问题

如何在小样本设置下使视觉和语言表征在语义空间中更鲁棒地对齐？

## 关键论文

### CLIP (Radford et al., 2021)
对比学习框架，在 4 亿图文对上训练。zero-shot 表现惊人，但 few-shot adaptation 有提升空间。

### WiSE-FT (Wortsman et al., 2022)
Fine-tuning CLIP 时用 weight space ensemble 保留 zero-shot 能力。在 distribution shift 下表现稳健。

### CALIP (Guo et al., 2022)
通过 attention 机制在 CLIP 特征上做 calibration，无需额外训练参数。

## 初步结论

CLIP 的 text encoder 提供了很强的语义锚点，few-shot adaptation 的关键可能在于如何在不破坏原有对齐的前提下引入任务特定信息。`,

  "f-mdp1": `# 编辑器设计文档

**版本：** v0.3 ｜ **作者：** 林 ｜ **日期：** 2024-12-01

## 架构概述

基于 **CodeMirror 6** 构建，分三档降级：

| 档位 | 大小 | 能力 |
|------|------|------|
| 流畅档 | ≤ 2MB | 全功能：实时预览 + 搜索替换 + 高亮 + 快照 |
| 大文件档 | 2~10MB | 基础编辑，关闭实时预览，提示当前模式 |
| 只读档 | > 10MB | 虚拟化只读，引导外部编辑器 |

## 关键决策

### 为什么不支持 100MB 编辑？
100MB 纯文本 ≈ 5000 万字，任何前端编辑器在不做虚拟化的情况下都会假死。
笔记场景单文件极少超几百 KB；超过 10MB 的更可能是误导入的二进制文件。

**承诺：** "≥100MB 文件可只读预览不崩溃" 比 "声称支持 100MB 编辑但实际卡死" 诚实得多。

## 自动保存策略

- **高频写文件（防丢）：** 每 5 秒 / 失焦 / 切标签前 / 退出前 → 仅落盘，不 commit
- **快照（版本）：** 失焦 / 切标签前 / 定时有变 / 显式触发 → commit 到 \`.eidon/snapshots.git\``,

  "f-orphan1": `# 知识整理方法论笔记

> ⚠️ **此节点为孤儿节点** — 原父节点已删除，当前暂存于工作区根。请将其拖至合适的父节点归位。

## 核心框架：COD 方法

- **C**apture（捕获）：记录所有原始想法，不加评判
- **O**rganize（组织）：按主题分类，建立关联
- **D**istill（提炼）：提取核心洞见，形成可复用知识

## 对 EIDON 的启示

三层结构（L1/L2/L3）天然契合 COD 中的 Organize 阶段：
- L1 = 大方向/领域（Capture 的收纳桶）
- L2 = 课题/项目（主题分类）
- L3 = 具体资料（最小知识单元）`,
};

// ─── 版本快照（for f-exp1）────────────────────────────────
window.SNAPSHOTS = [
  { id: "snap-1", fileId: "f-exp1", nodeId: "n-exp",
    shortHash: "a3f89c", message: "初稿：实验设置与结果汇总",
    trigger: "手动保存", author: "林", timestamp: "3天前 14:22",
    linesAdded: 42, linesRemoved: 0 },
  { id: "snap-2", fileId: "f-exp1", nodeId: "n-exp",
    shortHash: "b12d4e", message: "修改结论，补充温度参数分析",
    trigger: "切换标签", author: "林", timestamp: "2天前 09:47",
    linesAdded: 8, linesRemoved: 3 },
  { id: "snap-3", fileId: "f-exp1", nodeId: "n-exp",
    shortHash: "c9a03f", message: "添加下一步计划与备注",
    trigger: "失焦快照", author: "自动", timestamp: "昨天 16:33",
    linesAdded: 5, linesRemoved: 1 },
  { id: "snap-4", fileId: "f-exp1", nodeId: "n-exp",
    shortHash: "d7e521", message: "更新实验结果表格（温度调参）",
    trigger: "失焦快照", author: "自动", timestamp: "今天 11:05",
    linesAdded: 3, linesRemoved: 2 },
];

// 示例 diff（snap-2 vs snap-3）
window.SAMPLE_DIFF = `@@ -34,7 +34,12 @@

 ## 结论

-温度参数 τ 对原型距离计算有影响。
+温度参数 τ 对原型距离计算的影响显著（+3.8% on 1-shot）。
+建议后续实验统一使用 τ=0.05。

 ## 下一步

-待补充。
+- [ ] 在 tieredImageNet 上重跑同一组超参数
+- [ ] 引入 cross-attention 进行特征对齐
+- 对比 SimpleShot 与 ProtoNet 在同等设置下的差距
+
+> **备注：** 这份实验使用的是未做 augmentation 的原始 split。`;

// ─── 回收站 ──────────────────────────────────────────────
window.TRASH_ITEMS = [
  { deletionId: "del-1", nodeId: "n-trash-1",
    nodeName: "实验3_消融研究", templateId: "scholar", level: 3,
    schemaVersion: 1, originalParentId: "n-exp", originalPath: "深度学习研究/小样本学习/实验记录/实验3_消融研究",
    deletedAt: "2天前", daysLeft: 28,
    fields: { "类型": "实验", "重要": false, "备注": "消融实验，待分析" },
    hasConflict: false, parentExists: true },
  { deletionId: "del-2", nodeId: "n-trash-2",
    nodeName: "废弃UI设计规范", templateId: "dev", level: 2,
    schemaVersion: 1, originalParentId: "n-eid", originalPath: "EIDON开发/废弃UI设计规范",
    deletedAt: "5天前", daysLeft: 25,
    fields: { "状态": "下架", "工时（天）": 3, "优先级": "P3", "摘要": "旧版 UI 设计，已废弃" },
    hasConflict: true, parentExists: true, conflictName: "UI设计规范" },
  { deletionId: "del-3", nodeId: "n-trash-3",
    nodeName: "跨域泛化探索", templateId: "scholar", level: 2,
    schemaVersion: 1, originalParentId: "n-deleted-parent", originalPath: "数据增强研究/跨域泛化探索",
    deletedAt: "12天前", daysLeft: 18,
    fields: { "经费（万）": 0, "进度": "暂停", "起止": "2024-06", "摘要": "探索数据增强对跨域泛化的影响" },
    hasConflict: false, parentExists: false, orphanOnRestore: true },
];

// ─── 搜索结果示例 ──────────────────────────────────────
window.SEARCH_RESULTS = [
  { nodeId: "n-exp", fileId: "f-exp1", fileName: "实验1_ProtoNet.md",
    match: "温度参数 τ 对原型距离计算的影响显著（+3.8% on 1-shot）",
    line: 19, nodePath: ["深度学习研究", "小样本学习", "实验记录"] },
  { nodeId: "n-survey", fileId: "f-survey1", fileName: "多模态调研.md",
    match: "CLIP 的 text encoder 提供了很强的语义锚点",
    line: 28, nodePath: ["深度学习研究", "多模态对齐", "调研笔记"] },
  { nodeId: "n-mdp", fileId: "f-mdp1", fileName: "编辑器设计文档.md",
    match: "分三档降级：流畅档 / 大文件档 / 只读档",
    line: 7, nodePath: ["EIDON开发", "编辑器核心", "Markdown解析"] },
];

// ─── 辅助函数 ─────────────────────────────────────────────
window.getTemplate = (id) => window.TEMPLATES.find(t => t.id === id);

window.getSchema = (templateId, level, version) => {
  const tpl = window.getTemplate(templateId);
  if (!tpl) return null;
  const verSet = tpl.versions[version] || tpl.versions[1];
  return verSet?.[level] || null;
};

window.getTemplateCurrentSchema = (templateId, level) => {
  const tpl = window.getTemplate(templateId);
  if (!tpl) return null;
  const v = tpl.currentVersionByLevel?.[level] || 1;
  return { schema: window.getSchema(templateId, level, v), version: v };
};

window.getNodeChildren = (parentId) =>
  window.NODES.filter(n => n.parentId === parentId);

window.getRootNodes = () =>
  window.NODES.filter(n => n.parentId === null);

window.getNodeFiles = (nodeId) =>
  window.NODE_FILES[nodeId] || [];

window.getNode = (id) => window.NODES.find(n => n.id === id);

window.getNodePath = (id) => {
  const path = [];
  let current = window.getNode(id);
  while (current) {
    path.unshift(current);
    current = current.parentId ? window.getNode(current.parentId) : null;
  }
  return path;
};

window.isSchemaOutdated = (node) => {
  const tpl = window.getTemplate(node.templateId);
  if (!tpl) return false;
  const currentV = tpl.currentVersionByLevel?.[node.level] || 1;
  return node.schemaVersion < currentV;
};

window.getFileIcon = (type) => {
  const icons = { md: EidonIcons.doc, image: EidonIcons.image, pdf: EidonIcons.pdf };
  return icons[type] || EidonIcons.doc;
};

window.formatSize = (kb) => {
  if (kb >= 1024) return (kb / 1024).toFixed(1) + " MB";
  return kb.toFixed(0) + " KB";
};
