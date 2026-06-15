/**
 * v2.6 — auto-push + auto-pull glue（从 Vue composable 迁移为 React hook）。
 * 与 useAutoCommit 并行：`eidon:saved`（AutoGit 提交后）若已 link 且 auto_push → 防抖 push；
 * 按 auto_pull_minutes 定时 pull。push/pull 均 toast（无静默失败）。watch → store.subscribe。
 */
import { useGithubSyncStore } from '../stores/githubSync';
import { useWorkspaceStore } from '../stores/workspace';
import { useToastsStore } from '../stores/toasts';
import { t } from '../i18n';

let listening = false;
let pulling = false;
let pulltimer: ReturnType<typeof setInterval> | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let unsubscribe: (() => void) | null = null;

async function refreshIfLinked(folder: string | null): Promise<void> {
  if (!folder) return;
  await useGithubSyncStore.getState().refreshStatus(folder);
}

async function pushIfWanted(): Promise<void> {
  const sync = useGithubSyncStore.getState();
  const folder = useWorkspaceStore.getState().currentFolder;
  if (!folder) return;
  if (!sync.status?.linked) return;
  if (!sync.status?.auto_push) return;
  try {
    await sync.push(folder);
    useToastsStore.getState().success(t('githubSync.pushedToast'));
  } catch (e) {
    useToastsStore.getState().error(`${t('githubSync.pushFailed')}: ${e}`);
  }
}

function onSaved(): void {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void pushIfWanted();
  }, 5000);
}

async function pullIfWanted(): Promise<void> {
  if (pulling) return;
  const sync = useGithubSyncStore.getState();
  const folder = useWorkspaceStore.getState().currentFolder;
  if (!folder) return;
  if (!sync.status?.linked) return;
  if (sync.status.dirty) return;
  pulling = true;
  try {
    const r = await sync.pull(folder);
    if (r.kind === 'fast_forward' || r.kind === 'merged') {
      useToastsStore.getState().success(t('githubSync.pulledToast'));
      window.dispatchEvent(new CustomEvent('eidon:remote-pulled'));
    } else if (r.kind === 'conflicts') {
      useToastsStore.getState().warning(t('githubSync.pullConflicts', { n: String(r.conflicts.length) }));
    }
  } catch (e) {
    useToastsStore.getState().error(`${t('githubSync.pullFailed')}: ${e}`);
  } finally {
    pulling = false;
  }
}

function rescheduleTimer(): void {
  if (pulltimer) {
    clearInterval(pulltimer);
    pulltimer = null;
  }
  const sync = useGithubSyncStore.getState();
  const minutes = sync.status?.auto_pull_minutes ?? 0;
  if (!sync.status?.linked || minutes <= 0) return;
  pulltimer = setInterval(() => {
    void pullIfWanted();
  }, minutes * 60_000);
}

function start(): void {
  if (listening) return;
  listening = true;
  window.addEventListener('eidon:saved', onSaved as EventListener);

  // workspace 变化 → 刷新 linked 状态；linked / auto_pull_minutes 变化 → 重排定时器。
  let lastFolder: string | null | undefined = undefined;
  let lastLinked: boolean | undefined;
  let lastMinutes: number | undefined;
  const onWorkspace = () => {
    const f = useWorkspaceStore.getState().currentFolder;
    if (f === lastFolder) return;
    lastFolder = f;
    void refreshIfLinked(f);
  };
  const onSync = () => {
    const st = useGithubSyncStore.getState().status;
    if (st?.linked === lastLinked && st?.auto_pull_minutes === lastMinutes) return;
    lastLinked = st?.linked;
    lastMinutes = st?.auto_pull_minutes;
    rescheduleTimer();
  };
  const unsubA = useWorkspaceStore.subscribe(() => onWorkspace());
  const unsubB = useGithubSyncStore.subscribe(() => onSync());
  unsubscribe = () => {
    unsubA();
    unsubB();
  };
  onWorkspace(); // immediate
  onSync(); // immediate

  // boot 后做一次即时 pull（覆盖「昨晚在 iPad 上编辑」常见场景）。
  setTimeout(() => {
    void pullIfWanted();
  }, 2000);
}

function stop(): void {
  if (!listening) return;
  listening = false;
  window.removeEventListener('eidon:saved', onSaved as EventListener);
  if (pulltimer) {
    clearInterval(pulltimer);
    pulltimer = null;
  }
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  unsubscribe?.();
  unsubscribe = null;
}

async function pullNow(): Promise<void> {
  await pullIfWanted();
}

async function pushNow(): Promise<void> {
  const sync = useGithubSyncStore.getState();
  const folder = useWorkspaceStore.getState().currentFolder;
  if (!folder) {
    useToastsStore.getState().warning(t('history.noFolder'));
    return;
  }
  if (!sync.status?.linked) {
    useToastsStore.getState().warning(t('githubSync.notLinked'));
    return;
  }
  try {
    await sync.push(folder);
    useToastsStore.getState().success(t('githubSync.pushedToast'));
  } catch (e) {
    useToastsStore.getState().error(`${t('githubSync.pushFailed')}: ${e}`);
  }
}

export function useGithubSync() {
  return { start, stop, pullNow, pushNow };
}
