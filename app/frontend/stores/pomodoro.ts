/**
 * v2.5 F4 — Pomodoro / Zen focus 计时器（Zustand v5）。
 *
 * 单会话、跨重载恢复（`eidon.pomodoro.state.v1`）、自动只链一个 break、
 * 自动进入专注模式（翻 settings.focusMode，结束恢复）。完成的 focus 会话
 * 追加到 `eidon.pomodoro.sessions.v1`。getters → 方法；定时器句柄为模块级。
 */
import { create } from 'zustand';
import { useTabsStore } from './tabs';
import { useSettingsStore } from './settings';
import { cjkWordCount } from '../lib/chinese';

const LS_STATE = 'eidon.pomodoro.state.v1';
const LS_SESSIONS = 'eidon.pomodoro.sessions.v1';
const LS_LAST_PRESET = 'eidon.pomodoro.lastPreset.v1';

export type PomodoroPhase = 'focus' | 'break' | 'flash';

export interface PomodoroSessionRecord {
  date: string;
  durationMin: number;
  wordsWritten: number;
}

interface PersistedState {
  phase: PomodoroPhase;
  startedAt: number;
  durationMs: number;
  paused: boolean;
  pausedRemainingMs: number;
  startWordCount: number;
  priorFocusMode: boolean;
  autoBreakNext: boolean;
  notifyOnEnd: boolean;
}

interface PomodoroState extends Partial<PersistedState> {
  now: number;
  active: boolean;
  flashing: boolean;
}

let tickHandle: ReturnType<typeof setInterval> | null = null;
let flashHandle: ReturnType<typeof setTimeout> | null = null;

function loadPersisted(): PersistedState | null {
  try {
    const raw = localStorage.getItem(LS_STATE);
    if (!raw) return null;
    const obj = JSON.parse(raw) as PersistedState;
    if (typeof obj?.startedAt !== 'number') return null;
    if (Date.now() - obj.startedAt > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(LS_STATE);
      return null;
    }
    return obj;
  } catch {
    return null;
  }
}

function savePersisted(s: PersistedState) {
  try {
    localStorage.setItem(LS_STATE, JSON.stringify(s));
  } catch {}
}

function clearPersisted() {
  try {
    localStorage.removeItem(LS_STATE);
  } catch {}
}

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function totalWordCount(): number {
  try {
    const tabs = useTabsStore.getState();
    let sum = 0;
    for (const t of tabs.tabs) sum += cjkWordCount(t.content || '').total;
    return sum;
  } catch {
    return 0;
  }
}

function appendSession(rec: PomodoroSessionRecord) {
  try {
    const raw = localStorage.getItem(LS_SESSIONS);
    const arr: PomodoroSessionRecord[] = raw ? JSON.parse(raw) : [];
    arr.push(rec);
    localStorage.setItem(LS_SESSIONS, JSON.stringify(arr));
  } catch {}
}

export function setLastPreset(min: number) {
  try {
    localStorage.setItem(LS_LAST_PRESET, String(min));
  } catch {}
}

export function getLastPreset(): number {
  try {
    const v = localStorage.getItem(LS_LAST_PRESET);
    if (v) {
      const n = parseFloat(v);
      if (Number.isFinite(n) && n > 0) return n;
    }
  } catch {}
  return 25;
}

function fireNotification(title: string, body: string) {
  try {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'granted') {
      new Notification(title, { body });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission()
        .then((p) => {
          if (p === 'granted') new Notification(title, { body });
        })
        .catch(() => {});
    }
  } catch {}
}

interface PomodoroActions {
  // getters → 方法
  remainingMs(): number;
  countdown(): string;
  running(): boolean;
  isPaused(): boolean;
  isBreak(): boolean;
  // actions
  _ensureTick(): void;
  _stopTick(): void;
  _persist(): void;
  start(minutes: number, opts?: { autoBreak?: boolean; notify?: boolean; engageFocusMode?: boolean }): void;
  pause(): void;
  resume(): void;
  togglePause(): void;
  stop(): void;
  reset(): void;
  _abort(): void;
  _restoreFocusMode(): void;
  _finishPhase(): void;
  _startBreak(): void;
  rehydrate(): void;
}

function initialState(): PomodoroState {
  const persisted = loadPersisted();
  const base: PomodoroState = { now: Date.now(), active: false, flashing: false };
  if (persisted) {
    Object.assign(base, persisted);
    base.active = true;
  }
  return base;
}

