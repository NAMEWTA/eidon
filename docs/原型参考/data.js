/* ============================================================
   EIDON — 第一步基座示例数据
   严格对应 ADR / PRD：
   - 节点 = 目录，含 .node/node.json；身份 = ULID（路径无关）
   - 三层固定：L1 / L2 / L3；前三层不允许普通文件夹
   - L1/L2 = 纯组织层，仅 README.md + AGENTS.md + 下级节点
   - L3 = 唯一内容承载层，可直接装 md/pdf/图片 + 自由子目录
   - 字段类型仅 6 种：text / textarea / number / date / select / boolean
   - 不含 AI / Tags / 链接 / Todo
   ============================================================ */

// Icons: lucide-react via lucide-icons.mjs (loaded before this file in index.html)

// ─────────────────────────────────────────────
// 模板（Template）= 三层名字 + 各层字段集 + 版本号
// 字段类型仅 6 种基础类型
// ─────────────────────────────────────────────
window.Templates = [
  {
    id: "scholar", name: "科研", builtIn: false, version: 1,
    glyph: "S", color: "oklch(0.55 0.13 30)",
    usedBy: 7,
    levels: [
      { level: 1, name: "研究方向",
        fields: [
          { name: "name",        type: "text",     required: true, desc: "研究方向名（节点目录名）" },
          { name: "描述",         type: "textarea", desc: "方向的人类描述（也可写入 README.md）" },
          { name: "起始日期",      type: "date" },
          { name: "活跃",         type: "boolean",  default: true },
        ]
      },
      { level: 2, name: "课题",
        fields: [
          { name: "name",        type: "text",     required: true, desc: "课题名" },
          { name: "经费",         type: "number",   desc: "总预算（单位：元）" },
          { name: "进度",         type: "select",   options: ["未启动", "进行中", "已暂停", "已完成"], default: "未启动" },
          { name: "目标",         type: "textarea" },
          { name: "开始日期",      type: "date" },
        ]
      },
      { level: 3, name: "资料",
        fields: [
          { name: "name",        type: "text",     required: true, desc: "资料集名" },
          { name: "类别",         type: "select",   options: ["实验", "文献", "笔记", "数据", "其他"], default: "笔记" },
          { name: "重要",         type: "boolean",  default: false },
        ]
      },
    ]
  },
  {
    id: "dev", name: "开发", builtIn: false, version: 1,
    glyph: "D", color: "oklch(0.55 0.10 240)",
    usedBy: 3,
    levels: [
      { level: 1, name: "产品线",
        fields: [
          { name: "name",        type: "text",     required: true },
          { name: "owner",       type: "text",     desc: "负责人（单值文本，不含关系类型）" },
        ]
      },
      { level: 2, name: "特性",
        fields: [
          { name: "name",        type: "text",     required: true },
          { name: "状态",         type: "select",   options: ["规划", "设计中", "实现中", "已发布"], default: "规划" },
          { name: "目标版本",      type: "text" },
        ]
      },
      { level: 3, name: "任务",
        fields: [
          { name: "name",        type: "text",     required: true },
          { name: "估时",         type: "number",   desc: "预计小时" },
          { name: "完成",         type: "boolean",  default: false },
        ]
      },
    ]
  },
  {
    id: "default", name: "默认", builtIn: true, version: 1,
    glyph: "·", color: "oklch(0.55 0.05 80)",
    usedBy: 0,
    levels: [
      { level: 1, name: "档案", fields: [{ name: "name", type: "text", required: true }] },
      { level: 2, name: "项目", fields: [{ name: "name", type: "text", required: true }] },
      { level: 3, name: "资料", fields: [{ name: "name", type: "text", required: true }] },
    ]
  },
];

