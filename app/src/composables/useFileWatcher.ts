/**
 * useFileWatcher（从 Vue composable 迁移为 React hook）。
 *
 * 监听 Rust `eidon://file-changed`：净标签按设置自动重载，脏标签弹三选对话框
 * （reload/overwrite/cancel）——永不静默丢弃未保存编辑。随打开标签的 filePath 集
 * 增减 watch/unwatch。Vue 的 watch/onMounted/onBeforeUnmount → useEffect + store.subscribe。
 *
 * reloadTab 原先 setContent 后直接 mutate tab 的 encoding/hadBom/savedContent/lineEnding；
 * Zustand 改为单次不可变 setState（content=savedContent=normalized → 干净；同步其余字段）。
 */
import { useEffect } from 'react';
import { invoke } from '../../core/bridge/tauri';
import { listen, type UnlistenFn } from '../../core/bridge/tauri';
import { useTabsStore } from '../stores/tabs';
import { useSettingsStore } from '../stores/settings';
import type { FileReadResult } from '../types';

type FileChangedAction = 'reload' | 'overwrite' | 'cancel';
type ShowDialog = (fileName: string) => Promise<FileChangedAction>;

export function useFileWatcher(showDialog: ShowDialog) {
  useEffect(() => {
    const watchedPaths = new Set<string>();
    const pendingPaths = new Set<string>();
    let unlisten: UnlistenFn | null = null;
    let lastPathsKey = '';

    async function syncWatchedPaths() {
      const currentPaths = new Set<string>();
      for (const tab of useTabsStore.getState().tabs) {
        if ((tab.kind ?? 'text') === 'text' && tab.filePath) currentPaths.add(tab.filePath);
      }
      const toWatch = [...currentPaths].filter((p) => !watchedPaths.has(p));
      const toUnwatch = [...watchedPaths].filter((p) => !currentPaths.has(p));
      for (const path of toWatch) {
        try {
          await invoke('watch_file', { path });
          watchedPaths.add(path);
        } catch (e) {
          console.warn('watch_file failed:', e);
        }
      }
      for (const path of toUnwatch) {
        try {
          await invoke('unwatch_file', { path });
        } catch (e) {
          console.warn('unwatch_file failed:', e);
        }
        watchedPaths.delete(path);
      }
    }

    async function reloadTab(tabId: string, filePath: string) {
      const result = await invoke<FileReadResult>('read_file', { path: filePath });
      const normalized = result.content.includes('\r\n') ? result.content.replace(/\r\n/g, '\n') : result.content;
      const lineEnding: 'lf' | 'crlf' = result.content.includes('\r\n') ? 'crlf' : 'lf';
      useTabsStore.setState({
        tabs: useTabsStore.getState().tabs.map((t) =>
          t.id === tabId
            ? { ...t, content: normalized, savedContent: normalized, encoding: result.encoding, hadBom: result.had_bom, lineEnding }
            : t,
        ),
      });
    }

    async function handleFileChanged(filePath: string) {
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
            await invoke('write_file', { path: tab.filePath, content: payload, encoding: tab.encoding || 'UTF-8' });
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
        unlisten = un;
      })
      .catch((e) => console.warn('file-changed listener failed:', e));

    return () => {
      unsubTabs();
      if (unlisten) {
        unlisten();
        unlisten = null;
      }
      for (const path of watchedPaths) {
        invoke('unwatch_file', { path }).catch(() => {});
      }
      watchedPaths.clear();
    };
    // showDialog 由 App 以稳定引用传入（useCallback）；监听器只挂一次。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
