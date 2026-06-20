/**
 * PaneTabBar.tsx — 每窗格标签栏。
 * 标签的激活/中键关闭/未保存点/大纲切换/右键菜单（关左右其余已保存全部、显示于文件夹、分屏）；
 * 指针拖拽实现栏内重排 + 拖到窗格边缘分屏（#86：不用 HTML5 DnD，避开 Windows WebView2 拦截）。
 */
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../shared/Icons';
import { createPortal } from 'react-dom';
import { revealItemInDir } from '@bridge/ipc/opener';
import { useTabsStore } from '../../stores/tabs';
import { useTilesStore } from '../../stores/tiles';
import { useFiles } from '../../hooks/useFiles';
import { useI18n } from '../../i18n';
import type { SplitDirection } from '../../types';

const SPLIT_EDGE = 50;
const DRAG_THRESHOLD = 4;

export function PaneTabBar({ paneId, activeTabId }: { paneId: string; activeTabId: string }) {
  const { t } = useI18n();
  const files = useFiles();
  const tabs = useTabsStore((s) => s.tabs);
  const dragTabId = useTilesStore((s) => s.dragTabId);
  const tabsElRef = useRef<HTMLDivElement | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; tabId: string } | null>(null);

  const pointerStartRef = useRef<{ x: number; y: number; tabId: string } | null>(null);
  const draggingRef = useRef(false);
  const suppressClickRef = useRef(false);

  // 活动标签变化滚动入视。
  useEffect(() => {
    if (!activeTabId) return;
    const el = tabsElRef.current?.querySelector<HTMLElement>(`[data-tab-id="${activeTabId}"]`);
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeTabId]);

  // 点击外部关闭右键菜单。
  useEffect(() => {
    const onDocClick = () => setCtxMenu(null);
    document.addEventListener('click', onDocClick);
    return () => {
      document.removeEventListener('click', onDocClick);
      teardownPointer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function paneSplitAt(x: number, y: number): { paneId: string; direction: SplitDirection } | null {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    if (!el || el.closest('.pane-tabbar')) return null;
    const pane = el.closest('[data-pane-id]') as HTMLElement | null;
    const pid = pane?.getAttribute('data-pane-id');
    if (!pane || !pid) return null;
    const r = pane.getBoundingClientRect();
    const lx = x - r.left;
    const ly = y - r.top;
    if (lx < SPLIT_EDGE || lx > r.width - SPLIT_EDGE) return { paneId: pid, direction: 'horizontal' };
    if (ly < SPLIT_EDGE || ly > r.height - SPLIT_EDGE) return { paneId: pid, direction: 'vertical' };
    return null;
  }

  function tabIdAt(x: number, y: number): string | null {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    return (el?.closest('[data-tab-id]') as HTMLElement | null)?.getAttribute('data-tab-id') ?? null;
  }

  function onPointerMove(e: PointerEvent) {
    const start = pointerStartRef.current;
    if (!start) return;
    if (!draggingRef.current) {
      const moved = Math.abs(e.clientX - start.x) + Math.abs(e.clientY - start.y);
      if (moved < DRAG_THRESHOLD) return;
      draggingRef.current = true;
      useTilesStore.getState().beginTabDrag(start.tabId);
    }
    useTilesStore.getState().setDragSplit(paneSplitAt(e.clientX, e.clientY));
  }

  function teardownPointer() {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerCancel);
  }

  function onPointerCancel() {
    teardownPointer();
    pointerStartRef.current = null;
    draggingRef.current = false;
    useTilesStore.getState().endTabDrag();
  }

  function onPointerUp(e: PointerEvent) {
    teardownPointer();
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (!draggingRef.current || !start) {
      draggingRef.current = false;
      return;
    }
    draggingRef.current = false;
    suppressClickRef.current = true;
    const split = paneSplitAt(e.clientX, e.clientY);
    if (split) {
      useTilesStore.getState().splitPane(split.paneId, split.direction, start.tabId);
    } else {
      const overId = tabIdAt(e.clientX, e.clientY);
      if (overId && overId !== start.tabId) {
        const list = useTabsStore.getState().tabs;
        const targetIdx = list.findIndex((tt) => tt.id === overId);
        if (targetIdx >= 0) {
          const overEl = tabsElRef.current?.querySelector<HTMLElement>(`[data-tab-id="${overId}"]`);
          const rect = overEl?.getBoundingClientRect();
          const after = rect ? e.clientX > rect.left + rect.width / 2 : false;
          useTabsStore.getState().reorder(start.tabId, after ? targetIdx + 1 : targetIdx);
        }
      }
    }
    useTilesStore.getState().endTabDrag();
  }

  function onTabPointerDown(e: React.PointerEvent, tabId: string) {
    if (e.button !== 0) return;
    pointerStartRef.current = { x: e.clientX, y: e.clientY, tabId };
    draggingRef.current = false;
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
  }

  function onTabClick(tabId: string) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    useTilesStore.getState().setActiveTab(paneId, tabId);
  }

  async function closeMany(ids: string[]) {
    for (const id of ids) {
      if (!useTabsStore.getState().tabs.find((tt) => tt.id === id)) continue;
      await files.closeTabSafe(id);
    }
  }

  async function onTabAction(
    action: 'close' | 'closeLeft' | 'closeRight' | 'closeOthers' | 'closeSaved' | 'closeAll' | 'revealInFolder',
  ) {
    const m = ctxMenu;
    setCtxMenu(null);
    if (!m) return;
    const list = useTabsStore.getState().tabs;
    const idx = list.findIndex((tt) => tt.id === m.tabId);
    if (idx < 0) return;
    if (action === 'revealInFolder') {
      const path = list[idx]?.filePath;
      if (!path) return;
      try {
        await revealItemInDir(path);
      } catch (e) {
        console.warn('reveal failed', e);
      }
      return;
    }
    const ids = (() => {
      switch (action) {
        case 'close':
          return [m.tabId];
        case 'closeLeft':
          return list.slice(0, idx).map((x) => x.id);
        case 'closeRight':
          return list.slice(idx + 1).map((x) => x.id);
        case 'closeOthers':
          return list.filter((x) => x.id !== m.tabId).map((x) => x.id);
        case 'closeSaved':
          return list.filter((x) => x.content === x.savedContent).map((x) => x.id);
        case 'closeAll':
          return list.map((x) => x.id);
      }
      return [];
    })();
    await closeMany(ids);
  }

  const ctxFlags = (() => {
    if (!ctxMenu) return null;
    const idx = tabs.findIndex((tt) => tt.id === ctxMenu.tabId);
    if (idx < 0) return null;
    const target = tabs[idx];
    return {
      hasLeft: idx > 0,
      hasRight: idx < tabs.length - 1,
      hasOthers: tabs.length > 1,
      hasSaved: tabs.some((x) => x.id !== ctxMenu.tabId && x.content === x.savedContent),
      hasAny: tabs.length > 0,
      hasFilePath: !!target?.filePath,
    };
  })();

  const multiPane = useTilesStore.getState().allLeaves().length > 1;

  return (
    <div className="pane-tabbar">
      <div className="tabs" ref={tabsElRef}>
        {tabs.map((tt) => (
          <div
            key={tt.id}
            data-tab-id={tt.id}
            className={`tab${tt.id === activeTabId ? ' tab--active' : ''}${dragTabId === tt.id ? ' tab--dragging' : ''}`}
            onClick={() => onTabClick(tt.id)}
            onPointerDown={(e) => onTabPointerDown(e, tt.id)}
            onMouseDown={(e) => {
              if (e.button === 1) {
                e.preventDefault();
                files.closeTabSafe(tt.id);
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              setCtxMenu({ x: e.clientX, y: e.clientY, tabId: tt.id });
            }}
            title={tt.filePath || tt.fileName}
          >
            <span className="tab__name">{tt.fileName}</span>
            {tt.language === 'markdown' && (
              <button
                className={`tab__outline${tt.showOutline ? ' tab__outline--active' : ''}`}
                title={tt.showOutline ? 'Hide outline' : 'Show outline'}
                onClick={(e) => {
                  e.stopPropagation();
                  useTabsStore.getState().toggleOutline(tt.id);
                }}
              >
                ≡
              </button>
            )}
            {useTabsStore.getState().isDirty(tt.id) && <span className="tab__dot"><Icon name="circle" size={8} fill /></span>}
            <button
              className="tab__close"
              onClick={(e) => {
                e.stopPropagation();
                files.closeTabSafe(tt.id);
              }}
              aria-label={t('tabs.close')}
            >
              <Icon name="close" size={13} />
            </button>
          </div>
        ))}
      </div>
      <button className="tabbar__new" onClick={() => files.newFile()} title={t('tabs.newTab')}>
        +
      </button>

      {ctxMenu &&
        createPortal(
          <div className="ctx-menu" style={{ left: `${ctxMenu.x}px`, top: `${ctxMenu.y}px` }} onClick={(e) => e.stopPropagation()}>
            <button className="ctx-item" onClick={() => onTabAction('close')}>{t('tabMenu.close')}</button>
            <div className="ctx-sep" />
            <button className="ctx-item" disabled={!ctxFlags?.hasLeft} onClick={() => onTabAction('closeLeft')}>{t('tabMenu.closeLeft')}</button>
            <button className="ctx-item" disabled={!ctxFlags?.hasRight} onClick={() => onTabAction('closeRight')}>{t('tabMenu.closeRight')}</button>
            <button className="ctx-item" disabled={!ctxFlags?.hasOthers} onClick={() => onTabAction('closeOthers')}>{t('tabMenu.closeOthers')}</button>
            <div className="ctx-sep" />
            <button className="ctx-item" disabled={!ctxFlags?.hasSaved} onClick={() => onTabAction('closeSaved')}>{t('tabMenu.closeSaved')}</button>
            <button className="ctx-item" disabled={!ctxFlags?.hasAny} onClick={() => onTabAction('closeAll')}>{t('tabMenu.closeAll')}</button>
            <div className="ctx-sep" />
            <button className="ctx-item" disabled={!ctxFlags?.hasFilePath} onClick={() => onTabAction('revealInFolder')}>{t('tabMenu.revealInFolder')}</button>
            <div className="ctx-sep" />
            <button className="ctx-item" onClick={() => { useTilesStore.getState().splitPane(paneId, 'horizontal'); setCtxMenu(null); }}>Split Right</button>
            <button className="ctx-item" onClick={() => { useTilesStore.getState().splitPane(paneId, 'vertical'); setCtxMenu(null); }}>Split Down</button>
            {multiPane && <div className="ctx-sep" />}
            {multiPane && (
              <button className="ctx-item" onClick={() => { useTilesStore.getState().closePane(paneId); setCtxMenu(null); }}>Close Pane</button>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

export default PaneTabBar;
