/**
 * history-prune.ts — 按「设置-同步」的历史上限修剪 git 历史（破坏性，见 ADR-0023）。
 *
 * 由 useAutoCommit 在每次自动提交后去抖调度（no-op 时只走一次轻量提交计数遍历）；
 * 也由设置面板「立即压缩历史」按钮直接调用。提交数上限是硬控制；体积上限在 gc 生效时
 * 通过逐步减半保留数再修剪逼近（有界迭代）。
 */
import { useSettingsStore } from '../stores/settings';
import { useGitHistoryStore } from '../stores/gitHistory';

let pruneTimer: ReturnType<typeof setTimeout> | null = null;
let pruning = false;

function limitsConfigured(): boolean {
  const s = useSettingsStore.getState();
  return s.historyMaxCommits > 0 || s.historyMaxGitSizeMb > 0;
}

/** 按当前设置上限对某工作区历史做修剪（提交数 + 体积）。无上限时直接返回。 */
export async function runHistoryPrune(folder: string): Promise<void> {
  const s = useSettingsStore.getState();
  const maxCommits = s.historyMaxCommits;
  const maxSizeMb = s.historyMaxGitSizeMb;
  if (maxCommits <= 0 && maxSizeMb <= 0) return;
  if (pruning) return;
  pruning = true;
  try {
    const gh = useGitHistoryStore.getState();
    // 1) 提交数上限（仅设体积上限时给一个保守起点）。
    let keep = maxCommits > 0 ? maxCommits : 500;
    let result = await gh.prune(folder, keep);
    // 2) 体积上限：若仍超且系统 gc 生效（否则磁盘不会回收），逐步减半保留数再修剪。
    if (maxSizeMb > 0 && result.gc_ran) {
      const capBytes = maxSizeMb * 1024 * 1024;
      let iter = 0;
      while (iter < 6 && result.size_after > capBytes && keep > 10) {
        keep = Math.max(10, Math.floor(keep / 2));
        result = await gh.prune(folder, keep);
        iter += 1;
      }
    }
  } finally {
    pruning = false;
  }
}

/** 去抖调度（保存后触发）。无上限时不排程。 */
export function scheduleHistoryPrune(folder: string, delayMs = 30000): void {
  if (!limitsConfigured()) return;
  if (pruneTimer) clearTimeout(pruneTimer);
  pruneTimer = setTimeout(() => {
    pruneTimer = null;
    void runHistoryPrune(folder).catch((e) => console.warn('history prune failed', e));
  }, delayMs);
}
