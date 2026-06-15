import { Extension } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import type { Theme } from '../types';

// ============================================================
// 主题（仅 light / dark）—— 完全对齐 docs/DESGIN.md 暖纸+陶土设计系统。
// 浅色走 CSS 变量（暖纸 parchment），深色编辑器复用 One Dark（暖近黑）。
// ============================================================

// Map theme name → CodeMirror extension (empty = use CSS vars only)
export function cmThemeFor(theme: Theme): Extension {
  return theme === 'dark' ? oneDark : [];
}

// data-theme 值驱动 UI 外壳（工具栏 / 标签 / 状态栏）的主题变量。
export function dataThemeFor(theme: Theme): string {
  return theme;
}

export const themeLabels: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];
