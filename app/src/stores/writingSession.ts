/**
 * v2.5 — writing-session bookkeeping（Zustand v5；从 Pinia 1:1 迁移）。
 *
 * 每文件两个时间窗："since opened"（开文档时的计数锚点）与 "since saved"
 * （存盘时间戳）。每日总计也在此 store，供 WritingGoals 浮层与状态栏共用。
 * 持久化到 `localStorage['eidon.writingSession.v1']`。
 *
 * 注：Pinia 版直接 mutate 嵌套对象；Zustand 改为不可变更新（新引用）以驱动
 * 选择器订阅，但持久化形状与读写时机逐字保留。
 */
import { create } from 'zustand';

const LS_KEY = 'eidon.writingSession.v1';

export interface SessionEntry {
  firstOpenedAt: string;
  openCount: number;
  current: number;
  lastSavedAt: string | null;
  lastSavedCount: number;
  day: string;
}

export interface DailyTotalEntry {
  day: string;
  totalNewWords: number;
  paths: string[];
}

interface State {
  sessions: Record<string, SessionEntry>;
  daily: DailyTotalEntry;
}

interface Actions {
  persist(): void;
  rolloverIfNewDay(): void;
  observe(path: string, count: number): void;
  markSaved(path: string, count: number): void;
  resetSession(path: string, currentCount: number): void;
  closePath(path: string): void;
  // getters → 方法
  todayDocCount(): number;
  todayTotal(): number;
  sessionForPath(path: string): SessionEntry | undefined;
}

function todayISO(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function load(): State {
  const today = todayISO();
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LS_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw) as State;
      // 跨日 rollover — 丢弃昨天的「今日总计」快照。
      if (parsed.daily?.day !== today) {
        parsed.daily = { day: today, totalNewWords: 0, paths: [] };
      }
      // 丢弃 day 不等于今天的会话锚点（否则会把昨天的进度算进今天）。
      if (parsed.sessions) {
        for (const k of Object.keys(parsed.sessions)) {
          if (parsed.sessions[k].day !== today) {
            delete parsed.sessions[k];
          }
        }
      } else {
        parsed.sessions = {};
      }
      return parsed;
    }
  } catch {}
  return {
    sessions: {},
    daily: { day: today, totalNewWords: 0, paths: [] },
  };
}

export const useWritingSessionStore = create<State & Actions>()((set, get) => ({
  ...load(),

  persist() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ sessions: get().sessions, daily: get().daily }));
    } catch {}
  },

  todayDocCount() {
    return get().daily.paths.length;
  },
  todayTotal() {
    return get().daily.totalNewWords;
  },
  sessionForPath(path) {
    return get().sessions[path];
  },

  rolloverIfNewDay() {
    const today = todayISO();
    if (get().daily.day !== today) {
      set({ daily: { day: today, totalNewWords: 0, paths: [] }, sessions: {} });
      get().persist();
    }
  },

  observe(path, count) {
    if (!path) return;
    const today = todayISO();
    if (get().daily.day !== today) {
      get().rolloverIfNewDay();
    }
    const entry = get().sessions[path];
    if (!entry || entry.day !== today) {
      const fresh: SessionEntry = {
        firstOpenedAt: new Date().toISOString(),
        openCount: count,
        current: count,
        lastSavedAt: null,
        lastSavedCount: count,
        day: today,
      };
      const daily = get().daily;
      const paths = daily.paths.includes(path) ? daily.paths : [...daily.paths, path];
      set({
        sessions: { ...get().sessions, [path]: fresh },
        daily: { ...daily, paths },
      });
      get().persist();
      return;
    }

    // 基于「新 delta vs 上次计入的 delta」滚动更新 daily.totalNewWords。
    const prevDelta = Math.max(0, entry.current - entry.openCount);
    const newCurrent = count;
    const newDelta = Math.max(0, newCurrent - entry.openCount);
    let totalNewWords = get().daily.totalNewWords + (newDelta - prevDelta);
    if (totalNewWords < 0) totalNewWords = 0;
    const newEntry: SessionEntry = { ...entry, current: newCurrent };
    const daily = get().daily;
    const paths = daily.paths.includes(path) ? daily.paths : [...daily.paths, path];
    set({
      sessions: { ...get().sessions, [path]: newEntry },
      daily: { ...daily, totalNewWords, paths },
    });
    get().persist();
  },

  markSaved(path, count) {
    const entry = get().sessions[path];
    if (!entry) return;
    const newEntry: SessionEntry = { ...entry, lastSavedAt: new Date().toISOString(), lastSavedCount: count };
    set({ sessions: { ...get().sessions, [path]: newEntry } });
    get().persist();
  },

  resetSession(path, currentCount) {
    const entry = get().sessions[path];
    const today = todayISO();
    if (!entry) {
      const fresh: SessionEntry = {
        firstOpenedAt: new Date().toISOString(),
        openCount: currentCount,
        current: currentCount,
        lastSavedAt: null,
        lastSavedCount: currentCount,
        day: today,
      };
      set({ sessions: { ...get().sessions, [path]: fresh } });
    } else {
      const prevDelta = Math.max(0, entry.current - entry.openCount);
      const totalNewWords = Math.max(0, get().daily.totalNewWords - prevDelta);
      const newEntry: SessionEntry = {
        ...entry,
        openCount: currentCount,
        current: currentCount,
        firstOpenedAt: new Date().toISOString(),
      };
      set({
        sessions: { ...get().sessions, [path]: newEntry },
        daily: { ...get().daily, totalNewWords },
      });
    }
    get().persist();
  },

  closePath(path) {
    if (!path) return;
    const { [path]: _drop, ...rest } = get().sessions;
    void _drop;
    set({ sessions: rest });
    get().persist();
  },
}));

/**
 * Compute a streak (consecutive-days-with-a-goal) ending today, given a
 * `goal_set_at` date. Pure — exported for the popover & tests.
 */
export function computeStreakDays(goalSetAt: string | null, today: Date = new Date()): number {
  if (!goalSetAt) return 0;
  const m = goalSetAt.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return 0;
  const setDate = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(setDate.getTime())) return 0;
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = Math.floor((todayMid.getTime() - setDate.getTime()) / 86400000);
  if (diff < 0) return 0;
  return diff + 1;
}
