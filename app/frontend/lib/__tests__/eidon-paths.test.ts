import { describe, expect, it } from 'vitest';

import {
  canCreateContentInScannedL3,
  canWriteContentFileInEidonWorkspace,
  canWriteContentFileInScannedL3,
  formatPathWithLineRange,
  relativeToWorkspace,
  validateEidonWorkspaceContentPath,
} from '../eidon-paths';

describe('formatPathWithLineRange', () => {
  it('formats a single-line selection with char range', () => {
    expect(formatPathWithLineRange('README.md', { fromLine: 57, toLine: 57, fromCol: 25, toCol: 104 })).toBe(
      'README.md:57(25-104)',
    );
  });
  it('formats a multi-line selection as a line range', () => {
    expect(formatPathWithLineRange('README.md', { fromLine: 57, toLine: 98, fromCol: 1, toCol: 4 })).toBe(
      'README.md:57-98',
    );
  });
  it('formats a caret (no selection) as just the line', () => {
    expect(formatPathWithLineRange('a/b.md', { fromLine: 3, toLine: 3, fromCol: 5, toCol: 5 })).toBe('a/b.md:3');
  });
});

describe('EIDON workspace content paths', () => {
  it('computes workspace-relative paths across separators', () => {
    expect(relativeToWorkspace('/vault', '/vault/L1/L2/L3/note.md')).toBe('L1/L2/L3/note.md');
    expect(relativeToWorkspace('/vault', '/other/note.md')).toBeNull();
    expect(relativeToWorkspace('C:\\vault', 'C:\\vault\\L1\\L2\\L3\\note.md')).toBe('L1/L2/L3/note.md');
  });

  it('allows content only in L3 nodes or free folders below L3', () => {
    expect(canWriteContentFileInEidonWorkspace('loose.md')).toBe(false);
    expect(canWriteContentFileInEidonWorkspace('L1/loose.md')).toBe(false);
    expect(canWriteContentFileInEidonWorkspace('L1/L2/loose.md')).toBe(false);
    expect(canWriteContentFileInEidonWorkspace('L1/L2/L3/note.md')).toBe(true);
    expect(canWriteContentFileInEidonWorkspace('L1/L2/L3/free/note.md')).toBe(true);
  });

  it('allows FileTree content creation only at or below a scanned L3 node', () => {
    const l3Nodes = ['L1/L2/RealL3'];

    expect(canCreateContentInScannedL3('L1/L2/RealL3', l3Nodes)).toBe(true);
    expect(canCreateContentInScannedL3('L1/L2/RealL3/free', l3Nodes)).toBe(true);
    expect(canCreateContentInScannedL3('L1/L2/Plain/free', l3Nodes)).toBe(false);
    expect(canCreateContentInScannedL3('L1/L2/RealL30/free', l3Nodes)).toBe(false);
    expect(canCreateContentInScannedL3('', l3Nodes)).toBe(false);
  });

  it('validates writes against scanned L3 nodes instead of raw physical depth', () => {
    const l3Nodes = ['L1/L2/RealL3'];

    expect(canWriteContentFileInScannedL3('L1/L2/RealL3/note.md', l3Nodes)).toBe(true);
    expect(canWriteContentFileInScannedL3('L1/L2/RealL3/free/note.md', l3Nodes)).toBe(true);
    expect(canWriteContentFileInScannedL3('L1/L2/PlainDepth3/note.md', l3Nodes)).toBe(false);
    expect(validateEidonWorkspaceContentPath('/vault', '/vault/L1/L2/PlainDepth3/note.md', l3Nodes)).toMatchObject({
      ok: false,
      relativePath: 'L1/L2/PlainDepth3/note.md',
    });
    expect(validateEidonWorkspaceContentPath('/vault', '/vault/L1/L2/RealL3/note.md', l3Nodes)).toEqual({ ok: true });
  });

  it('keeps organizer allowlisted files writable with scanned L3 validation', () => {
    expect(canWriteContentFileInScannedL3('L1/README.md', [])).toBe(true);
    expect(canWriteContentFileInScannedL3('L1/L2/AGENTS.md', [])).toBe(true);
  });

  it('keeps organizer allowlisted files writable in L1/L2', () => {
    expect(canWriteContentFileInEidonWorkspace('L1/README.md')).toBe(true);
    expect(canWriteContentFileInEidonWorkspace('L1/AGENTS.md')).toBe(true);
    expect(canWriteContentFileInEidonWorkspace('L1/L2/README.md')).toBe(true);
  });

  it('does not treat EIDON system files as content files', () => {
    expect(canWriteContentFileInEidonWorkspace('.eidon/templates/template/L1.档案.v1.json')).toBe(true);
    expect(canWriteContentFileInEidonWorkspace('L1/.node/node.json')).toBe(true);
  });

  it('only rejects invalid paths inside the current workspace', () => {
    expect(validateEidonWorkspaceContentPath('/vault', '/vault/L1/illegal.md')).toMatchObject({
      ok: false,
      relativePath: 'L1/illegal.md',
    });
    expect(validateEidonWorkspaceContentPath('/vault', '/vault/L1/L2/L3/note.md')).toEqual({ ok: true });
    expect(validateEidonWorkspaceContentPath('/vault', '/tmp/note.md')).toEqual({ ok: true });
  });
});
