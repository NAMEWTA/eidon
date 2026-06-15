/**
 * M5 · 快捷键匹配（纯函数，框架无关，可单测）。
 *
 * 把 useShortcuts.handler 的 key→动作判定逐字抽成纯匹配器：输入归一化的键事件
 * + 运行时上下文（viewMode/是否 markdown），输出抽象动作 token 或 null。
 * 「薄 hook」（Phase 3.6 的 useShortcuts）只负责挂 listener、提供 ctx、对非空结果
 * preventDefault 并按 token 派发到具体 store/composable 方法。
 *
 * 约定：返回非空 ⇒ 命中并应 preventDefault（与 Vue 版「命中分支即 preventDefault」一致）；
 * 返回 null ⇒ 未命中（不拦截），含 ⌘F 在非 preview/markdown 时的「空动作」情形。
 */
import type { ViewMode } from '../types';

export interface ShortcutEvent {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

export interface ShortcutCtx {
  viewMode: ViewMode;
  activeTabIsMarkdown: boolean;
}

export type HookName =
  | 'openPalette'
  | 'openSettings'
  | 'openHelp'
  | 'openGlobalSearch'
  | 'openQuickSwitcher'
  | 'openCjkProofread';

export type ShortcutAction =
  | { type: 'command'; id: string }
  | { type: 'hook'; name: HookName }
  | { type: 'files'; name: 'newFile' | 'newTextFile' | 'saveActive' | 'saveActiveAs' | 'closeActive' }
  | { type: 'export'; name: 'copyAsHtml' }
  | { type: 'settings'; name: 'cycleViewMode' | 'toggleReadingMode' | 'toggleExplorer' }
  | { type: 'pomodoro'; name: 'startLastPreset' }
  | { type: 'tiles'; name: 'splitVertical' | 'splitHorizontal' | 'focusNext' | 'focusPrev' }
  | { type: 'previewSearch' };

export function matchShortcut(e: ShortcutEvent, ctx: ShortcutCtx): ShortcutAction | null {
  // F1（无修饰）→ help
  if (e.key === 'F1') return { type: 'hook', name: 'openHelp' };

  const mod = e.ctrlKey || e.metaKey;
  if (!mod) return null;
  const k = e.key.toLowerCase();

  if (e.key === ',') return { type: 'hook', name: 'openSettings' };
  if (e.key === '/') return { type: 'hook', name: 'openHelp' };

  if (k === 'n' && e.altKey) return { type: 'files', name: 'newTextFile' };
  if (k === 'n') return { type: 'files', name: 'newFile' };
  if (k === 'o' && e.shiftKey) return { type: 'command', id: 'view.toggleOutline' };
  if (k === 'c' && e.shiftKey) return { type: 'export', name: 'copyAsHtml' };
  if (k === 's' && e.shiftKey) return { type: 'files', name: 'saveActiveAs' };
  if (k === 's') return { type: 'files', name: 'saveActive' };
  if (k === 'w') return { type: 'files', name: 'closeActive' };
  if (k === 't' && e.shiftKey && !e.altKey) return { type: 'command', id: 'todos.openPanel' };
  if (k === 't' && !e.shiftKey && !e.altKey) return { type: 'files', name: 'newFile' };
  if (k === 'p' && e.shiftKey && e.altKey) return { type: 'command', id: 'export.pdfPrint' };
  if (k === 'p' && e.shiftKey) return { type: 'settings', name: 'cycleViewMode' };
  if (k === 'p') return { type: 'hook', name: 'openQuickSwitcher' };
  if (k === 'r' && e.shiftKey) return { type: 'settings', name: 'toggleReadingMode' };
  if (k === 'k' && e.shiftKey) return { type: 'hook', name: 'openPalette' };
  if (k === 'j' && e.shiftKey) return { type: 'hook', name: 'openCjkProofread' };
  if (k === 'f' && e.shiftKey) return { type: 'hook', name: 'openGlobalSearch' };
  if (k === 'f' && !e.shiftKey) {
    // ⌘F 仅在 preview + markdown 时触发预览内搜索；否则不拦截。
    if (ctx.viewMode === 'preview' && ctx.activeTabIsMarkdown) return { type: 'previewSearch' };
    return null;
  }
  // Ctrl+B = 切换左抽屉文件资源；旧 Ctrl+Alt+B（右侧栏整体开关）已随双抽屉重构退役。
  if (k === 'b' && !e.altKey) return { type: 'settings', name: 'toggleExplorer' };
  if (k === 'l' && e.altKey) return { type: 'command', id: 'format.markdown' };
  if (k === 'd' && !e.shiftKey && !e.altKey) return { type: 'command', id: 'daily.openToday' };
  if (k === 'z' && e.shiftKey && !e.altKey) return { type: 'pomodoro', name: 'startLastPreset' };

  // 平铺布局快捷键（与上面互斥；键不重叠）。
  if (e.key === '\\') return e.shiftKey ? { type: 'tiles', name: 'splitVertical' } : { type: 'tiles', name: 'splitHorizontal' };
  if (k === 'arrowright' && e.altKey) return { type: 'tiles', name: 'focusNext' };
  if (k === 'arrowleft' && e.altKey) return { type: 'tiles', name: 'focusPrev' };

  return null;
}
