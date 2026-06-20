/**
 * TileDivider.tsx — 窗格分屏拖拽分隔条。
 * 拖拽改 branch 的两侧 sizes（百分比）；active 高亮。逻辑逐字保留。
 */
import { useState } from 'react';
import { useTilesStore } from '../../stores/tiles';
import type { SplitDirection, TileNode } from '../../types';

export function TileDivider({ branchId, direction }: { branchId: string; direction: SplitDirection }) {
  const [active, setActive] = useState(false);

  function findBranch(): { sizes: [number, number] } | null {
    function walk(node: TileNode): TileNode | null {
      if (node.id === branchId) return node;
      if (node.type === 'leaf') return null;
      return walk(node.children[0]) ?? walk(node.children[1]);
    }
    const found = walk(useTilesStore.getState().root);
    return found && found.type === 'branch' ? found : null;
  }

  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    setActive(true);
    const startPos = direction === 'horizontal' ? e.clientX : e.clientY;
    const branch = findBranch();
    const startSizes: [number, number] = branch ? [...branch.sizes] : [50, 50];
    const container = (e.target as HTMLElement).parentElement;
    const totalSize = container
      ? (direction === 'horizontal' ? container.clientWidth : container.clientHeight) - 4
      : 1000;

    function onMove(ev: MouseEvent) {
      const currentPos = direction === 'horizontal' ? ev.clientX : ev.clientY;
      const delta = currentPos - startPos;
      const deltaPercent = (delta / totalSize) * 100;
      const newSizes: [number, number] = [startSizes[0] + deltaPercent, startSizes[1] - deltaPercent];
      useTilesStore.getState().setSizes(branchId, newSizes);
    }
    function onUp() {
      setActive(false);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  return (
    <div
      className={`tile-divider tile-divider--${direction}${active ? ' tile-divider--active' : ''}`}
      onMouseDown={onMouseDown}
    />
  );
}

export default TileDivider;
