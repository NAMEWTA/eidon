import { describe, it, expect } from 'vitest';
import {
  VIEW_MODE_CYCLE,
  nextViewMode,
  lastNonReadingFor,
  exitReadingTarget,
  clampGlobalZoom,
} from '../reducers';

// M3 · 纯状态转换：视图模式循环、reading 进出记忆、zoom 钳制。
// （右侧栏快照/moveRsPane 已随双抽屉重构退役。）
describe('viewMode cycle (M3)', () => {
  it('循环顺序固定 edit→split→preview→reading→edit（布局维度；编辑器渲染由独立开关控制）', () => {
    expect(VIEW_MODE_CYCLE).toEqual(['edit', 'split', 'preview', 'reading']);
    expect(nextViewMode('edit')).toBe('split');
    expect(nextViewMode('split')).toBe('preview');
    expect(nextViewMode('preview')).toBe('reading');
    expect(nextViewMode('reading')).toBe('edit');
  });

  it('lastNonReadingFor：切非 reading 记住目标，切 reading 保持原记忆', () => {
    expect(lastNonReadingFor('split', 'split')).toBe('split');
    expect(lastNonReadingFor('reading', 'split')).toBe('split');
  });

  it('exitReadingTarget：恢复上一个非 reading；哨兵为 reading 时兜底 edit', () => {
    expect(exitReadingTarget('split')).toBe('split');
    expect(exitReadingTarget('reading')).toBe('edit');
  });
});

describe('clampGlobalZoom (M3)', () => {
  it('钳到 [0.75, 2.5]', () => {
    expect(clampGlobalZoom(0.1)).toBe(0.75);
    expect(clampGlobalZoom(9)).toBe(2.5);
  });
  it('步进 0.05 取整（防浮点漂移）', () => {
    expect(clampGlobalZoom(1.13)).toBe(1.15);
    expect(clampGlobalZoom(1.0)).toBe(1.0);
  });
  it('NaN/0 → 视为 1', () => {
    expect(clampGlobalZoom(0)).toBe(1);
    expect(clampGlobalZoom(NaN)).toBe(1);
  });
});
