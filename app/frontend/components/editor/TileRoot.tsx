/**
 * TileRoot.tsx — 窗格平铺树的递归渲染。
 * leaf → PaneHost；branch → flex 容器 + 两个 TileRoot + TileDivider。
 */
import { PaneHost } from './PaneHost';
import { TileDivider } from './TileDivider';
import type { TileNode } from '../../types';

export interface TileRootProps {
  node: TileNode;
  onCursor: (line: number, col: number) => void;
  onSelection: (text: string) => void;
}

export function TileRoot({ node, onCursor, onSelection }: TileRootProps) {
  if (node.type === 'leaf') {
    return <PaneHost paneId={node.id} activeTabId={node.activeTabId} onCursor={onCursor} onSelection={onSelection} />;
  }
  return (
    <div className={`tile-branch tile-branch--${node.direction}`}>
      <div className="tile-child" style={{ flex: `0 0 ${node.sizes[0]}%` }}>
        <TileRoot node={node.children[0]} onCursor={onCursor} onSelection={onSelection} />
      </div>
      <TileDivider branchId={node.id} direction={node.direction} />
      <div className="tile-child" style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
        <TileRoot node={node.children[1]} onCursor={onCursor} onSelection={onSelection} />
      </div>
    </div>
  );
}

export default TileRoot;
