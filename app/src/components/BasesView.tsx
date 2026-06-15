/**
 * BasesView.tsx — Bases 风格 YAML properties 表格视图（v2.0 F6，从 BasesView.vue 迁移）。
 *
 * 把工作区每个 .md 渲染成一行；出现 2+ 次的 frontmatter key 成为一列。过滤/排序/保存视图
 * 状态本地化；saved views 经 lib/bases 持久化到 localStorage。
 *
 * 虚拟滚动：按视口大小 + 上下各 20 行缓冲对行开窗，用零边距 spacer <tr> 撑总高。
 *
 * Vue→React：reactive filters 数组 → useState + 不可变更新；computed→useMemo；
 * watch→useEffect；onMounted/onBeforeUnmount→mount effect cleanup。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './Icons';
import { useWorkspaceIndexStore, type IndexEntry } from '../stores/workspaceIndex';
import { openPath } from '../composables/useFiles';
import { useI18n } from '../i18n';
import {
  applyFilters,
  applySort,
  defaultViews,
  getCellValue,
  inferColumns,
  loadSavedViews,
  persistSavedViews,
  type ColumnDef,
  type Filter,
  type SavedView,
  type SortSpec,
} from '../lib/bases';
import { BASES_CLOSE_EVENT } from '../composables/useBasesView';

const ROW_HEIGHT = 32; // px, matches CSS
const BUFFER_ROWS = 20;

export function BasesView() {
  const { t } = useI18n();
  const entries = useWorkspaceIndexStore((s) => s.entries);
  const ready = useWorkspaceIndexStore((s) => s.ready);

  // ---- columns ----
  const allColumns = useMemo<ColumnDef[]>(() => inferColumns(entries), [entries]);
  /** 当前可见列 id。空数组 = "显示全部"。 */
  const [visibleColumnIds, setVisibleColumnIds] = useState<string[]>([]);
  const visibleColumns = useMemo<ColumnDef[]>(() => {
    if (visibleColumnIds.length === 0) return allColumns;
    const set = new Set(visibleColumnIds);
    return allColumns.filter((c) => set.has(c.id));
  }, [visibleColumnIds, allColumns]);

  // ---- filters / sort / saved views ----
  const [filters, setFilters] = useState<Filter[]>([]);
  const [sort, setSort] = useState<SortSpec | null>({ column: 'mtime', dir: 'desc' });
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [activeViewName, setActiveViewName] = useState<string>('All notes');

  function loadViewIntoState(v: SavedView) {
    setActiveViewName(v.name);
    setFilters([...v.filters]);
    setVisibleColumnIds(v.columns.slice());
    setSort(v.sort ? { ...v.sort } : null);
  }

  function selectView(name: string) {
    const v = savedViews.find((x) => x.name === name);
    if (v) loadViewIntoState(v);
  }

  function newView() {
    const name = window.prompt(t('bases.newViewPrompt'));
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const snapshot: SavedView = {
      name: trimmed,
      columns: visibleColumnIds.slice(),
      filters: filters.map((f) => ({ ...f })),
      sort: sort ? { ...sort } : null,
    };
    const next = [...savedViews];
    const existing = next.findIndex((v) => v.name === trimmed);
    if (existing >= 0) next.splice(existing, 1, snapshot);
    else next.push(snapshot);
    setSavedViews(next);
    persistSavedViews(next);
    setActiveViewName(trimmed);
  }

  function deleteActiveView() {
    const i = savedViews.findIndex((v) => v.name === activeViewName);
    if (i < 0) return;
    let next = [...savedViews];
    next.splice(i, 1);
    // 不允许删到空——重新播种默认。
    if (next.length === 0) next = defaultViews();
    setSavedViews(next);
    persistSavedViews(next);
    loadViewIntoState(next[0]);
  }

  // ---- filter row helpers ----
  function getFilterFor(columnId: string): Filter | null {
    return filters.find((f) => f.column === columnId) ?? null;
  }

  function setFilter(columnId: string, op: Filter['op'], value: unknown) {
    setFilters((prev) => {
      const i = prev.findIndex((f) => f.column === columnId);
      if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) {
        if (i >= 0) {
          const next = [...prev];
          next.splice(i, 1);
          return next;
        }
        return prev;
      }
      const f: Filter = { column: columnId, op, value };
      const next = [...prev];
      if (i >= 0) next.splice(i, 1, f);
      else next.push(f);
      return next;
    });
  }

  function clearFilters() {
    setFilters([]);
  }

  /** 每个 frontmatter key 的数组值（给 array 列下拉）。 */
  function arrayValuesFor(col: ColumnDef): string[] {
    const set = new Set<string>();
    for (const e of entries) {
      if (col.source === 'builtin' && col.id === 'tags') {
        for (const v of e.tags) set.add(v);
      } else if (col.source === 'frontmatter' && col.fmKey && e.frontmatter) {
        const raw = (e.frontmatter as Record<string, unknown>)[col.fmKey];
        if (Array.isArray(raw)) {
          for (const v of raw) set.add(String(v));
        } else if (raw != null) {
          set.add(String(raw));
        }
      }
    }
    return Array.from(set).sort();
  }

  // ---- sort header click ----
  function toggleSort(col: ColumnDef) {
    if (!sort || sort.column !== col.id) {
      setSort({ column: col.id, dir: 'asc' });
    } else if (sort.dir === 'asc') {
      setSort({ column: col.id, dir: 'desc' });
    } else {
      setSort(null);
    }
  }
  function sortIndicator(col: ColumnDef) {
    if (!sort || sort.column !== col.id) return null;
    return <Icon name={sort.dir === 'asc' ? 'chevron-up' : 'chevron-down'} size={11} />;
  }

  // ---- final rows after filter+sort ----
  const processedRows = useMemo<IndexEntry[]>(() => {
    const filtered = applyFilters(entries, filters, allColumns);
    return applySort(filtered, sort, allColumns);
  }, [entries, filters, allColumns, sort]);

  // ---- virtual scroll ----
  const scrollEl = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);

  function onScroll(e: React.UIEvent<HTMLDivElement>) {
    setScrollTop((e.target as HTMLElement).scrollTop);
  }

  function recomputeViewport() {
    if (scrollEl.current) {
      setViewportHeight(scrollEl.current.clientHeight);
    }
  }

  const visibleSlice = useMemo(() => {
    const total = processedRows.length;
    if (total === 0) return { start: 0, end: 0, padTop: 0, padBottom: 0 };
    const visibleStart = Math.floor(scrollTop / ROW_HEIGHT);
    const visibleCount = Math.ceil(viewportHeight / ROW_HEIGHT);
    const start = Math.max(0, visibleStart - BUFFER_ROWS);
    const end = Math.min(total, visibleStart + visibleCount + BUFFER_ROWS);
    return { start, end, padTop: start * ROW_HEIGHT, padBottom: (total - end) * ROW_HEIGHT };
  }, [processedRows, scrollTop, viewportHeight]);

  const visibleRows = useMemo(
    () => processedRows.slice(visibleSlice.start, visibleSlice.end),
    [processedRows, visibleSlice],
  );

  // ---- column picker ----
  const [columnPickerOpen, setColumnPickerOpen] = useState(false);
  function toggleColumn(id: string) {
    setVisibleColumnIds((prev) => {
      // 首次点击：切到显式列表（以当前全部列起步）。
      const base = prev.length === 0 ? allColumns.map((c) => c.id) : [...prev];
      const i = base.indexOf(id);
      if (i >= 0) base.splice(i, 1);
      else base.push(id);
      return base;
    });
  }
  function isColumnVisible(id: string): boolean {
    if (visibleColumnIds.length === 0) return true;
    return visibleColumnIds.includes(id);
  }

  // ---- file open ----
  async function openEntry(entry: IndexEntry) {
    await openPath(entry.path);
    // 打开后父组件可保留 bases 视图——不自动关闭。
  }

  function closeBases() {
    window.dispatchEvent(new CustomEvent(BASES_CLOSE_EVENT));
  }

  // ---- lifecycle ----
  useEffect(() => {
    // 播种 saved views。
    let views = loadSavedViews();
    if (views.length === 0) {
      views = defaultViews();
      persistSavedViews(views);
    }
    // 工作区恰好用 #project 时自动加 "Tagged #project" 默认视图。
    const tags = (() => {
      const set = new Set<string>();
      for (const e of useWorkspaceIndexStore.getState().entries) for (const tag of e.tags) set.add(tag);
      return set;
    })();
    if (tags.has('project') && !views.some((v) => v.name === 'Tagged #project')) {
      views.push({
        name: 'Tagged #project',
        columns: [],
        filters: [{ column: 'tags', op: 'has-tag', value: 'project' }],
        sort: { column: 'mtime', dir: 'desc' },
      });
      persistSavedViews(views);
    }
    setSavedViews(views);
    loadViewIntoState(views[0]);

    recomputeViewport();
    // IntersectionObserver——表格滚入视图（如打开后）时被动重算。
    let io: IntersectionObserver | null = null;
    if (scrollEl.current && typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(() => recomputeViewport());
      io.observe(scrollEl.current);
    }
    const resizeHandler = () => recomputeViewport();
    window.addEventListener('resize', resizeHandler);
    return () => {
      window.removeEventListener('resize', resizeHandler);
      if (io) {
        io.disconnect();
        io = null;
      }
    };
  }, []);

  // 行集变化时重置滚动，免得用户被困在列表中段。
  useEffect(() => {
    if (scrollEl.current) scrollEl.current.scrollTop = 0;
    setScrollTop(0);
  }, [processedRows.length, activeViewName]);

  // ---- per-cell text ----
  function cellText(entry: IndexEntry, col: ColumnDef): string {
    return String(getCellValue(entry, col) ?? '');
  }

  // ---- date range filter helpers ----
  function getDateRangeStart(columnId: string): string {
    const f = filters.find((x) => x.column === columnId && x.op === '>');
    if (!f || !f.value) return '';
    const d = new Date(typeof f.value === 'number' ? f.value : String(f.value));
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function getDateRangeEnd(columnId: string): string {
    const f = filters.find((x) => x.column === columnId && x.op === '<');
    if (!f || !f.value) return '';
    const d = new Date(typeof f.value === 'number' ? f.value : String(f.value));
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function setDateRangeStart(columnId: string, value: string) {
    if (!value) {
      setFilters((prev) => {
        const i = prev.findIndex((x) => x.column === columnId && x.op === '>');
        if (i < 0) return prev;
        const next = [...prev];
        next.splice(i, 1);
        return next;
      });
      return;
    }
    const ms = new Date(value).getTime();
    if (isNaN(ms)) return;
    setFilters((prev) => {
      const i = prev.findIndex((x) => x.column === columnId && x.op === '>');
      const f: Filter = { column: columnId, op: '>', value: ms };
      const next = [...prev];
      if (i >= 0) next.splice(i, 1, f);
      else next.push(f);
      return next;
    });
  }
  function setDateRangeEnd(columnId: string, value: string) {
    if (!value) {
      setFilters((prev) => {
        const i = prev.findIndex((x) => x.column === columnId && x.op === '<');
        if (i < 0) return prev;
        const next = [...prev];
        next.splice(i, 1);
        return next;
      });
      return;
    }
    const ms = new Date(value).getTime();
    if (isNaN(ms)) return;
    setFilters((prev) => {
      const i = prev.findIndex((x) => x.column === columnId && x.op === '<');
      const f: Filter = { column: columnId, op: '<', value: ms };
      const next = [...prev];
      if (i >= 0) next.splice(i, 1, f);
      else next.push(f);
      return next;
    });
  }

  // ---- multi-select tag filter ----
  function selectedTagsFor(columnId: string): string[] {
    const f = filters.find((x) => x.column === columnId && x.op === 'has-tag');
    if (!f) return [];
    return Array.isArray(f.value) ? (f.value as string[]) : [String(f.value)];
  }
  function toggleTagFilter(columnId: string, tag: string) {
    const cur = selectedTagsFor(columnId);
    const next = cur.includes(tag) ? cur.filter((x) => x !== tag) : [...cur, tag];
    setFilter(columnId, 'has-tag', next);
  }

  function renderFilterCell(col: ColumnDef) {
    if (col.kind === 'date' || (col.source === 'builtin' && col.id === 'mtime')) {
      return (
        <div className="bases__range">
          <input type="date" value={getDateRangeStart(col.id)} title={t('bases.dateAfter')} onChange={(e) => setDateRangeStart(col.id, e.target.value)} />
          <input type="date" value={getDateRangeEnd(col.id)} title={t('bases.dateBefore')} onChange={(e) => setDateRangeEnd(col.id, e.target.value)} />
        </div>
      );
    }
    if (col.kind === 'array') {
      return (
        <details className="bases__multi">
          <summary>
            {selectedTagsFor(col.id).length === 0 ? t('bases.anyValue') : selectedTagsFor(col.id).join(', ')}
          </summary>
          <div className="bases__multi-list">
            {arrayValuesFor(col).map((v) => (
              <label key={v} className="bases__multi-item">
                <input type="checkbox" checked={selectedTagsFor(col.id).includes(v)} onChange={() => toggleTagFilter(col.id, v)} />
                <span>{v}</span>
              </label>
            ))}
            {arrayValuesFor(col).length === 0 && (
              <div className="bases__multi-empty">{t('bases.noValues')}</div>
            )}
          </div>
        </details>
      );
    }
    if (col.kind === 'number') {
      const ff = getFilterFor(col.id);
      return (
        <input
          type="number"
          className="bases__filter-input"
          placeholder={t('bases.filterNumber')}
          value={ff && ff.op === '>' ? String(ff.value ?? '') : ''}
          onChange={(e) => setFilter(col.id, '>', e.target.value)}
        />
      );
    }
    if (col.kind === 'boolean') {
      const ff = getFilterFor(col.id);
      return (
        <select
          className="bases__filter-input"
          value={ff ? String(ff.value) : ''}
          onChange={(e) => {
            const v = e.target.value;
            setFilter(col.id, 'equals', v === '' ? null : v === 'true');
          }}
        >
          <option value="">{t('bases.anyValue')}</option>
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      );
    }
    const ff = getFilterFor(col.id);
    return (
      <input
        type="text"
        className="bases__filter-input"
        placeholder={t('bases.filterText')}
        value={ff ? String(ff.value ?? '') : ''}
        onChange={(e) => setFilter(col.id, 'contains', e.target.value)}
      />
    );
  }

  return (
    <div className="bases">
      <header className="bases__head">
        <div className="bases__head-left">
          <button className="bases__back" title={t('bases.back')} onClick={closeBases}>
            {t('bases.back')}
          </button>
          <strong className="bases__title">{t('bases.title')}</strong>
          <select className="bases__view-select" value={activeViewName} onChange={(e) => selectView(e.target.value)}>
            {savedViews.map((v) => (
              <option key={v.name} value={v.name}>{v.name}</option>
            ))}
          </select>
          <button className="bases__btn" onClick={newView}>{t('bases.newView')}</button>
          <button className="bases__btn" disabled={savedViews.length <= 1} onClick={deleteActiveView}>
            {t('bases.deleteView')}
          </button>
        </div>
        <div className="bases__head-right">
          <div className="bases__col-picker">
            <button className="bases__btn" onClick={() => setColumnPickerOpen((v) => !v)}>
              {t('bases.columns')}
            </button>
            {columnPickerOpen && (
              <div className="bases__col-menu" onClick={(e) => e.stopPropagation()}>
                {allColumns.map((c) => (
                  <label key={c.id} className="bases__col-menu-item">
                    <input type="checkbox" checked={isColumnVisible(c.id)} onChange={() => toggleColumn(c.id)} />
                    <span>{c.label}</span>
                    <span className="bases__kind">{c.kind}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          {filters.length > 0 && (
            <button className="bases__btn" onClick={clearFilters}>{t('bases.clearFilters')}</button>
          )}
          <span className="bases__count">{t('bases.rowCount', { n: processedRows.length })}</span>
        </div>
      </header>

      {!ready ? (
        <div className="bases__empty">{t('bases.openFolder')}</div>
      ) : entries.length === 0 ? (
        <div className="bases__empty">{t('bases.noEntries')}</div>
      ) : (
        <div className="bases__scroll" ref={scrollEl} onScroll={onScroll}>
          <table className="bases__table">
            <thead>
              <tr>
                {visibleColumns.map((col) => (
                  <th key={col.id} className={`bases__th bases__th--${col.kind}`} onClick={() => toggleSort(col)}>
                    {col.label}<span className="bases__sort">{sortIndicator(col)}</span>
                  </th>
                ))}
              </tr>
              <tr className="bases__filter-row">
                {visibleColumns.map((col) => (
                  <th key={col.id} className="bases__filter-cell">
                    {renderFilterCell(col)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleSlice.padTop > 0 && (
                <tr className="bases__pad" style={{ height: `${visibleSlice.padTop}px` }}></tr>
              )}
              {visibleRows.map((entry) => (
                <tr key={entry.path} className="bases__row">
                  {visibleColumns.map((col) => (
                    <td key={col.id} className={`bases__td bases__td--${col.kind}`}>
                      {col.id === 'name' ? (
                        <a href="#" className="bases__link" onClick={(e) => { e.preventDefault(); openEntry(entry); }}>
                          {cellText(entry, col)}
                        </a>
                      ) : (
                        cellText(entry, col)
                      )}
                    </td>
                  ))}
                </tr>
              ))}
              {visibleSlice.padBottom > 0 && (
                <tr className="bases__pad" style={{ height: `${visibleSlice.padBottom}px` }}></tr>
              )}
              {processedRows.length === 0 && (
                <tr>
                  <td colSpan={visibleColumns.length} className="bases__empty-row">
                    {t('bases.noMatch')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default BasesView;
