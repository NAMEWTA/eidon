/**
 * NodeTreePicker —— 「移动到…」目标选择器（L1>L2>L3 层级目录树，取代旧的平铺 L3 列表）。
 *
 * 由节点列表（含 path/level）构建嵌套树，可展开/折叠；调用方用 `isValidTarget` 谓词决定哪些节点
 * 可作为落点（合法的可点选，非法的仅作可展开的层级分组）。供普通文件/文件夹移动与节点降级复用。
 */
import { useMemo, useState, type ReactNode } from 'react';

import type { Level } from '@shared/contracts';
import { Icon } from '../shared/Icons';

interface PickerNode {
  rel: string;
  name: string;
  level: Level;
  children: PickerNode[];
}

export interface NodeTreePickerEntry {
  path: string;
  level: Level;
}

function buildTree(nodes: NodeTreePickerEntry[]): PickerNode[] {
  const byRel = new Map<string, PickerNode>();
  const roots: PickerNode[] = [];
  const sorted = [...nodes].sort((a, b) => a.path.localeCompare(b.path));
  for (const n of sorted) {
    const node: PickerNode = { rel: n.path, name: n.path.split('/').pop() ?? n.path, level: n.level, children: [] };
    byRel.set(n.path, node);
    const parentRel = n.path.split('/').slice(0, -1).join('/');
    const parent = parentRel ? byRel.get(parentRel) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

/** 关键词过滤：返回命中节点 + 其全部祖先的 rel 集合（null = 无过滤，全部可见）。 */
function visibleSet(nodes: NodeTreePickerEntry[], keyword: string): Set<string> | null {
  if (!keyword) return null;
  const visible = new Set<string>();
  for (const n of nodes) {
    if (!n.path.toLowerCase().includes(keyword)) continue;
    const parts = n.path.split('/');
    for (let i = 1; i <= parts.length; i++) visible.add(parts.slice(0, i).join('/'));
  }
  return visible;
}

export function NodeTreePicker({
  nodes,
  isValidTarget,
  onPick,
  filter,
}: {
  nodes: NodeTreePickerEntry[];
  isValidTarget: (rel: string, level: Level) => boolean;
  onPick: (rel: string) => void;
  filter: string;
}) {
  const tree = useMemo(() => buildTree(nodes), [nodes]);
  const keyword = filter.trim().toLowerCase();
  const visible = useMemo(() => visibleSet(nodes, keyword), [nodes, keyword]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggle = (rel: string) =>
    setCollapsed((cur) => {
      const next = new Set(cur);
      if (next.has(rel)) next.delete(rel);
      else next.add(rel);
      return next;
    });

  const renderNode = (node: PickerNode, depth: number): ReactNode => {
    if (visible && !visible.has(node.rel)) return null;
    const valid = isValidTarget(node.rel, node.level);
    // 过滤时强制展开（让命中项可见）；否则按 collapsed 集合。
    const open = keyword ? true : !collapsed.has(node.rel);
    const hasChildren = node.children.length > 0;
    return (
      <div key={node.rel}>
        <div className="ftree__move-row" style={{ paddingLeft: `${depth * 14}px` }}>
          <button
            className="ftree__move-twisty"
            disabled={!hasChildren}
            onClick={() => hasChildren && toggle(node.rel)}
            aria-label={open ? 'collapse' : 'expand'}
          >
            {hasChildren ? <Icon name={open ? 'chevron-down' : 'chevron-right'} size={11} /> : null}
          </button>
          <button
            className={`ftree__move-item${valid ? '' : ' ftree__move-item--group'}`}
            disabled={!valid}
            onClick={() => valid && onPick(node.rel)}
            title={node.rel}
          >
            <span className="ftree__move-item-icon"><Icon name="folder-tree" size={14} /></span>
            <span className="ftree__move-item-name">{node.name}</span>
            <span className={`ftree__node-badge ftree__node-badge--l${node.level}`}>L{node.level}</span>
          </button>
        </div>
        {open && hasChildren && node.children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  };

  const anyVisible = visible === null ? tree.length > 0 : visible.size > 0;

  return <div className="ftree__move-list">{anyVisible ? tree.map((n) => renderNode(n, 0)) : null}</div>;
}

export default NodeTreePicker;
