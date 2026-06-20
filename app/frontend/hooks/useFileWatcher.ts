/**
 * useFileWatcher。
 *
 * 监听 `eidon:file-changed`：净标签按设置自动重载，脏标签弹三选对话框
 * （reload/overwrite/cancel）——永不静默丢弃未保存编辑。随打开标签的 filePath 集
 * 增减 watch/unwatch。响应式 watch/挂载/卸载 → useEffect + store.subscribe。
 *
 * reloadTab 原先 setContent 后直接 mutate tab 的 encoding/hadBom/savedContent/lineEnding；
 * Zustand 改为单次不可变 setState（content=savedContent=normalized → 干净；同步其余字段）。
 */
import { useEffect } from 'react';
import { eidonInvoke } from '@bridge/ipc';
import { listen, type UnlistenFn } from '@bridge/ipc/platform';
import { useTabsStore } from '../stores/tabs';
import { useSettingsStore } from '../stores/settings';

type FileChangedAction = 'reload' | 'overwrite' | 'cancel';
type ShowDialog = (fileName: string) => Promise<FileChangedAction>;

export function useFileWatcher(showDialog: ShowDialog) {
  useEffect(() => {
    const watchedPaths = new Set<string>();
    const pendingPaths = new Set<string>();
    // 渲染侧自写抑制：本应用刚保存的文件，在窗口内忽略其 file-changed 回声。
    // 与 main 侧的 markSelfWrite 互为双保险，且不受符号链接/路径归一差异影响。
    const recentSaves = new Map<string, number>();
    const SELF_SAVE_WINDOW_MS = 2500;
    let unlisten: UnlistenFn | null = null;
    // listen() 是异步的：StrictMode（dev）下 mount→cleanup→mount 时 cleanup 可能早于 .then 落定，
    // 若不记录「已取消」会泄漏一个永不退订的监听器（对真实外部修改重复弹窗）。
    let cancelled = false;
    let lastPathsKey = '';

    const onSelfSaved = (event: Event): void => {
      const filePath = (event as CustomEvent<{ filePath?: string }>).detail?.filePath;
      if (filePath) recentSaves.set(filePath, Date.now());
    };
    window.addEventListener('eidon:saved', onSelfSaved);

    async function syncWatchedPaths() {
      const currentPaths = new Set<string>();
      for (const tab of useTabsStore.getState().tabs) {
        if ((tab.kind ?? 'text') === 'text' && tab.filePath) currentPaths.add(tab.filePath);
      }
      const toWatch = [...currentPaths].filter((p) => !watchedPaths.has(p));
      const toUnwatch = [...watchedPaths].filter((p) => !currentPaths.has(p));
      for (const path of toWatch) {
        try {
          await eidonInvoke('editor:watchFile', { path });
          watchedPaths.add(path);
        } catch (e) {
          console.warn('watch_file failed:', e);
        }
      }
      for (const path of toUnwatch) {
        try {
          await eidonInvoke('editor:unwatchFile', { path });
        } catch (e) {
          console.warn('unwatch_file failed:', e);
        }
        watchedPaths.delete(path);
      }
    }

    async function reloadTab(tabId: string, filePath: string) {
      const result = await eidonInvoke('editor:readFile', { path: filePath });
      if (result === null) throw new Error(`File not found: ${filePath}`);
      const normalized = result.content.includes('\r\n') ? result.content.replace(/\r\n/g, '\n') : result.content;
      const lineEnding: 'lf' | 'crlf' = result.content.includes('\r\n') ? 'crlf' : 'lf';
      useTabsStore.setState({
        tabs: useTabsStore.getState().tabs.map((t) =>
          t.id === tabId
            ? { ...t, content: normalized, savedContent: normalized, encoding: result.encoding, hadBom: result.hadBom, lineEnding }
            : t,
        ),
      });
    }

    async function handleFileChanged(filePath: string) {
      // 自写回声抑制：本应用刚保存（eidon:saved）的路径在窗口内忽略，避免「文件已被外部修改」误报。
      const savedAt = recentSaves.get(filePath);
      if (savedAt !== undefined) {
        if (Date.now() - savedAt <= SELF_SAVE_WINDOW_MS) return;
        recentSaves.delete(filePath);
      }
      const tabsState = useTabsStore.getState();
      const matching = tabsState.tabs.filter((t) => (t.kind ?? 'text') === 'text' && t.filePath === filePath);
      if (matching.length === 0) return;
      if (pendingPaths.has(filePath)) return;
      const settings = useSettingsStore.getState();
      const isPreview = settings.viewMode === 'preview';
      for (const tab of matching) {
        const isDirty = tab.content !== tab.savedContent;
        const autoReload = settings.autoReloadExternalChanges !== false;
        if (!isDirty && (isPreview || autoReload)) {
          try {
            await reloadTab(tab.id, filePath);
          } catch (e) {
            console.warn('reload failed:', e);
          }
          continue;
        }
        pendingPaths.add(filePath);
        try {
          const action = await showDialog(tab.fileName);
          if (action === 'reload') {
            await reloadTab(tab.id, filePath);
          } else if (action === 'overwrite') {
            const payload = tab.lineEnding === 'crlf' ? tab.content.replace(/\n/g, '\r\n') : tab.content;
            await eidonInvoke('editor:writeFile', { path: tab.filePath!, content: payload, encoding: tab.encoding || 'UTF-8' });
            useTabsStore.getState().markSaved(tab.id, tab.filePath!);
          }
        } catch (e) {
          console.warn('file-changed dialog action failed:', e);
        } finally {
          pendingPaths.delete(filePath);
        }
      }
    }

    // 随标签 filePath 集变化重新同步（替代 watch tabs 路径）。
    const unsubTabs = useTabsStore.subscribe(() => {
      const key = useTabsStore.getState().tabs.map((t) => `${t.kind ?? 'text'}:${t.filePath ?? ''}`).join('|');
      if (key !== lastPathsKey) {
        lastPathsKey = key;
        void syncWatchedPaths();
      }
    });

    lastPathsKey = useTabsStore.getState().tabs.map((t) => `${t.kind ?? 'text'}:${t.filePath ?? ''}`).join('|');
    void syncWatchedPaths();
    listen<string>('eidon://file-changed', (e) => {
      if (e.payload) handleFileChanged(e.payload);
    })
      .then((un) => {
        // cleanup 已先行：立即退订，避免泄漏。
        if (cancelled) {
          un();
          return;
        }
        unlisten = un;
      })
      .catch((e) => console.warn('file-changed listener failed:', e));

    return () => {
      cancelled = true;
      unsubTabs();
      window.removeEventListener('eidon:saved', onSelfSaved);
      if (unlisten) {
        unlisten();
        unlisten = null;
      }
      for (const path of watchedPaths) {
        eidonInvoke('editor:unwatchFile', { path }).catch(() => {});
      }
      watchedPaths.clear();
    };
    // showDialog 由 App 以稳定引用传入（useCallback）；监听器只挂一次。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
