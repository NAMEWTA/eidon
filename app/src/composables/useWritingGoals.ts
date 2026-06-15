/**
 * v2.5 — Word goals + writing stats (Ulysses-inspired).
 *
 * Lightweight per-document goal tracking driven by YAML front matter:
 *
 *     ---
 *     goal: 1500           # required to activate the feature for this doc
 *     goal_unit: words     # optional; "words" | "chars" | "cjk" — default "words"
 *     goal_set_at: 2026-04-26  # auto-stamped on first goal save (driven by Editor)
 *     ---
 *
 * If `goal` is missing, the feature stays inert for that doc.
 *
 * Pure parsing helpers live at the module level; a small composable wraps
 * them up for the Vue side and exposes the active doc's progress.
 */
import { useMemo } from 'react';
import { useTabsStore } from '../stores/tabs';
import { readWritingGoal, countForUnit } from '../lib/writing-goals';

// 纯解析逻辑已迁至框架无关的 lib/writing-goals.ts；此处再导出以保持既有调用点不变。
export {
  bodyWithoutFrontMatter,
  readWritingGoal,
  stampGoalSetAtIfMissing,
  todayISO,
  countForUnit,
} from '../lib/writing-goals';
export type { GoalUnit, WritingGoal } from '../lib/writing-goals';

/**
 * React hook：暴露 active 文档的写作目标进度。订阅 active tab 的 content/savedContent/
 * id/path 切片，派生值用 useMemo。返回普通值（非 Vue computed ref）。
 */
export function useWritingGoals() {
  const activeBody = useTabsStore((s) => s.activeTab()?.content ?? '');
  const activeSavedBody = useTabsStore((s) => s.activeTab()?.savedContent ?? '');
  const activeTabId = useTabsStore((s) => s.activeTab()?.id ?? '');
  const activeTabPath = useTabsStore((s) => {
    const t = s.activeTab();
    return t?.filePath ?? t?.id ?? '';
  });

  const goal = useMemo(() => readWritingGoal(activeBody), [activeBody]);
  const current = useMemo(() => (goal ? countForUnit(activeBody, goal.unit) : 0), [goal, activeBody]);
  const savedCount = useMemo(() => (goal ? countForUnit(activeSavedBody, goal.unit) : 0), [goal, activeSavedBody]);
  const progress = goal && goal.goal > 0 ? Math.min(1, current / goal.goal) : 0;
  const reachedGoal = !!goal && current >= goal.goal;

  return { goal, current, savedCount, progress, reachedGoal, activeBody, activeSavedBody, activeTabId, activeTabPath };
}