// ─────────────────────────────────────────────
// 节点树（File Tree）—— 严格 L1/L2/L3，前三层不允许普通文件夹
// type:
//   "node"   = 结构节点（目录 + .node/node.json）
//   "folder" = 普通文件夹（仅可出现在 L3 之下）
//   "file"   = 内容文件（仅可出现在 L3 节点目录或其自由子目录中）
// flags:
//   outOfPlace / orphan / disconnected / clutter / orphanTemplate
// ─────────────────────────────────────────────
window.FileTree = [
  // L1 节点（科研模板）
  { type: "node", level: 1, templateId: "scholar", id: "n-dl",
    name: "深度学习研究", open: true,
    children: [
      // L2 节点
      { type: "node", level: 2, templateId: "scholar", id: "n-fs",
        name: "小样本学习", open: true,
        children: [
          // L3 节点 —— 内容承载层
          { type: "node", level: 3, templateId: "scholar", id: "n-exp",
            name: "实验记录", open: true,
            children: [
              { type: "file", id: "doc-exp1", name: "实验1.md", active: true, modified: true, kind: "md" },
              { type: "file", id: "doc-exp2", name: "实验2.md", kind: "md" },
              { type: "file", id: "doc-fig",  name: "对照图.png", kind: "image" },
              // L3 以下自由子目录（系统不管）
              { type: "folder", name: "原始数据", open: false, children: [
                { type: "file", name: "run_001.csv" },
                { type: "file", name: "run_002.csv" },
              ]},
            ]
          },
          { type: "node", level: 3, templateId: "scholar", id: "n-lit",
            name: "文献", children: [
              { type: "file", id: "doc-survey",  name: "Survey.pdf", kind: "pdf" },
              { type: "file", id: "doc-survey-notes", name: "Survey 笔记.md", kind: "md" },
            ]
          },
          // 杂物归宿 L3
          { type: "node", level: 3, templateId: "scholar", id: "n-other-fs",
            name: "其他", clutterHome: true, children: [] },
        ]
      },
      { type: "node", level: 2, templateId: "scholar", id: "n-ssl",
        name: "自监督学习", children: [] },

      // 杂物：L1 下混入了一个白名单外的文件（PRD §5 标记）
      { type: "file", id: "clutter-1", name: "随手笔记.md", clutter: true },
    ]
  },

  // L1 节点（开发模板）—— 与科研 L1 平级
  { type: "node", level: 1, templateId: "dev", id: "n-eidon",
    name: "EIDON 开发", open: false,
    children: [
      { type: "node", level: 2, templateId: "dev", id: "n-editor",
        name: "编辑器", children: [
          // 越界：一个 scholar 模板的"资料"被挪到 dev 模板的"特性"下
          { type: "node", level: 3, templateId: "scholar", id: "n-strayed",
            name: "误移的实验记录", outOfPlace: true, children: [] },
          { type: "node", level: 3, templateId: "dev", id: "n-task-tier",
            name: "三档降级", children: [
              { type: "file", id: "doc-tier", name: "任务说明.md", kind: "md" },
            ]
          },
        ]
      },
    ]
  },

  // Orphan：原本是 L3 的节点，恢复时父级已不存在，暂处 workspace 根
  { type: "node", level: 3, templateId: "scholar", id: "n-orphan",
    name: "实验记录(恢复)", orphan: true, originalLevel: 3, children: [] },
];

