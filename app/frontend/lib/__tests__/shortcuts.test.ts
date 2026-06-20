import { describe, it, expect } from 'vitest';
import { matchShortcut, type ShortcutEvent, type ShortcutCtx } from '../shortcuts';

// M5 · 快捷键匹配。覆盖修饰组合、条件分支（⌘F preview）、平铺、未命中。
const ev = (over: Partial<ShortcutEvent>): ShortcutEvent => ({
  key: '',
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...over,
});
const ctx = (over: Partial<ShortcutCtx> = {}): ShortcutCtx => ({
  viewMode: 'split',
  activeTabIsMarkdown: true,
  ...over,
});

describe('matchShortcut (M5)', () => {
  it('F1（无修饰）→ openHelp', () => {
    expect(matchShortcut(ev({ key: 'F1' }), ctx())).toEqual({ type: 'hook', name: 'openHelp' });
  });

  it('无修饰其它键 → null', () => {
    expect(matchShortcut(ev({ key: 'n' }), ctx())).toBeNull();
  });

  it('⌘, → settings；⌘/ → help', () => {
    expect(matchShortcut(ev({ key: ',', metaKey: true }), ctx())).toEqual({ type: 'hook', name: 'openSettings' });
    expect(matchShortcut(ev({ key: '/', ctrlKey: true }), ctx())).toEqual({ type: 'hook', name: 'openHelp' });
  });

  it('⌘N / ⌥⌘N 顺序正确', () => {
    expect(matchShortcut(ev({ key: 'n', metaKey: true }), ctx())).toEqual({ type: 'files', name: 'newFile' });
    expect(matchShortcut(ev({ key: 'n', metaKey: true, altKey: true }), ctx())).toEqual({ type: 'files', name: 'newTextFile' });
  });

  it('⌘S / ⌘⇧S', () => {
    expect(matchShortcut(ev({ key: 's', metaKey: true }), ctx())).toEqual({ type: 'files', name: 'saveActive' });
    expect(matchShortcut(ev({ key: 's', metaKey: true, shiftKey: true }), ctx())).toEqual({ type: 'files', name: 'saveActiveAs' });
  });

  it('⌘P 系列：plain/⇧/⇧⌥ 分支', () => {
    expect(matchShortcut(ev({ key: 'p', metaKey: true }), ctx())).toEqual({ type: 'hook', name: 'openQuickSwitcher' });
    expect(matchShortcut(ev({ key: 'p', metaKey: true, shiftKey: true }), ctx())).toEqual({ type: 'settings', name: 'cycleViewMode' });
    expect(matchShortcut(ev({ key: 'p', metaKey: true, shiftKey: true, altKey: true }), ctx())).toEqual({ type: 'command', id: 'export.pdfPrint' });
  });

  it('⌘⇧F → 全局搜索', () => {
    expect(matchShortcut(ev({ key: 'f', metaKey: true, shiftKey: true }), ctx())).toEqual({ type: 'hook', name: 'openGlobalSearch' });
  });

  it('⌘F：仅 preview + markdown 触发预览搜索，否则 null', () => {
    expect(matchShortcut(ev({ key: 'f', metaKey: true }), ctx({ viewMode: 'preview', activeTabIsMarkdown: true }))).toEqual({ type: 'previewSearch' });
    expect(matchShortcut(ev({ key: 'f', metaKey: true }), ctx({ viewMode: 'split' }))).toBeNull();
    expect(matchShortcut(ev({ key: 'f', metaKey: true }), ctx({ viewMode: 'preview', activeTabIsMarkdown: false }))).toBeNull();
  });

  it('⌘B → 左抽屉文件资源；⌥⌘B 已退役不再拦截', () => {
    expect(matchShortcut(ev({ key: 'b', metaKey: true }), ctx())).toEqual({ type: 'settings', name: 'toggleExplorer' });
    expect(matchShortcut(ev({ key: 'b', metaKey: true, altKey: true }), ctx())).toBeNull();
  });

  it('平铺：⌘\\ / ⌘⇧\\ / ⌥⌘→ / ⌥⌘←', () => {
    expect(matchShortcut(ev({ key: '\\', metaKey: true }), ctx())).toEqual({ type: 'tiles', name: 'splitHorizontal' });
    expect(matchShortcut(ev({ key: '\\', metaKey: true, shiftKey: true }), ctx())).toEqual({ type: 'tiles', name: 'splitVertical' });
    expect(matchShortcut(ev({ key: 'ArrowRight', metaKey: true, altKey: true }), ctx())).toEqual({ type: 'tiles', name: 'focusNext' });
    expect(matchShortcut(ev({ key: 'ArrowLeft', metaKey: true, altKey: true }), ctx())).toEqual({ type: 'tiles', name: 'focusPrev' });
  });

  it('⌘⇧Z → pomodoro startLastPreset；⌘E 未占用；⌘D → daily', () => {
    expect(matchShortcut(ev({ key: 'z', metaKey: true, shiftKey: true }), ctx())).toEqual({ type: 'pomodoro', name: 'startLastPreset' });
    expect(matchShortcut(ev({ key: 'e', metaKey: true }), ctx())).toBeNull();
    expect(matchShortcut(ev({ key: 'd', metaKey: true }), ctx())).toEqual({ type: 'command', id: 'daily.openToday' });
  });

  it('未知 mod 组合 → null', () => {
    expect(matchShortcut(ev({ key: 'q', metaKey: true }), ctx())).toBeNull();
  });
});
