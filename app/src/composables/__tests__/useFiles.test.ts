import { beforeEach, describe, expect, it, vi } from 'vitest';

const invokeMock = vi.hoisted(() => vi.fn());
const openDialogMock = vi.hoisted(() => vi.fn());
const saveDialogMock = vi.hoisted(() => vi.fn());

vi.mock('../../../core/bridge/tauri', () => ({
  invoke: invokeMock,
  documentDir: vi.fn(),
  join: vi.fn(async (...parts: string[]) => parts.join('/')),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
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
      revealInFileTreeOnOpen: false,
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
      had_bom: false,
    });

    await openPath('/vault/L1/illegal.md');

    expect(invokeMock).toHaveBeenCalledWith('read_file', { path: '/vault/L1/illegal.md' });
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
      had_bom: false,
    });

    await openPath('/vault/L1/L2/L3/note.md');

    expect(invokeMock).toHaveBeenCalledWith('read_file', { path: '/vault/L1/L2/L3/note.md' });
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
      had_bom: false,
    });

    await openPath('/other/L1/illegal.md');

    expect(invokeMock).toHaveBeenCalledWith('read_file', { path: '/other/L1/illegal.md' });
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

    // 保存未被违规路径守卫阻断（write_file 被调用）；且 md 保存自动注入 created/updated 时间戳，
    // 正文原样保留。
    expect(invokeMock).toHaveBeenCalledWith('write_file', expect.objectContaining({
      path: '/vault/L1/illegal.md',
      encoding: 'UTF-8',
      content: expect.stringContaining('# changed'),
    }));
    const writeCall = invokeMock.mock.calls.find(([cmd]) => cmd === 'write_file');
    expect(writeCall?.[1].content).toMatch(/created: \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
    expect(writeCall?.[1].content).toMatch(/updated: \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
  });
});