// ─────────────────────────────────────────────
// 当前打开的"文件"= L3 节点目录下的一个 Markdown
// 编辑器仅渲染 plain Markdown；身份 / 字段在该文件所属"节点"上
// （PRD FR-DATA-3：文件用 (nodeId, 相对路径) 寻址，无独立身份）
// ─────────────────────────────────────────────
window.ActiveDoc = {
  id: "doc-exp1",
  // 路径：workspace 根 → L1 → L2 → L3 → 文件
  path: ["深度学习研究 (L1)", "小样本学习 (L2)", "实验记录 (L3)", "实验1.md"],
  // 所属节点（L3 节点）—— 字段面板从这里读
  node: {
    id: "01HZX2A1B9C4D7E5F6G8H0J2K4",
    templateId: "scholar",
    templateName: "科研",
    level: 3,
    type: "资料",
    schemaVersion: 1,
    latestSchemaVersion: 1,
    createdAt: "2026-04-12",
    fields: {
      name:  { type: "text",    value: "实验记录" },
      类别:  { type: "select",  value: "实验", options: ["实验", "文献", "笔记", "数据", "其他"] },
      重要:  { type: "boolean", value: true },
    },
    references: [],
    flags: {},
    orphanTemplate: false,
  },
  fileSize: 12 * 1024,        // 12KB
  editorTier: "fluent",        // fluent / bigFile / readOnly（ADR-013，与计划 T-14.* 命名一致）
  modifiedAt: "2 分钟前",
  createdAt: "2026-04-12",
  wordCount: 1842,
  headingCount: 5,

  // 大纲（纯 Markdown 标题派生）
  outline: [
    { id: "h-title", level: 1, text: "实验 1 · 小样本基线复现", line: 1 },
    { id: "h-setup", level: 2, text: "实验设置", line: 9 },
    { id: "h-data",  level: 3, text: "数据集", line: 13 },
    { id: "h-model", level: 3, text: "模型与超参", line: 20 },
    { id: "h-run",   level: 2, text: "运行结果", line: 30, active: true },
    { id: "h-disc",  level: 2, text: "讨论与后续", line: 48 },
  ],
};

// 纯 Markdown 内容（无 inline structured block，无 schema 绑定 frontmatter）
window.ActiveDoc.lines = (function makeLines() {
  const lines = [];
  const prose = (html) => lines.push({ kind: "prose", html });
  const blank = () => lines.push({ kind: "blank" });
  const heading = (lvl, id, txt) => lines.push({ kind: "prose", id, html: `<h${lvl} id="${id}">${txt}</h${lvl}>` });

  heading(1, "h-title", "实验 1 · 小样本基线复现");
  prose(`<p>复现 Protonet 在 mini-ImageNet 5-way 1-shot 上的结果，作为本课题的基线参考。</p>`);
  blank();
  prose(`<p style="font-family:var(--f-mono); font-size: var(--font-mono); color: var(--ink-3)">— 创建于 <span style="font-family:var(--f-mono)">2026-04-12</span>，上次编辑 <span style="font-family:var(--f-mono)">2 分钟前</span></p>`);
  blank();
  blank();

  heading(2, "h-setup", "实验设置");
  prose(`<p>沿用原论文的预处理流程；唯一调整是把图像裁剪到 <code>84×84</code> 之外加一次 <code>random crop</code> 以稳住小批量梯度。</p>`);
  blank();

  heading(3, "h-data", "数据集");
  prose(`<p>mini-ImageNet 100 类 × 600 张；按 64 / 16 / 20 三段划分训练 / 验证 / 测试。</p>`);
  prose(`<blockquote>原始数据存于本 L3 节点下 <code>原始数据/</code> 自由子目录（系统不赋予身份）。</blockquote>`);
  blank();

  heading(3, "h-model", "模型与超参");
  prose(`<p>4-conv backbone；Adam，<code>lr=1e-3</code>；early stop on val accuracy。</p>`);
  prose(`<p>每个 episode 5 way × 1 shot × 15 query；训练 60k episodes。</p>`);
  blank();
  blank();

  heading(2, "h-run", "运行结果");
  prose(`<p>5 次种子的平均 5-way 1-shot 准确率为 <strong>49.3% ± 0.6%</strong>，与原论文 49.4% 一致。<span class="caret"></span></p>`);
  blank();
  prose(`<p>具体逐次结果：</p>`);
  prose(`<p style="margin-left: 22px">— seed 0 : 48.7</p>`);
  prose(`<p style="margin-left: 22px">— seed 1 : 49.1</p>`);
  prose(`<p style="margin-left: 22px">— seed 2 : 49.5</p>`);
  prose(`<p style="margin-left: 22px">— seed 3 : 49.8</p>`);
  prose(`<p style="margin-left: 22px">— seed 4 : 49.5</p>`);
  blank();
  prose(`<p>对照图见同目录下 <code>对照图.png</code>。</p>`);
  blank();
  blank();

  heading(2, "h-disc", "讨论与后续");
  prose(`<p>基线复现稳定，可以作为后续改进对照。下一步在 <em>文献</em> L3 节点里整理几篇 self-supervised 预训练的 paper，看是否能把 1-shot 提到 55+。</p>`);
  blank();
  prose(`<p>需要给本课题的 <strong>进度</strong> 字段改为"进行中"，并把"经费"扣减 GPU 计费。这些动作在右侧"节点字段"面板完成。</p>`);
  blank();

  return lines;
})();

