/**
 * shared/utils/path —— workspace 相对路径数学 + 日历/收件箱固定路径（纯函数，无 I/O）。
 * 两端共用：backend/domain 写盘用；frontend（CalendarPanel/useDailyNotes/stores）同步运算用。
 */

/** 归一化为 POSIX 相对路径（反斜杠转斜杠、去空段）。根目录为空串。 */
export const normalizePath = (path: string): string =>
  path.replace(/\\/g, "/").split("/").filter(Boolean).join("/");

export const splitPath = (path: string): string[] =>
  normalizePath(path).split("/").filter(Boolean);

export const pathDepth = (path: string): number => splitPath(path).length;

export const joinPath = (base: string, name: string): string =>
  base ? `${base}/${name}` : name;

export const parentPathOf = (path: string): string => {
  const parts = splitPath(path);
  parts.pop();
  return parts.join("/");
};

export const basenameOf = (path: string): string => {
  const parts = splitPath(path);
  return parts[parts.length - 1] ?? "";
};

const pad2 = (n: number): string => (n < 10 ? `0${n}` : String(n));

/** 默认物理收件箱：L1 `_整理箱` → L2 `未分类` → L3 `收件箱`。 */
export const DEFAULT_INBOX_SEGMENTS = ["_整理箱", "未分类", "收件箱"] as const;
export const DEFAULT_INBOX_PATH = DEFAULT_INBOX_SEGMENTS.join("/");

/** 日历专属整理箱的固定 L1 根（与 `_整理箱` 同级的系统保留节点，见 AGENTS.md §3.1）。 */
export const CALENDAR_ROOT = "_日历";

/** `_日历/2026` —— L2 年节点路径。 */
export const calendarYearPath = (date: Date): string =>
  `${CALENDAR_ROOT}/${date.getFullYear()}`;

/** `_日历/2026/2026-06` —— L3 月节点路径（唯一内容承载层）。 */
export const calendarMonthPath = (date: Date): string =>
  `${calendarYearPath(date)}/${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;

/** `_日历/2026/2026-06/2026-06-13.md` —— 每日笔记文件路径（固定命名，不可配置）。 */
export const calendarNotePath = (date: Date): string =>
  `${calendarMonthPath(date)}/${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}.md`;

// ── workspace 绝对/相对路径互转（前端显示用；后端用 services/workspace-store 内部等价实现）──

/** workspace 相对路径 → 绝对路径（按 workspace 自身的分隔符）。 */
export const absoluteWorkspacePath = (workspace: string, relPath: string): string => {
  const normalized = normalizePath(relPath);
  if (!normalized) return workspace;
  const sep = workspace.includes("\\") && !workspace.includes("/") ? "\\" : "/";
  return `${workspace.replace(/[\\/]+$/, "")}${sep}${normalized.replace(/\//g, sep)}`;
};

/** 绝对路径 → workspace 相对 POSIX 路径（不在 workspace 内则原样归一化）。 */
export const relativeWorkspacePath = (workspace: string, absolutePath: string): string => {
  const workspaceParts = workspace.replace(/\\/g, "/").replace(/\/+$/, "");
  const absoluteParts = absolutePath.replace(/\\/g, "/");
  if (absoluteParts === workspaceParts) return "";
  if (!absoluteParts.startsWith(`${workspaceParts}/`)) return normalizePath(absolutePath);
  return absoluteParts.slice(workspaceParts.length + 1);
};

/** 拼接 workspace 相对子路径（base 先归一化）。 */
export const childWorkspacePath = (base: string, name: string): string =>
  normalizePath(base) ? `${normalizePath(base)}/${name}` : name;
