import { describe, it, expect } from 'vitest';
import { vimExt, lineNumberExt, wrapExt, richExtensionsFor } from '../cm-config';
import type { Tab } from '../../types';

// M4 · CodeMirror 配置构建器（部分测）：断言「设置 → 扩展集合」的存在性/分支，
// 不测 CM 内部渲染。空数组 = 关闭；非空 = 启用。
const mkTab = (over: Partial<Tab>): Tab =>
  ({
    id: 't1',
    fileName: 'a.md',
    content: '',
    savedContent: '',
    encoding: 'UTF-8',
    language: 'markdown',
    hadBom: false,
    ...over,
  }) as Tab;

describe('cm-config branch helpers (M4)', () => {
  it('vimExt：off → []，on → 非空', () => {
    expect(vimExt(false)).toEqual([]);
    expect(vimExt(true)).not.toEqual([]);
  });

  it('lineNumberExt：off → []，on → 非空', () => {
    expect(lineNumberExt(false)).toEqual([]);
    expect(lineNumberExt(true)).not.toEqual([]);
  });

  it('wrapExt：off → []，on → 非空', () => {
    expect(wrapExt(false)).toEqual([]);
    expect(wrapExt(true)).not.toEqual([]);
  });

  it('richExtensionsFor：非 markdown → []', () => {
    expect(richExtensionsFor(mkTab({ language: 'plaintext' }), { editorRender: 'source' })).toEqual([]);
  });

  it('richExtensionsFor：editorRender=live → 非空（所见即所得）', () => {
    expect(richExtensionsFor(mkTab({}), { editorRender: 'live' })).not.toEqual([]);
  });

  it('richExtensionsFor：editorRender=source → 非空（纯源码高亮，与布局无关）', () => {
    expect(richExtensionsFor(mkTab({}), { editorRender: 'source' })).not.toEqual([]);
  });
});
