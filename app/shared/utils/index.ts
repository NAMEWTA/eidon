// shared/utils —— 框架无关纯函数工具公共出口。
// id/date/errors + （Phase 2 起）路径/日历/提醒时间数学 + 文本解析（frontmatter/wikilink/tag/markdown）。
// 两端共用：零业务规则、零 I/O、零 UI/electron 依赖（shared 叶子约束）。
export * from "./date";
export * from "./errors";
export * from "./id";
export * from "./path";
export * from "./reminders";
