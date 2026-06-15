import { describe, it, expect } from 'vitest';
import { filterCommands, type CommandLike } from '../command-filter';

// M6 · 命令面板过滤：空查询返回原序全集；多 token AND；命中 title/id/hint。
const cmds: CommandLike[] = [
  { id: 'file.new', title: 'New File', hint: 'Create a markdown file' },
  { id: 'view.toggleOutline', title: 'View: Toggle Outline' },
  { id: 'export.pdf', title: 'Export PDF', hint: 'print to pdf' },
];

describe('filterCommands (M6)', () => {
  it('空查询 → 原序全集（拷贝）', () => {
    const out = filterCommands(cmds, '');
    expect(out.map((c) => c.id)).toEqual(['file.new', 'view.toggleOutline', 'export.pdf']);
    expect(out).not.toBe(cmds);
  });

  it('仅空白查询 → 全集', () => {
    expect(filterCommands(cmds, '   ').length).toBe(3);
  });

  it('单 token 命中 title', () => {
    expect(filterCommands(cmds, 'outline').map((c) => c.id)).toEqual(['view.toggleOutline']);
  });

  it('命中 id', () => {
    expect(filterCommands(cmds, 'export.pdf').map((c) => c.id)).toEqual(['export.pdf']);
  });

  it('命中 hint', () => {
    expect(filterCommands(cmds, 'markdown').map((c) => c.id)).toEqual(['file.new']);
  });

  it('多 token AND 语义', () => {
    expect(filterCommands(cmds, 'export pdf').map((c) => c.id)).toEqual(['export.pdf']);
    expect(filterCommands(cmds, 'view file').map((c) => c.id)).toEqual([]);
  });

  it('大小写不敏感', () => {
    expect(filterCommands(cmds, 'NEW').map((c) => c.id)).toEqual(['file.new']);
  });

  it('保留注册顺序', () => {
    expect(filterCommands(cmds, 'e').map((c) => c.id)).toEqual(['file.new', 'view.toggleOutline', 'export.pdf']);
  });
});