export const usePomodoroStore = create<PomodoroState & PomodoroActions>()((set, get) => ({
  ...initialState(),

  remainingMs() {
    const s = get();
    if (!s.active) return 0;
    if (s.flashing) return 0;
    if (!s.startedAt || !s.durationMs) return 0;
    if (s.paused) return s.pausedRemainingMs ?? 0;
    const elapsed = s.now - s.startedAt;
    return Math.max(0, s.durationMs - elapsed);
  },
  countdown() {
    const ms = get().remainingMs();
    const total = Math.ceil(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  },
  running() {
    return get().active && !get().flashing;
  },
  isPaused() {
    return !!get().paused;
  },
  isBreak() {
    return get().phase === 'break';
  },

  _ensureTick() {
    if (tickHandle) return;
    tickHandle = setInterval(() => {
      set({ now: Date.now() });
      if (!get().active || get().flashing || get().paused) return;
      if (get().remainingMs() <= 0) {
        get()._finishPhase();
      }
    }, 1000);
  },
  _stopTick() {
    if (tickHandle) {
      clearInterval(tickHandle);
      tickHandle = null;
    }
  },
  _persist() {
    if (!get().active || get().flashing) {
      clearPersisted();
      return;
    }
    const s = get();
    const persisted: PersistedState = {
      phase: s.phase as PomodoroPhase,
      startedAt: s.startedAt as number,
      durationMs: s.durationMs as number,
      paused: !!s.paused,
      pausedRemainingMs: s.pausedRemainingMs ?? 0,
      startWordCount: s.startWordCount as number,
      priorFocusMode: !!s.priorFocusMode,
      autoBreakNext: !!s.autoBreakNext,
      notifyOnEnd: !!s.notifyOnEnd,
    };
    savePersisted(persisted);
  },
  start(minutes, opts = {}) {
    if (get().active) get()._abort();
    const settings = useSettingsStore.getState();
    const durationMs = Math.max(1, Math.round(minutes * 60 * 1000));
    const priorFocusMode = settings.focusMode;
    const engage = opts.engageFocusMode ?? settings.pomodoroAutoEngageFocus;
    if (engage && !settings.focusMode) {
      useSettingsStore.setState({ focusMode: true });
      useSettingsStore.getState().persist();
    }
    set({
      phase: 'focus',
      startedAt: Date.now(),
      durationMs,
      paused: false,
      pausedRemainingMs: 0,
      startWordCount: totalWordCount(),
      priorFocusMode,
      autoBreakNext: !!opts.autoBreak,
      notifyOnEnd: !!opts.notify,
      active: true,
      flashing: false,
      now: Date.now(),
    });
    setLastPreset(minutes);
    get()._ensureTick();
    get()._persist();
  },
  pause() {
    if (!get().active || get().flashing || get().paused) return;
    set({ pausedRemainingMs: get().remainingMs(), paused: true });
    get()._persist();
  },
  resume() {
    if (!get().active || get().flashing || !get().paused) return;
    // 重新锚定 startedAt 使既有 remaining 计算继续成立。
    set({ startedAt: Date.now() - (get().durationMs! - get().pausedRemainingMs!), paused: false, pausedRemainingMs: 0 });
    get()._persist();
  },
  togglePause() {
    if (get().paused) get().resume();
    else get().pause();
  },
  stop() {
    get()._abort();
  },
  reset() {
    get()._abort();
  },
  _abort() {
    get()._restoreFocusMode();
    set({
      active: false,
      flashing: false,
      paused: false,
      phase: undefined,
      startedAt: undefined,
      durationMs: undefined,
      pausedRemainingMs: 0,
    });
    if (flashHandle) {
      clearTimeout(flashHandle);
      flashHandle = null;
    }
    get()._stopTick();
    clearPersisted();
  },
  _restoreFocusMode() {
    try {
      const settings = useSettingsStore.getState();
      // 只在与 priorFocusMode 不一致时恢复（即便用户中途手动改过，也恢复到会话前的偏好——契约如此）。
      if (settings.focusMode !== get().priorFocusMode) {
        useSettingsStore.setState({ focusMode: !!get().priorFocusMode });
        useSettingsStore.getState().persist();
      }
    } catch {}
  },
  _finishPhase() {
    const wasFocus = get().phase === 'focus';
    const durationMin = Math.round((get().durationMs ?? 0) / 60000);
    if (wasFocus) {
      const after = totalWordCount();
      const delta = Math.max(0, after - (get().startWordCount ?? after));
      appendSession({ date: todayIso(), durationMin, wordsWritten: delta });
    }
    const shouldNotify = !!get().notifyOnEnd && wasFocus;
    const willChainBreak = wasFocus && !!get().autoBreakNext;
    set({ flashing: true, paused: false });
    if (!willChainBreak) {
      get()._restoreFocusMode();
    }
    clearPersisted();
    if (shouldNotify) {
      const wordsDelta = wasFocus ? Math.max(0, totalWordCount() - (get().startWordCount ?? 0)) : 0;
      fireNotification('EIDON — focus session complete', `${durationMin} min · ${wordsDelta} words written`);
    }
    if (flashHandle) clearTimeout(flashHandle);
    flashHandle = setTimeout(() => {
      flashHandle = null;
      if (willChainBreak) {
        get()._startBreak();
      } else {
        set({ active: false, flashing: false, phase: undefined });
        get()._stopTick();
      }
    }, 5000);
  },
  _startBreak() {
    const breakMs = 5 * 60 * 1000;
    set({
      phase: 'break',
      startedAt: Date.now(),
      durationMs: breakMs,
      paused: false,
      pausedRemainingMs: 0,
      flashing: false,
      autoBreakNext: false,
      notifyOnEnd: false,
      now: Date.now(),
    });
    get()._ensureTick();
    get()._persist();
  },
  rehydrate() {
    const persisted = loadPersisted();
    if (!persisted) return;
    set({ ...persisted, active: true, flashing: false, now: Date.now() });
    if (!persisted.paused) {
      const elapsed = Date.now() - persisted.startedAt;
      if (elapsed >= persisted.durationMs) {
        get()._finishPhase();
        return;
      }
    }
    get()._ensureTick();
  },
}));
