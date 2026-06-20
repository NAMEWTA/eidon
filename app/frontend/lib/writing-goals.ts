/**
 * v2.5 — Word goals + writing stats，**纯解析逻辑**（框架无关，可在 Node 单测）。
 *
 * 从 `hooks/useWritingGoals.ts` 抽出（逐字保留），以便 Zustand store
 * 与 React hook 共用而不引入框架依赖。front matter 驱动：
 *
 *     ---
 *     goal: 1500
 *     goal_unit: words   # words | chars | cjk（默认 words）
 *     goal_set_at: 2026-04-26  # 首次保存带 goal 的文档时自动打戳
 *     ---
 */
import { cjkWordCount } from './chinese';

export type GoalUnit = 'words' | 'chars' | 'cjk';

export interface WritingGoal {
  goal: number;
  unit: GoalUnit;
  setAt: string | null;
}

const FRONT_MATTER_RE = /^﻿?---\r?\n([\s\S]*?)\r?\n---/;

/** Strip the front matter block from a body so word-counting only counts prose. */
export function bodyWithoutFrontMatter(body: string): string {
  if (!body) return '';
  const m = body.match(FRONT_MATTER_RE);
  if (!m) return body;
  return body.slice(m[0].length).replace(/^\r?\n/, '');
}

/**
 * Parse the goal-related fields out of a markdown body's YAML front matter.
 * Returns null if there's no front matter or no `goal:` key.
 */
export function readWritingGoal(body: string): WritingGoal | null {
  if (!body) return null;
  const m = body.match(FRONT_MATTER_RE);
  if (!m) return null;
  const yaml = m[1];

  const goalMatch = yaml.match(/^\s*goal\s*:\s*(\d+)\s*$/m);
  if (!goalMatch) return null;
  const goal = parseInt(goalMatch[1], 10);
  if (!Number.isFinite(goal) || goal <= 0) return null;

  const unitMatch = yaml.match(/^\s*goal_unit\s*:\s*(\S+)\s*$/m);
  let unit: GoalUnit = 'words';
  if (unitMatch) {
    const v = stripYamlQuotes(unitMatch[1]).toLowerCase();
    if (v === 'words' || v === 'chars' || v === 'cjk') unit = v;
  }

  const setAtMatch = yaml.match(/^\s*goal_set_at\s*:\s*(.+?)\s*$/m);
  const setAt = setAtMatch ? stripYamlQuotes(setAtMatch[1]) : null;

  return { goal, unit, setAt };
}

function stripYamlQuotes(s: string): string {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

/**
 * Stamp `goal_set_at: <YYYY-MM-DD>` into front matter the first time a goal
 * is saved, so the streak counter has a stable origin date. Idempotent.
 */
export function stampGoalSetAtIfMissing(body: string, today: string = todayISO()): string {
  if (!body) return body;
  const m = body.match(FRONT_MATTER_RE);
  if (!m) return body;
  const yaml = m[1];
  if (!/^\s*goal\s*:\s*\d+\s*$/m.test(yaml)) return body;
  if (/^\s*goal_set_at\s*:/m.test(yaml)) return body;

  const newYaml = yaml.replace(/\s*$/, '') + `\ngoal_set_at: ${today}`;
  return body.slice(0, m.index!) + `---\n${newYaml}\n---` + body.slice(m.index! + m[0].length);
}

export function todayISO(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Count tokens in `body` (front matter excluded) per the requested unit. */
export function countForUnit(body: string, unit: GoalUnit): number {
  const text = bodyWithoutFrontMatter(body);
  const stats = cjkWordCount(text);
  switch (unit) {
    case 'cjk':
      return stats.cjk;
    case 'chars':
      return stats.chars;
    case 'words':
    default:
      return stats.total;
  }
}
