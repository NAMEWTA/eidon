/**
 * M3 · 纯状态转换（reducers）。框架无关、可在 Node 单测。
 *
 * 把 settings store 里**非平凡**的 action 逻辑抽成纯函数：视图模式循环 /
 * reading 进出与记忆、globalZoom 钳制。Zustand action 调用纯函数后再 `set(...)`。
 * （旧右侧栏快照/重排 reducers 已随双抽屉重构退役。）
 */
import type { ViewMode } from '../types';

/** 循环顺序（布局）：edit → split → preview → reading → edit。
 *  编辑器渲染（source / live）是正交维度，由顶栏「源码 ⇄ 实时编辑」开关独立控制，不在此循环。 */
export const VIEW_MODE_CYCLE: ViewMode[] = ['edit', 'split', 'preview', 'reading'];

/** 循环切换：返回下一个视图模式。 */
export function nextViewMode(current: ViewMode): ViewMode {
  const i = VIEW_MODE_CYCLE.indexOf(current);
  return VIEW_MODE_CYCLE[(i + 1) % VIEW_MODE_CYCLE.length];
}

/**
 * setViewMode 时 `lastNonReadingViewMode` 的更新值：切到非 reading 模式则记住它，
 * 切到 reading 则保持原记忆不变（供 Esc / 关闭按钮恢复）。
 * （等价于旧实现里那两个分支的净效果。）
 */
export function lastNonReadingFor(target: ViewMode, prevLastNonReading: ViewMode): ViewMode {
  return target !== 'reading' ? target : prevLastNonReading;
}

/** exitReadingMode 的目标：恢复上一个非 reading 模式；哨兵异常为 reading 时兜底 edit。 */
export function exitReadingTarget(lastNonReading: ViewMode): ViewMode {
  return lastNonReading === 'reading' ? 'edit' : lastNonReading;
}

/** globalZoom 钳制：0.75–2.5，步进 0.05（防浮点漂移）。 */
export function clampGlobalZoom(n: number): number {
  return Math.max(0.75, Math.min(2.5, Math.round((n || 1) * 20) / 20));
}
