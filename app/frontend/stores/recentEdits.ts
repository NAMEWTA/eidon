/**
 * recentEdits store（Zustand v5）。⌘P 快速切换器的编辑频率。
 * 记录每文件保存次数；与 workspace.recentFiles（MRU）结合给出 MFU 信号。
 * 持久化 `localStorage['eidon.recentEdits.v1']`，硬上限 1000 LRU。
 */
import { create } from 'zustand';

const LS_KEY = 'eidon.recentEdits.v1';
const LRU_CAP = 1000;

interface RecentEditsState {
  counts: Record<string, number>;
}

function load(): RecentEditsState {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LS_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const counts: Record<string, number> = {};
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === 'number' && Number.isFinite(v) && v > 0) counts[k] = v;
        }
        return { counts };
      }
    }
  } catch {}
  return { counts: {} };
}

/**
 * Custom 50-line fuzzy scorer（纯函数，导出供测试）。
 * basename 匹配 > path 匹配；prefix > inner；连续 > 散落；大小写不敏感；
 * 任一 query 字符缺失返回 null。
 */
export function scorePath(query: string, path: string): number | null {
  if (!query) return 0;
  const q = query.toLowerCase();
  const p = path.toLowerCase();
  const slash = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
  const base = slash >= 0 ? p.slice(slash + 1) : p;
  let pi = 0;
  for (const ch of q) {
    const found = p.indexOf(ch, pi);
    if (found < 0) return null;
    pi = found + 1;
  }
  let score = 0;
  const baseHit = base.indexOf(q);
  if (baseHit === 0) score += 1000;
  else if (baseHit > 0) score += 600;
  const pathHit = p.indexOf(q);
  if (pathHit >= 0) score += 200;
  let bi = 0;
  let run = 0;
  let bestRun = 0;
  for (const ch of q) {
    const found = base.indexOf(ch, bi);
    if (found < 0) {
      run = 0;
      continue;
    }
    if (found === bi) run += 1;
    else run = 1;
    if (run > bestRun) bestRun = run;
    bi = found + 1;
  }
  score += bestRun * 50;
  score -= Math.min(p.length, 200) * 0.5;
  if (base.startsWith(q[0])) score += 10;
  return score;
}

interface Actions {
  persist(): void;
  recordEdit(path: string): void;
  forget(path: string): void;
  evictIfNeeded(): void;
  topN(n: number, query: string, recentPaths?: string[], extra?: string[]): string[];
}

export const useRecentEditsStore = create<RecentEditsState & Actions>()((set, get) => ({
  ...load(),

  persist() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(get().counts));
    } catch {}
  },

  recordEdit(path) {
    if (!path) return;
    set({ counts: { ...get().counts, [path]: (get().counts[path] || 0) + 1 } });
    get().evictIfNeeded();
    get().persist();
  },

  forget(path) {
    if (path in get().counts) {
      const { [path]: _drop, ...rest } = get().counts;
      void _drop;
      set({ counts: rest });
      get().persist();
    }
  },

  evictIfNeeded() {
    const counts = { ...get().counts };
    const keys = Object.keys(counts);
    if (keys.length <= LRU_CAP) return;
    keys.sort((a, b) => {
      const ca = counts[a];
      const cb = counts[b];
      if (ca !== cb) return ca - cb;
      return a < b ? -1 : a > b ? 1 : 0;
    });
    const drop = keys.length - LRU_CAP;
    for (let i = 0; i < drop; i++) delete counts[keys[i]];
    set({ counts });
  },

  topN(n, query, recentPaths = [], extra = []) {
    const counts = get().counts;
    const q = query.trim();
    if (!q) {
      const seen = new Set<string>();
      const out: string[] = [];
      for (const p of recentPaths) {
        if (p && !seen.has(p)) {
          seen.add(p);
          out.push(p);
          if (out.length >= n) return out;
        }
      }
      const byFreq = Object.entries(counts).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
      for (const [p] of byFreq) {
        if (!seen.has(p)) {
          seen.add(p);
          out.push(p);
          if (out.length >= n) return out;
        }
      }
      for (const p of extra) {
        if (p && !seen.has(p)) {
          seen.add(p);
          out.push(p);
          if (out.length >= n) return out;
        }
      }
      return out;
    }
    const universe = new Set<string>();
    for (const p of recentPaths) if (p) universe.add(p);
    for (const p of Object.keys(counts)) universe.add(p);
    for (const p of extra) if (p) universe.add(p);
    const ranked: Array<{ path: string; score: number }> = [];
    for (const path of universe) {
      const s = scorePath(q, path);
      if (s !== null) {
        const freq = counts[path] || 0;
        ranked.push({ path, score: s + Math.log2(1 + freq) * 8 });
      }
    }
    ranked.sort((a, b) => b.score - a.score);
    return ranked.slice(0, n).map((r) => r.path);
  },
}));
