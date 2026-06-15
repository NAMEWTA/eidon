/**
 * useShortcuts（从 Vue composable 迁移为 React hook）。薄包装：useEffect 挂全局
 * keydown 监听，事件时构建 ctx（viewMode/是否 markdown）→ 调 M5 纯匹配器
 * `matchShortcut`，命中则 preventDefault 并按抽象动作 token 派发到 store/composable。
 *
 * runById 通过当前 useCommands() 列表查 id 执行；命令列表用 ref 持有以供监听器读取最新值。
 */
import { useEffect, useRef } from 'react';
import { useFiles } from './useFiles';
import { useExport } from './useExport';
import { useSettingsStore } from '../stores/settings';
import { useTabsStore } from '../stores/tabs';
import { useTilesStore } from '../stores/tiles';
import { useCommands, type Command } from './useCommands';
import { usePomodoroStore, getLastPreset } from '../stores/pomodoro';
import { matchShortcut, type ShortcutAction, type HookName } from '../lib/shortcuts';

interface Hooks {
  openPalette?: () => void;
  openSettings?: () => void;
  openHelp?: () => void;
  openGlobalSearch?: () => void;
  openQuickSwitcher?: () => void;
  openCjkProofread?: () => void;
}

export function useShortcuts(hooks: Hooks = {}) {
  const files = useFiles();
  const exporter = useExport();
  const commands = useCommands();
  // 用 ref 持有最新 commands / hooks，避免重复挂监听器。
  const commandsRef = useRef<Command[]>(commands);
  commandsRef.current = commands;
  const hooksRef = useRef<Hooks>(hooks);
  hooksRef.current = hooks;

  useEffect(() => {
    function runById(id: string) {
      const cmd = commandsRef.current.find((c) => c.id === id);
      if (cmd) cmd.run();
    }

    function dispatch(action: ShortcutAction) {
      switch (action.type) {
        case 'command':
          runById(action.id);
          break;
        case 'hook':
          (hooksRef.current[action.name as HookName] as (() => void) | undefined)?.();
          break;
        case 'files':
          if (action.name === 'newFile') files.newFile();
          else if (action.name === 'newTextFile') files.newTextFile();
          else if (action.name === 'saveActive') files.saveActive();
          else if (action.name === 'saveActiveAs') files.saveActiveAs();
          else if (action.name === 'closeActive') {
            const id = useTabsStore.getState().activeId;
            if (id) files.closeTabSafe(id);
          }
          break;
        case 'export':
          if (action.name === 'copyAsHtml') exporter.copyAsHtml();
          break;
        case 'settings': {
          const s = useSettingsStore.getState();
          if (action.name === 'cycleViewMode') s.cycleViewMode();
          else if (action.name === 'toggleReadingMode') s.toggleReadingMode();
          else if (action.name === 'toggleExplorer') s.toggleLeftPanelView('explorer');
          break;
        }
        case 'pomodoro': {
          const pomodoro = usePomodoroStore.getState();
          if (!pomodoro.active) {
            const last = getLastPreset();
            const min = Number.isFinite(last) && last > 0 ? last : useSettingsStore.getState().pomodoroDefaultMinutes;
            pomodoro.start(min, { notify: true });
          }
          break;
        }
        case 'tiles': {
          const tiles = useTilesStore.getState();
          if (action.name === 'splitVertical') tiles.splitPane(tiles.focusedPaneId, 'vertical');
          else if (action.name === 'splitHorizontal') tiles.splitPane(tiles.focusedPaneId, 'horizontal');
          else if (action.name === 'focusNext') tiles.focusNextPane();
          else if (action.name === 'focusPrev') tiles.focusPrevPane();
          break;
        }
        case 'previewSearch':
          window.dispatchEvent(
            new CustomEvent('eidon:preview-search', { detail: { paneId: useTilesStore.getState().focusedPaneId } }),
          );
          break;
      }
    }

    function handler(e: KeyboardEvent) {
      const settings = useSettingsStore.getState();
      const action = matchShortcut(e, {
        viewMode: settings.viewMode,
        activeTabIsMarkdown: useTabsStore.getState().activeTab()?.language === 'markdown',
      });
      if (!action) return;
      e.preventDefault();
      dispatch(action);
    }

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // files/exporter 为稳定模块级句柄；commands/hooks 走 ref。监听器只挂一次。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