// ─────────────────────────────────────────────
// 搜索示例（全文 + 结构搜索）
// ─────────────────────────────────────────────
window.SampleSearchHits = {
  "小样本": [
    { file: "深度学习研究/小样本学习/实验记录/实验1.md", line: 1,
      snippet: "实验 1 · <mark>小样本</mark>基线复现" },
    { file: "深度学习研究/小样本学习/实验记录/实验2.md", line: 4,
      snippet: "<mark>小样本</mark>下使用 self-supervised 预训练的对比。" },
    { file: "深度学习研究/小样本学习 [L2 节点字段]", line: null,
      snippet: "节点字段 <mark>name</mark> = \"<mark>小样本</mark>学习\"" },
  ],
  "实验": [
    { file: "深度学习研究/小样本学习/实验记录/实验1.md", line: 9,
      snippet: "## <mark>实验</mark>设置" },
    { file: "深度学习研究/小样本学习/实验记录/实验1.md", line: 30,
      snippet: "## 运行结果（来自 <mark>实验</mark>）" },
    { file: "深度学习研究/小样本学习/实验记录 [L3 节点字段]", line: null,
      snippet: "节点字段 类别 = \"<mark>实验</mark>\"" },
  ],
};

// ─────────────────────────────────────────────
// 历史（版本快照与编辑事件，进入 .eidon/snapshots.git）
// ADR-009：autosave 仅落盘不 commit；commit 仅在稳定点
// ─────────────────────────────────────────────
window.History = [
  { time: "刚刚", kind: "edit", msg: "编辑 §运行结果", meta: "+128 / −12 字符" },
  { time: "14 分钟前", kind: "snap", msg: "稳定点快照（失焦触发）", meta: "v.32 · 自动" },
  { time: "1 小时前", kind: "edit", msg: "新增 §讨论与后续", meta: "+248 字符" },
  { time: "今天 09:42", kind: "snap", msg: "显式创建版本：基线 49.3%", meta: "v.31 · 手动" },
  { time: "昨天", kind: "edit", msg: "重命名节点：实验 → 实验记录", meta: "节点 ID 不变" },
  { time: "周日", kind: "snap", msg: "稳定点快照（切文件前）", meta: "v.30 · 自动" },
];

// ─────────────────────────────────────────────
// 回收站（PRD §8 / ADR-011）
// ─────────────────────────────────────────────
window.TrashItems = [
  {
    deletionId: "del-01HZX-AAA",
    name: "无效实验目录",
    origin: ["深度学习研究", "小样本学习", "实验记录(草稿)"],
    templateName: "科研 · L3 资料",
    deletedAt: "今天 10:21",
    daysLeft: 30,
    restoreNote: null,
  },
  {
    deletionId: "del-01HZX-BBB",
    name: "废弃课题",
    origin: ["深度学习研究", "废弃方向", "未启动课题"],
    templateName: "科研 · L2 课题",
    deletedAt: "昨天",
    daysLeft: 29,
    // 父级已删，恢复时会进 orphan
    restoreNote: "restoreOrphan",
  },
  {
    deletionId: "del-01HZX-CCC",
    name: "重命名旧版",
    origin: ["EIDON 开发", "编辑器", "三档降级"],
    templateName: "开发 · L3 任务",
    deletedAt: "3 天前",
    daysLeft: 27,
    // 原位置已被新版同名占用
    restoreNote: "restoreConflict",
  },
];

