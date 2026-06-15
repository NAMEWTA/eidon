/**
 * GlobalSearch.tsx — 全局工作区搜索（右侧栏常驻面板，从 GlobalSearch.vue 迁移）。
 * 防抖搜索、按文件分组、命中高亮、键盘导航；点击/Enter 打开并 outline-goto 定位。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './Icons';
import { useGlobalSearch, type SearchHit } from '../composables/useGlobalSearch';
import { openPath } from '../composables/useFiles';
import { useTabsStore } from '../stores/tabs';
import { useTilesStore } from '../stores/tiles';
import { useWorkspaceStore } from '../stores/workspace';
import { useI18n } from '../i18n';

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}
function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function GlobalSearch({ prefill, onClose }: { prefill?: string; onClose?: () => void }) {
  const { t } = useI18n();
  const search = useGlobalSearch();
  const currentFolder = useWorkspaceStore((s) => s.currentFolder);
  const activeFilePath = useTabsStore((s) => s.activeTab()?.filePath ?? '');
  const [query, setQuery] = useState(prefill ?? '');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const debounceRef = useRef<number | null>(null);

  const doSearch = async (q0: string) => {
    const q = q0.trim();
    if (!q) {
      setHits([]);
      return;
    }
    setLoading(true);
    try {
      const r = await search.search(q);
      setHits(r);
      setSelectedIdx(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    inputRef.current?.focus();
    if (prefill) doSearch(prefill);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // prefill 变化（外部再次触发搜索同一面板）。
  useEffect(() => {
    if (prefill && prefill !== query) {
      setQuery(prefill);
      inputRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill]);

  useEffect(() => {
    if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => doSearch(query), 220);
    return () => {
      if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const grouped = useMemo(() => {
    const map = new Map<string, SearchHit[]>();
    for (const h of hits) {
      if (!map.has(h.file)) map.set(h.file, []);
      map.get(h.file)!.push(h);
    }
    return Array.from(map.entries());
  }, [hits]);

  function shortPath(p: string) {
    if (currentFolder && p.startsWith(currentFolder)) return p.slice(currentFolder.length).replace(/^[\\/]/, '');
    return p.split(/[\\/]/).slice(-2).join('/');
  }

  async function openHit(hit: SearchHit) {
    try {
      await openPath(hit.file);
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent('eidon:outline-goto', { detail: { line: hit.line, paneId: useTilesStore.getState().focusedPaneId } }),
        );
      }, 0);
    } catch (e) {
      console.error('GlobalSearch: openPath failed', e);
    }
  }

  function highlight(snippet: string): string {
    const q = query.trim();
    if (!q) return escapeHtml(snippet);
    const re = new RegExp(`(${escapeRe(q)})`, 'gi');
    return escapeHtml(snippet).replace(re, '<mark>$1</mark>');
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose?.();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, hits.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const hit = hits[selectedIdx];
      if (hit) openHit(hit);
    }
  }

  return (
    <div className="sp">
      <header className="sp__head">
        <span className="sp__title">{t('search.heading')}</span>
        {onClose && <button className="rs-pane-close" type="button" title={t('rightSidebar.hidePane')} onClick={onClose}><Icon name="close" size={16} /></button>}
      </header>
      <div className="sp__input-wrap">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="sp__input"
          placeholder={t('search.placeholder')}
          spellCheck={false}
          onKeyDown={onKey}
        />
        {loading && <span className="sp__loading">…</span>}
      </div>
      {!currentFolder ? (
        <div className="sp__empty">{t('search.openFolder')}</div>
      ) : !query.trim() ? (
        <div className="sp__empty">{t('search.typeToSearch')}</div>
      ) : !hits.length && !loading ? (
        <div className="sp__empty">{t('search.noMatches')}</div>
      ) : (
        <div className="sp__results">
          {grouped.map(([file, fileHits]) => (
            <div key={file} className="sp__group">
              <div className={`sp__file${file === activeFilePath ? ' sp__file--active' : ''}`}>{shortPath(file)}</div>
              {fileHits.map((hit) => (
                <div
                  key={hit.line}
                  className={`sp__hit${hits.indexOf(hit) === selectedIdx ? ' sp__hit--active' : ''}`}
                  onClick={() => openHit(hit)}
                  onMouseEnter={() => setSelectedIdx(hits.indexOf(hit))}
                >
                  <span className="sp__lineno">L{hit.line}</span>
                  <span className="sp__snippet" dangerouslySetInnerHTML={{ __html: highlight(hit.snippet) }} />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      <div className="sp__footer">
        <span>{t('search.hitCount', { n: String(hits.length) })}</span>
        <span>{t('search.keyHint')}</span>
      </div>
    </div>
  );
}

export default GlobalSearch;
