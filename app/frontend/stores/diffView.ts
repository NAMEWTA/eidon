import { create } from 'zustand';
import type { CommitMeta } from './gitHistory';

/**
 * diffView store（Zustand v5）—— 编辑器内 diff 对比的「瞬态目标」。
 *
 * 不持久化：仅记录当前正在对比的文件与历史节点。PaneContent 订阅它，
 * 当 `filePath === 当前 tab.filePath && sha` 时把编辑器主区换成 <DiffView>。
 * 对比语义见 ADR/计划 D1：旧侧 = 选中历史版本(fileAt sha)，新侧 = 编辑器实时内容(tab.content)。
 * 退出由 close() 触发（工具栏✕ / Esc / 切 tab / 切工作区，见 App.tsx）。
 */
interface DiffViewState {
  filePath: string | null;
  sha: string | null;
  shortSha: string | null;
  message: string | null;
  author: string | null;
  time: number | null;
}

interface DiffViewActions {
  /** 打开某文件对某历史节点的对比。 */
  open(filePath: string, c: CommitMeta): void;
  /** 关闭对比，回到正常编辑器。 */
  close(): void;
}

const EMPTY: DiffViewState = {
  filePath: null,
  sha: null,
  shortSha: null,
  message: null,
  author: null,
  time: null,
};

export const useDiffViewStore = create<DiffViewState & DiffViewActions>()((set) => ({
  ...EMPTY,

  open(filePath, c) {
    set({
      filePath,
      sha: c.sha,
      shortSha: c.shortSha,
      message: c.message,
      author: c.author,
      time: c.time,
    });
  },

  close() {
    set({ ...EMPTY });
  },
}));
