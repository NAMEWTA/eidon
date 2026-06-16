/**
 * v2.2 (rev.2) — 即时 AutoGit on save（从 Vue composable 迁移为 React hook）。
 *
 * 无防抖：每次 ⌘S → 快照 + toast。单一开关 autoGitEnabled，翻 ON 立即 init 仓库。
 * 所有错误都 toast。`start()` 由 App 在挂载时调用：注册 `eidon:saved` window 监听，
 * 并订阅 autoGitEnabled / currentFolder 变化（替代 Vue watch {immediate:true}），
 * 切换 ON 或切工作区时确保仓库已 init。命令式函数，用模块级单例避免重复监听。
 */
import { useSettingsStore } from '../stores/settings';
import { useWorkspaceStore } from '../stores/workspace';
import { useGitHistoryStore } from '../stores/gitHistory';
import { useTabsStore } from '../stores/tabs';
import { useToastsStore } from '../stores/toasts';
import { scheduleHistoryPrune } from '../lib/history-prune';
import { t } from '../i18n';

let listening = false;
let busy = false;
let unsubscribe: (() => void) | null = null;
let lastEnabled: boolean | null = null;
let lastFolder: string | null | undefined = undefined;

function isEnabled(): boolean {
  return Boolean(useSettingsStore.getState().autoGitEnabled);
}

async function ensureInitialized(folder: string): Promise<boolean> {
  const gh = useGitHistoryStore.getState();
  // 状态缓存为 null 或缓存的 folder 与当前不一致 → 重新查询，防止 workspace 切换后使用旧缓存误判已初始化
  if (!gh.status || gh.folder !== folder) await gh.refreshStatus(folder);
  if (useGitHistoryStore.getState().isInitialized()) return true;
  try {
    await useGitHistoryStore.getState().init(folder);
    useToastsStore.getState().info(t('history.initialized'));
    return true;
  } catch (e) {
    useToastsStore.getState().error(`${t('history.commitFailed')}: ${e}`);
    console.warn('autogit init failed', e);
    return false;
  }
}

async function performCommit(): Promise<void> {
  if (busy) return;
  if (!isEnabled()) return;
  const folder = useWorkspaceStore.getState().currentFolder;
  if (!folder) return;
  busy = true;
  try {
    if (!(await ensureInitialized(folder))) return;
    const filePath = useTabsStore.getState().activeTab()?.filePath ?? undefined;
    try {
      const sha = await useGitHistoryStore.getState().commit(folder, filePath);
      if (sha) {
        useToastsStore.getState().success(t('history.savedSnapshot', { sha: sha.slice(0, 7) }));
        // 自动按设置上限修剪历史（去抖、后台；无上限时 no-op）。
        scheduleHistoryPrune(folder);
      }
    } catch (e) {
      useToastsStore.getState().error(`${t('history.commitFailed')}: ${e}`);
      console.warn('autogit commit failed', e);
    }
  } finally {
    busy = false;
  }
}

function onSaved(): void {
  void performCommit();
}

/** 订阅 autoGitEnabled / currentFolder 变化（替代 watch）；变化且开启时确保 init。 */
function checkEnsure(): void {
  const enabled = useSettingsStore.getState().autoGitEnabled;
  const folder = useWorkspaceStore.getState().currentFolder;
  if (enabled === lastEnabled && folder === lastFolder) return;
  lastEnabled = enabled;
  lastFolder = folder;
  if (!enabled || !folder) return;
  void ensureInitialized(folder);
}

function start(): void {
  if (listening) return;
  listening = true;
  window.addEventListener('eidon:saved', onSaved as EventListener);
  // immediate + 持续监听：boot 时若已开启需确保当前工作区有 .git/；切工作区时重 init。
  const unsubA = useSettingsStore.subscribe(() => checkEnsure());
  const unsubB = useWorkspaceStore.subscribe(() => checkEnsure());
  unsubscribe = () => {
    unsubA();
    unsubB();
  };
  checkEnsure(); // immediate
}

function stop(): void {
  if (!listening) return;
  listening = false;
  window.removeEventListener('eidon:saved', onSaved as EventListener);
  unsubscribe?.();
  unsubscribe = null;
}

async function commitNow(): Promise<void> {
  const folder = useWorkspaceStore.getState().currentFolder;
  if (!folder) {
    useToastsStore.getState().warning(t('history.noFolder'));
    return;
  }
  if (!(await ensureInitialized(folder))) return;
  const filePath = useTabsStore.getState().activeTab()?.filePath ?? undefined;
  try {
    const sha = await useGitHistoryStore.getState().commit(folder, filePath);
    if (sha) {
      useToastsStore.getState().success(t('history.savedSnapshot', { sha: sha.slice(0, 7) }));
    } else {
      useToastsStore.getState().info(t('history.nothingToCommit'));
    }
  } catch (e) {
    useToastsStore.getState().error(`${t('history.commitFailed')}: ${e}`);
    console.warn('manual snapshot failed', e);
  }
}

export function useAutoCommit() {
  return { start, stop, commitNow };
}
