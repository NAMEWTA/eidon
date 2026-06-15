/**
 * PaneHost.tsx — 单个窗格宿主（从 PaneHost.vue 迁移）。
 * 渲染 PaneTabBar + PaneContent；focusin/click 设为聚焦窗格；拖拽分屏的 drop-zone 叠层。
 */
import { PaneTabBar } from './PaneTabBar';
import { PaneContent } from './PaneContent';
import { useTabsStore } from '../stores/tabs';
import { useTilesStore } from '../stores/tiles';
import type { SplitDirection } from '../types';

export interface PaneHostProps {
  paneId: string;
  activeTabId: string;
  onCursor: (line: number, col: number) => void;
  onSelection: (text: string) => void;
}

export function PaneHost({ paneId, activeTabId, onCursor, onSelection }: PaneHostProps) {
  const activeTab = useTabsStore((s) => s.tabs.find((t) => t.id === activeTabId));
  const focusedPaneId = useTilesStore((s) => s.focusedPaneId);
  const dragSplit = useTilesStore((s) => s.dragSplit);
  const dropZone: SplitDirection | null = dragSplit && dragSplit.paneId === paneId ? dragSplit.direction : null;

  return (
    <div
      className={`pane-host${focusedPaneId === paneId ? ' pane-host--focused' : ''}`}
      data-pane-id={paneId}
      onFocus={() => useTilesStore.getState().setFocusedPane(paneId)}
      onClick={() => useTilesStore.getState().setFocusedPane(paneId)}
    >
      <PaneTabBar paneId={paneId} activeTabId={activeTabId} />
      <PaneContent paneId={paneId} tab={activeTab} onCursor={onCursor} onSelection={onSelection} />
      {dropZone === 'horizontal' && <div className="drop-zone drop-zone--left" />}
      {dropZone === 'horizontal' && <div className="drop-zone drop-zone--right" />}
      {dropZone === 'vertical' && <div className="drop-zone drop-zone--top" />}
      {dropZone === 'vertical' && <div className="drop-zone drop-zone--bottom" />}
    </div>
  );
}

export default PaneHost;
