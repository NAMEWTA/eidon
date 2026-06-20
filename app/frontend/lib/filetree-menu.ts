import type { Level } from '@shared/contracts';
import { canCreateContentInScannedL3 } from './eidon-paths';

export interface FileTreeMenuContext {
  relPath: string;
  isDir: boolean;
  structureLevel: Level | null;
  parentStructureLevel: Level | null;
}

const normalizeRelPath = (path: string): string =>
  path.replace(/\\/g, '/').split('/').filter(Boolean).join('/');

export function relativeDepth(path: string): number {
  return normalizeRelPath(path).split('/').filter(Boolean).length;
}

export function createChildNodeLevel(context: Pick<FileTreeMenuContext, 'relPath' | 'structureLevel'>): Level | null {
  const depth = relativeDepth(context.relPath);
  if (depth === 0) return 1;
  if (context.structureLevel === 1) return 2;
  if (context.structureLevel === 2) return 3;
  return null;
}

export function promoteFolderLevel(context: FileTreeMenuContext): Level | null {
  if (!context.isDir || context.structureLevel !== null) return null;
  const depth = relativeDepth(context.relPath);
  if (depth === 1) return 1;
  if (depth === 2 && context.parentStructureLevel === 1) return 2;
  if (depth === 3 && context.parentStructureLevel === 2) return 3;
  return null;
}

export function canInspectNode(context: Pick<FileTreeMenuContext, 'structureLevel'>): boolean {
  return context.structureLevel !== null;
}

export function canDragFileTreeEntry(context: { isStructureNode: boolean }): boolean {
  return !context.isStructureNode;
}

export function canDropIntoFileTreeEntry(
  context: Pick<FileTreeMenuContext, 'relPath' | 'isDir'>,
  l3NodePaths: Iterable<string>,
): boolean {
  return context.isDir && canCreateContentInScannedL3(context.relPath, l3NodePaths);
}

export interface FileTreeMoveEntry {
  path: string;
  isDir: boolean;
  isStructureNode: boolean;
}

export interface FileTreeDropTarget {
  path: string;
  relPath: string;
  isDir: boolean;
}

function normalizeTreePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '');
}

export function isSameOrDescendantPath(path: string, parent: string): boolean {
  const normalizedPath = normalizeTreePath(path);
  const normalizedParent = normalizeTreePath(parent);
  return normalizedPath === normalizedParent || normalizedPath.startsWith(`${normalizedParent}/`);
}

export function canMoveFileTreeEntriesInto(
  entries: FileTreeMoveEntry[],
  target: FileTreeDropTarget | null,
  l3NodePaths: Iterable<string>,
): boolean {
  if (!target || !canDropIntoFileTreeEntry(target, l3NodePaths)) return false;
  return entries.every((entry) => (
    canDragFileTreeEntry(entry) &&
    !(entry.isDir && isSameOrDescendantPath(target.path, entry.path))
  ));
}
