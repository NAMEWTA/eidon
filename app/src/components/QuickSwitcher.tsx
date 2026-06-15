/**
 * QuickSwitcher.tsx — ⌘P 快速文件切换器（从 QuickSwitcher.vue 迁移）。
 * 空输入 → MRU(workspace.recentFiles)+MFU(recentEdits)；输入 → recentEdits.topN 模糊过滤。
 * ↑/↓ Enter 导航打开；已打开则激活而非重读。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useWorkspaceStore } from '../stores/workspace';
import { useRecentEditsStore } from '../stores/recentEdits';
import { useTabsStore } from '../stores/tabs';
import { openPath } from '../composables/useFiles';
import { useI18n } from '../i18n';

const TOP_N = 50;

function basename(path: string): string {
  const idx = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return idx >= 0 ? path.slice(idx + 1) : path;
}
function dirname(path: string): string {
  const idx = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return idx > 0 ? path.slice(0, idx) : '';
}

export function QuickSwitcher({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const recentFiles = useWorkspaceStore((s) => s.recentFiles);
  const tabs = useTabsStore((s) => s.tabs);
  const counts = useRecentEditsStore((s) => s.counts);
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  const openTabPaths = useMemo(() => tabs.map((tab) => tab.filePath).filter((p): p is string => !!p), [tabs]);
  const results = useMemo(
    () => useRecentEditsStore.getState().topN(TOP_N, query, recentFiles, openTabPaths),
    // counts included so the list recomputes when frequencies change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, recentFiles, openTabPaths, counts],
  );

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIdx(0);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [results]);

  useEffect(() => {
    const item = listRef.current?.children[selectedIdx] as HTMLElement | undefined;
    item?.scrollIntoView?.({ block: 'nearest' });
  }, [selectedIdx]);

  async function openIdx(i: number) {
    const path = results[i];
    if (!path) return;
    onClose();
    const existing = useTabsStore.getState().tabs.find((tab) => tab.filePath === path);
    if (existing) {
      useTabsStore.getState().activate(existing.id);
      return;
    }
    await openPath(path);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (results.length === 0) return;
      setSelectedIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.length === 0) return;
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      openIdx(selectedIdx);
    }
  }

  if (!open) return null;
  return (
    <div className="quick-switcher__backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="quick-switcher" role="dialog" aria-label="Quick file switcher">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKey}
          className="quick-switcher__input"
          placeholder={t('quickSwitcher.placeholder')}
          spellCheck={false}
          autoComplete="off"
        />
        {results.length ? (
          <ul ref={listRef} className="quick-switcher__list">
            {results.map((path, i) => (
              <li
                key={path}
                className={`quick-switcher__item${i === selectedIdx ? ' quick-switcher__item--active' : ''}`}
                onClick={() => openIdx(i)}
                onMouseEnter={() => setSelectedIdx(i)}
              >
                <span className="quick-switcher__name">{basename(path)}</span>
                {dirname(path) && <span className="quick-switcher__path">{dirname(path)}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <div className="quick-switcher__empty">{query ? t('quickSwitcher.noMatch') : t('quickSwitcher.empty')}</div>
        )}
      </div>
    </div>
  );
}

export default QuickSwitcher;
