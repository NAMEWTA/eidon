import { describe, expect, it } from 'vitest';

import {
  canDragFileTreeEntry,
  canDropIntoFileTreeEntry,
  canMoveFileTreeEntriesInto,
  createChildNodeLevel,
  isSameOrDescendantPath,
  promoteFolderLevel,
  relativeDepth,
} from '../filetree-menu';

describe('filetree menu capabilities', () => {
  it('maps root and structure nodes to the next L1/L2/L3 creation level', () => {
    expect(createChildNodeLevel({ relPath: '', structureLevel: null })).toBe(1);
    expect(createChildNodeLevel({ relPath: 'Archive', structureLevel: 1 })).toBe(2);
    expect(createChildNodeLevel({ relPath: 'Archive/Project', structureLevel: 2 })).toBe(3);
    expect(createChildNodeLevel({ relPath: 'Archive/Project/Entry', structureLevel: 3 })).toBeNull();
    expect(createChildNodeLevel({ relPath: 'Archive/plain', structureLevel: null })).toBeNull();
  });

  it('allows promotion only for plain folders in the first three physical node depths with legal parents', () => {
    expect(promoteFolderLevel({
      relPath: 'PlainL1',
      isDir: true,
      structureLevel: null,
      parentStructureLevel: null,
    })).toBe(1);
    expect(promoteFolderLevel({
      relPath: 'L1/PlainL2',
      isDir: true,
      structureLevel: null,
      parentStructureLevel: 1,
    })).toBe(2);
    expect(promoteFolderLevel({
      relPath: 'L1/L2/PlainL3',
      isDir: true,
      structureLevel: null,
      parentStructureLevel: 2,
    })).toBe(3);
    expect(promoteFolderLevel({
      relPath: 'L1/PlainL2',
      isDir: true,
      structureLevel: null,
      parentStructureLevel: null,
    })).toBeNull();
    expect(promoteFolderLevel({
      relPath: 'L1/L2/L3/Free',
      isDir: true,
      structureLevel: null,
      parentStructureLevel: 3,
    })).toBeNull();
  });

  it('normalizes path separators before depth checks', () => {
    expect(relativeDepth('L1\\L2/L3')).toBe(3);
  });

  it('allows loose files and free folders to be dragged into scanned L3 descendants', () => {
    const l3Nodes = ['L1/L2/L3'];

    expect(canDragFileTreeEntry({ isStructureNode: false })).toBe(true);
    expect(canDragFileTreeEntry({ isStructureNode: true })).toBe(false);
    expect(canDropIntoFileTreeEntry({ relPath: 'L1/L2/L3', isDir: true }, l3Nodes)).toBe(true);
    expect(canDropIntoFileTreeEntry({ relPath: 'L1/L2/L3/free', isDir: true }, l3Nodes)).toBe(true);
    expect(canDropIntoFileTreeEntry({ relPath: 'L1/L2', isDir: true }, l3Nodes)).toBe(false);
    expect(canDropIntoFileTreeEntry({ relPath: 'L1/L2/L3/note.md', isDir: false }, l3Nodes)).toBe(false);
  });

  it('treats dropping on an L3 descendant directory as moving into that directory', () => {
    const l3Nodes = ['L1/L2/L3'];
    const file = { path: '/vault/loose.md', isDir: false, isStructureNode: false };
    const folder = { path: '/vault/L1/L2/L3/free', relPath: 'L1/L2/L3/free', isDir: true };

    expect(canMoveFileTreeEntriesInto([file], folder, l3Nodes)).toBe(true);
  });

  it('blocks moving folders into themselves or their descendants', () => {
    const l3Nodes = ['L1/L2/L3'];
    const source = { path: '/vault/L1/L2/L3/free', isDir: true, isStructureNode: false };
    const child = { path: '/vault/L1/L2/L3/free/child', relPath: 'L1/L2/L3/free/child', isDir: true };
    const same = { path: '/vault/L1/L2/L3/free', relPath: 'L1/L2/L3/free', isDir: true };

    expect(isSameOrDescendantPath(child.path, source.path)).toBe(true);
    expect(canMoveFileTreeEntriesInto([source], child, l3Nodes)).toBe(false);
    expect(canMoveFileTreeEntriesInto([source], same, l3Nodes)).toBe(false);
  });
});