// ─────────────────────────────────────────────
// 一致性面板（PRD §9.3 FR-SYNC-3）
// 五类：outOfPlace / clutter / orphan / disconnected / repair
// ─────────────────────────────────────────────
window.ConsistencyItems = {
  outOfPlace: [
    {
      id: "n-strayed",
      name: "误移的实验记录",
      path: ["EIDON 开发", "编辑器"],
      note: "节点模板 = 科研/资料，但当前父级属于 开发/特性。",
      actions: ["接受现状", "转换为 dev/任务", "自行移回"],
    },
  ],
  clutter: [
    {
      id: "clutter-1",
      name: "随手笔记.md",
      path: ["深度学习研究"],
      note: "L1 仅允许 .node/ + README.md + AGENTS.md + 下级节点；此文件位置非法。",
      actions: ["整理到本层「其他」L3", "提升为节点", "保留不动"],
    },
  ],
  orphan: [
    {
      id: "n-orphan",
      name: "实验记录(恢复)",
      path: ["(workspace 根)"],
      note: "声明 level = 3，但原父级缺失。请拖到合法 L2 父级下。",
      actions: ["选择新的 L2 父级…"],
    },
  ],
  disconnected: [
    {
      id: "rt-disc-001",
      name: "（外部删除的某节点）",
      path: ["深度学习研究", "自监督学习", "(已消失)"],
      note: "运行时软态：文件回来自动复活；重建索引或重启即丢失。",
      actions: ["仍标为待回归", "确认清理引用"],
    },
  ],
  repair: [
    {
      id: "rep-001",
      name: "L2「自监督学习」缺失 README.md",
      path: ["深度学习研究", "自监督学习"],
      note: "AX-5 自动补全已生成；如需自定义请编辑。",
      actions: ["打开 README.md"],
    },
  ],
};

// ─────────────────────────────────────────────
// 命令面板项
// ─────────────────────────────────────────────
window.CommandItems = [
  { group: "节点（最近）", items: [
    { icon: "doc",     name: "深度学习研究 / 小样本学习 / 实验记录 / 实验1.md", meta: "2 分钟前" },
    { icon: "doc",     name: "深度学习研究 / 小样本学习 / 文献 / Survey 笔记.md", meta: "昨天" },
    { icon: "doc",     name: "EIDON 开发 / 编辑器 / 三档降级 / 任务说明.md", meta: "周日" },
  ]},
  { group: "命令", items: [
    { icon: "newfile",  name: "新建 L1 节点…（先选模板）",                    kbd: "⌘N" },
    { icon: "schema",   name: "打开模板：科研",                                meta: "" },
    { icon: "schema",   name: "新建模板…",                                     meta: "" },
    { icon: "split",    name: "右侧分屏",                                       kbd: "⌘\\" },
    { icon: "branch",   name: "创建版本快照…",                                  kbd: "⌘S" },
    { icon: "history",  name: "查看版本历史",                                   meta: "" },
    { icon: "warning",  name: "打开一致性面板",                                 meta: "" },
    { icon: "settings", name: "设置：编辑器三档阈值",                            meta: "" },
  ]},
  { group: "当前文件中的标题", items: [
    { icon: "outline", name: "§ 实验设置",      meta: "L9" },
    { icon: "outline", name: "  数据集",         meta: "L13" },
    { icon: "outline", name: "  模型与超参",      meta: "L20" },
    { icon: "outline", name: "§ 运行结果",       meta: "L30" },
    { icon: "outline", name: "§ 讨论与后续",      meta: "L48" },
  ]},
];

// ─────────────────────────────────────────────
// 最近 workspace（设置页用）
// ─────────────────────────────────────────────
window.RecentWorkspaces = [
  { path: "~/EIDON-Workspace",   lastOpened: "现在",   nodes: 32, active: true },
  { path: "~/Documents/research", lastOpened: "昨天",   nodes: 14 },
  { path: "~/Documents/personal", lastOpened: "上周",   nodes: 87 },
];
