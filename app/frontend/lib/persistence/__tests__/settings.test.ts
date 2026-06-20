import { describe, it, expect } from 'vitest';
import {
  loadSettings,
  serializeSettings,
  defaultSettings,
  defaultPdfDefaults,
  mergePdfDefaults,
  buildEditorFontStack,
  type Settings,
} from '../settings';

// M1 · settings 持久化/迁移：喂入旧版/部分/被篡改的 blob，断言默认合并、
// 旧侧栏字段一次性迁移（→ 双抽屉视图）、退役键剥离、范围钳制。
describe('loadSettings — defaults & corrupt input (M1)', () => {
  it('null / 空 → 纯默认值', () => {
    expect(loadSettings(null)).toEqual(defaultSettings());
  });

  it('损坏 JSON → 纯默认值（不抛）', () => {
    expect(loadSettings('{ not json')).toEqual(defaultSettings());
  });

  it('部分 blob → 缺失键用默认值补齐', () => {
    const s = loadSettings(JSON.stringify({ theme: 'dark', fontSize: 20 }));
    expect(s.theme).toBe('dark');
    expect(s.fontSize).toBe(20);
    // 缺失键回落默认
    expect(s.wordWrap).toBe(defaultSettings().wordWrap);
    expect(s.leftPanelView).toBe('explorer'); // node 测试环境为「桌面」
    expect(s.rightPanelView).toBeNull();
    expect(s.fileTreeWidth).toBe(260);
  });

  it('语言默认中文，旧语言值回退中文', () => {
    expect(defaultSettings().language).toBe('zh');
    expect(loadSettings(JSON.stringify({ language: 'ja' })).language).toBe('zh');
    expect(loadSettings(JSON.stringify({ language: 'en' })).language).toBe('en');
  });
});

describe('loadSettings — retired keys & migrations (M1)', () => {
  it('旧侧栏/每日笔记字段被剥离，不再出现在状态中', () => {
    const s = loadSettings(JSON.stringify({
      showFileTree: true,
      rightSidebarHidden: true,
      rsPaneOrder: ['search', 'agent', 'history'],
      rightSidebarPaneHeights: { outline: 200 },
      showBacklinks: false,
      showTagsPanel: false,
      showHistoryPanel: false,
      outlineSide: 'left',
      dailyNotesFolder: 'Daily',
      dailyNotesFormat: 'YYYY-MM-DD.md',
    })) as unknown as Record<string, unknown>;
    for (const key of ['showFileTree', 'rightSidebarHidden', 'rsPaneOrder', 'rightSidebarPaneHeights', 'showBacklinks', 'showTagsPanel', 'showHistoryPanel', 'outlineSide', 'dailyNotesFolder', 'dailyNotesFormat']) {
      expect(key in s, key).toBe(false);
    }
  });

  it('迁移：旧 showFileTree:false → 左抽屉收起；true → explorer', () => {
    expect(loadSettings(JSON.stringify({ showFileTree: false })).leftPanelView).toBeNull();
    expect(loadSettings(JSON.stringify({ showFileTree: true })).leftPanelView).toBe('explorer');
  });

  it('已写过新键时不再迁移旧 showFileTree', () => {
    const s = loadSettings(JSON.stringify({ showFileTree: false, leftPanelView: 'calendar' }));
    expect(s.leftPanelView).toBe('calendar');
  });

  it('抽屉视图枚举被篡改 → 兜底默认', () => {
    expect(loadSettings(JSON.stringify({ leftPanelView: 'agent' })).leftPanelView).toBe('explorer');
    expect(loadSettings(JSON.stringify({ rightPanelView: 'daily' })).rightPanelView).toBeNull();
  });
});

describe('fileTreeWidth persistence', () => {
  it('defaults and clamps FileTree width', () => {
    expect(defaultSettings().fileTreeWidth).toBe(260);
    expect(loadSettings(JSON.stringify({ fileTreeWidth: 9999 })).fileTreeWidth).toBe(520);
    expect(loadSettings(JSON.stringify({ fileTreeWidth: 1 })).fileTreeWidth).toBe(180);
  });
});

describe('mergePdfDefaults — clamp & validate (M1)', () => {
  it('undefined / 非对象 → 全默认', () => {
    expect(mergePdfDefaults(undefined)).toEqual(defaultPdfDefaults());
    expect(mergePdfDefaults(42)).toEqual(defaultPdfDefaults());
  });

  it('越界数值钳回范围（边距 5–100）', () => {
    const m = mergePdfDefaults({ customMarginTopMm: 99999, customMarginLeftMm: -10 });
    expect(m.customMarginTopMm).toBe(100);
    expect(m.customMarginLeftMm).toBe(5);
  });

  it('非法枚举 → 默认', () => {
    const m = mergePdfDefaults({ pageSize: 'A0' as never, margin: 'Huge' as never, codeTheme: 'neon' as never });
    expect(m.pageSize).toBe('A4');
    expect(m.margin).toBe('Normal');
    expect(m.codeTheme).toBe('preview');
  });

  it('合法值原样保留', () => {
    const m = mergePdfDefaults({ pageSize: 'Letter', fontSize: 13, footer: false });
    expect(m.pageSize).toBe('Letter');
    expect(m.fontSize).toBe(13);
    expect(m.footer).toBe(false);
  });

  it('fontSize 越界钳到 9–16', () => {
    expect(mergePdfDefaults({ fontSize: 99 }).fontSize).toBe(16);
    expect(mergePdfDefaults({ fontSize: 1 }).fontSize).toBe(9);
  });

  it('loadSettings 对 pdfDefaults 走钳制合并', () => {
    const s = loadSettings(JSON.stringify({ pdfDefaults: { customMarginTopMm: 5000 } }));
    expect(s.pdfDefaults.customMarginTopMm).toBe(100);
    expect(s.pdfDefaults.pageSize).toBe('A4');
  });
});

describe('serializeSettings — round-trip (M1)', () => {
  it('serialize→load 稳定（含抽屉视图）', () => {
    const s: Settings = {
      ...defaultSettings(),
      theme: 'dark',
      fontSize: 22,
      leftPanelView: 'calendar',
      rightPanelView: 'history',
    };
    const back = loadSettings(serializeSettings(s));
    expect(back).toEqual(s);
  });
});

describe('buildEditorFontStack (M1/M3)', () => {
  it('空 → CJK 兜底 + sans-serif', () => {
    expect(buildEditorFontStack('   ')).toBe(
      '"PingFang SC", "PingFang TC", "Hiragino Sans GB", "Microsoft YaHei", "Heiti SC", "Noto Sans CJK SC", sans-serif',
    );
  });

  it('含逗号（整段字体栈）→ 原样 + CJK 兜底', () => {
    const out = buildEditorFontStack('Foo, Bar');
    expect(out.startsWith('Foo, Bar, ')).toBe(true);
    expect(out).toContain('PingFang SC');
  });

  it('含空格的单一字体名 → 加引号', () => {
    expect(buildEditorFontStack('Comic Sans')).toContain('"Comic Sans", ');
  });

  it('单一无空格字体名 → 不加引号，附 mono 兜底', () => {
    const out = buildEditorFontStack('JetBrainsMono');
    expect(out.startsWith('JetBrainsMono, ')).toBe(true);
    expect(out).toContain('monospace');
  });
});
