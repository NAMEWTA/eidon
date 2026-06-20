import { beforeEach, describe, expect, it, vi } from 'vitest';

const invokeMock = vi.hoisted(() => vi.fn());
const openDialogMock = vi.hoisted(() => vi.fn());
const saveDialogMock = vi.hoisted(() => vi.fn());

// 模拟 bridge 客户端：@bridge/ipc 桶经 ./client 再导出 eidonInvoke，故 mock client 即拦截全部通道调用
// （nodesBridge/todosBridge 等真实包装内部也走这个 mock）。
vi.mock('@bridge/ipc/client', () => ({
  eidonInvoke: invokeMock,
}));

vi.mock('@bridge/ipc/platform', () => ({
  documentDir: vi.fn(),
  join: vi.fn(async (...parts: string[]) => parts.join('/')),
}));

vi.mock('@bridge/ipc/dialog', () => ({
  open: openDialogMock,
  save: saveDialogMock,
}));

import { openPath, useFiles } from '../useFiles';
import { useSettingsStore } from '../../stores/settings';
import { useTabsStore } from '../../stores/tabs';
import { useToastsStore } from '../../stores/toasts';
import { useWorkspaceStore } from '../../stores/workspace';

describe('openPath EIDON content guard', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    openDialogMock.mockReset();
    saveDialogMock.mockReset();

    useSettingsStore.setState({
      leftPanelView: 'explorer',
    });
    useTabsStore.setState({ tabs: [], activeId: '' });
    useToastsStore.setState({ items: [] });
    useWorkspaceStore.setState({
      currentFolder: '/vault',
      recentFiles: [],
      recentFolders: [],
    });
  });

  it('opens existing violation files directly under L1 or L2 so users can inspect and migrate them', async () => {
    invokeMock.mockResolvedValue({
      content: '# legacy',
      encoding: 'UTF-8',
      language: 'markdown',
      hadBom: false,
    });

    await openPath('/vault/L1/illegal.md');

    expect(invokeMock).toHaveBeenCalledWith('editor:readFile', { path: '/vault/L1/illegal.md' });
    expect(useTabsStore.getState().tabs[0]).toMatchObject({
      filePath: '/vault/L1/illegal.md',
      content: '# legacy',
    });
  });

  it('opens content files in an L3 node normally', async () => {
    invokeMock.mockResolvedValue({
      content: '# Note',
      encoding: 'UTF-8',
      language: 'markdown',
      hadBom: false,
    });

    await openPath('/vault/L1/L2/L3/note.md');

    expect(invokeMock).toHaveBeenCalledWith('editor:readFile', { path: '/vault/L1/L2/L3/note.md' });
    expect(useTabsStore.getState().tabs[0]).toMatchObject({
      filePath: '/vault/L1/L2/L3/note.md',
      content: '# Note',
    });
  });

  it('does not reject files outside the current workspace', async () => {
    invokeMock.mockResolvedValue({
      content: 'outside',
      encoding: 'UTF-8',
      language: 'plaintext',
      hadBom: false,
    });

    await openPath('/other/L1/illegal.md');

    expect(invokeMock).toHaveBeenCalledWith('editor:readFile', { path: '/other/L1/illegal.md' });
    expect(useTabsStore.getState().tabs[0]?.filePath).toBe('/other/L1/illegal.md');
  });

  it('opens image, PDF, and Office files as non-text tabs without conversion', async () => {
    await openPath('/vault/L1/L2/L3/image.png');
    await openPath('/vault/L1/L2/L3/manual.pdf');
    await openPath('/vault/L1/L2/L3/report.docx');

    expect(invokeMock).not.toHaveBeenCalled();
    expect(useTabsStore.getState().tabs.map((tab) => [tab.fileName, tab.kind])).toEqual([
      ['image.png', 'image'],
      ['manual.pdf', 'pdf'],
      ['report.docx', 'unsupported'],
    ]);
  });

  it('saves an already-open violation file without blocking manual cleanup work', async () => {
    useTabsStore.setState({
      activeId: 'tab-illegal',
      tabs: [{
        id: 'tab-illegal',
        filePath: '/vault/L1/illegal.md',
        fileName: 'illegal.md',
        content: '# changed',
        savedContent: '# original',
        encoding: 'UTF-8',
        language: 'markdown',
        hadBom: false,
      }],
    });

    await useFiles().saveActive();

    // 保存未被违规路径守卫阻断（editor:writeFile 被调用）；且 md 保存自动注入 created 时间戳，正文原样保留。
    // 注：`updated` 字段已于 2026-06 从 UNIVERSAL_FIELDS 移除（见 lib/frontmatter.ts），不再断言。
    expect(invokeMock).toHaveBeenCalledWith('editor:writeFile', expect.objectContaining({
      path: '/vault/L1/illegal.md',
      encoding: 'UTF-8',
      content: expect.stringContaining('# changed'),
    }));
    const writeCall = invokeMock.mock.calls.find(([cmd]) => cmd === 'editor:writeFile');
    expect(writeCall?.[1].content).toMatch(/created: \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
  });

  it('stamps goal_set_at before writing so the disk bytes equal savedContent', async () => {
    // 回归：带写作目标但缺 goal_set_at 的 md，保存须在写盘**之前**打戳，
    // 使落盘字节与内存 savedContent 完全一致（旧实现盘上未打戳、savedContent 已打戳 → 分叉）。
    const body = [
      '---',
      'created: 2026-01-01 00:00:00',
      'goal: 500',
      '---',
      '',
      '# Draft',
      '',
      'Some words here.',
      '',
    ].join('\n');
    useTabsStore.setState({
      activeId: 'tab-goal',
      tabs: [{
        id: 'tab-goal',
        filePath: '/vault/L1/L2/L3/draft.md',
        fileName: 'draft.md',
        content: body,
        savedContent: body,
        encoding: 'UTF-8',
        language: 'markdown',
        hadBom: false,
      }],
    });

    await useFiles().saveActive();

    const writeCall = invokeMock.mock.calls.find(([cmd]) => cmd === 'editor:writeFile');
    expect(writeCall).toBeTruthy();
    const writtenBytes = writeCall![1].content as string;
    const { savedContent } = useTabsStore.getState().tabs[0];

    // 核心不变式：落盘字节 === savedContent（不再分叉）。
    expect(writtenBytes).toBe(savedContent);
    // 且 goal_set_at 确实是在写盘前注入的（盘与内存都带戳）。
    expect(writtenBytes).toMatch(/^goal_set_at: \d{4}-\d{2}-\d{2}$/m);
    expect(savedContent).toMatch(/^goal_set_at: \d{4}-\d{2}-\d{2}$/m);
  });
});
