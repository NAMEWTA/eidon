/**
 * PreviewSearch.tsx — 预览内查找浮层（从 PreviewSearch.vue 迁移）。
 * 在传入的 container DOM 内做文本高亮（mark.ps-mark）、上/下一个、计数；MutationObserver
 * 在内容变化时重搜。命令式 DOM 逻辑逐字保留；ref 暴露 focusInput。
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Icon } from './Icons';
import { useI18n } from '../i18n';

export interface PreviewSearchHandle {
  focusInput(): void;
}

export const PreviewSearch = forwardRef<PreviewSearchHandle, { container: HTMLElement; onClose: () => void }>(
  function PreviewSearch({ container, onClose }, ref) {
    const { t } = useI18n();
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [query, setQuery] = useState('');
    const [matchCount, setMatchCount] = useState(0);
    const [currentIdx, setCurrentIdx] = useState(0);
    const queryRef = useRef('');
    const matchCountRef = useRef(0);
    const currentIdxRef = useRef(0);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const observerRef = useRef<MutationObserver | null>(null);

    const setMatch = (n: number) => {
      matchCountRef.current = n;
      setMatchCount(n);
    };
    const setIdx = (n: number) => {
      currentIdxRef.current = n;
      setCurrentIdx(n);
    };

    useEffect(() => {
      queryRef.current = query;
    }, [query]);

    function pauseObserver() {
      observerRef.current?.disconnect();
    }
    function resumeObserver() {
      if (!observerRef.current || !container) return;
      observerRef.current.observe(container, { childList: true, subtree: true });
    }

    function clearMarks() {
      if (!container) return;
      pauseObserver();
      const marks = container.querySelectorAll<HTMLElement>('mark.ps-mark');
      for (const mark of Array.from(marks)) {
        const parent = mark.parentNode;
        if (!parent) continue;
        parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
      }
      container.normalize();
      setMatch(0);
      setIdx(0);
      resumeObserver();
    }

    function highlightCurrent(idx: number) {
      if (!container) return;
      const marks = container.querySelectorAll<HTMLElement>('mark.ps-mark');
      marks.forEach((m, i) => m.classList.toggle('ps-mark--current', i === idx));
      const current = marks[idx];
      if (current) current.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }

    function doSearch() {
      clearMarks();
      const q = queryRef.current.trim();
      if (!q || !container) return;
      pauseObserver();
      const lower = q.toLowerCase();
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
      const byNode = new Map<Text, Array<{ start: number; end: number }>>();
      let total = 0;
      let node: Text | null;
      while ((node = walker.nextNode() as Text | null)) {
        const text = node.textContent || '';
        const lowerText = text.toLowerCase();
        let pos = 0;
        const hits: Array<{ start: number; end: number }> = [];
        while ((pos = lowerText.indexOf(lower, pos)) !== -1) {
          hits.push({ start: pos, end: pos + q.length });
          pos += 1;
        }
        if (hits.length > 0) {
          byNode.set(node, hits);
          total += hits.length;
        }
      }
      if (total > 0) {
        for (const [textNode, hits] of byNode) {
          const sorted = [...hits].sort((a, b) => b.start - a.start);
          for (const { start, end } of sorted) {
            const range = document.createRange();
            range.setStart(textNode, start);
            range.setEnd(textNode, end);
            const mark = document.createElement('mark');
            mark.className = 'ps-mark';
            range.surroundContents(mark);
          }
        }
        setMatch(total);
        setIdx(0);
      }
      resumeObserver();
      if (total > 0) highlightCurrent(0);
    }

    function goNext() {
      if (matchCountRef.current === 0) return;
      const next = (currentIdxRef.current + 1) % matchCountRef.current;
      setIdx(next);
      highlightCurrent(next);
    }
    function goPrev() {
      if (matchCountRef.current === 0) return;
      const prev = (currentIdxRef.current - 1 + matchCountRef.current) % matchCountRef.current;
      setIdx(prev);
      highlightCurrent(prev);
    }

    function onInput() {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(doSearch, 150);
    }

    function onKeydown(e: React.KeyboardEvent) {
      if (e.nativeEvent.isComposing || e.keyCode === 229) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) goPrev();
        else goNext();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    }

    function close() {
      clearMarks();
      setQuery('');
      queryRef.current = '';
      onClose();
    }

    useImperativeHandle(ref, () => ({ focusInput: () => inputRef.current?.focus() }));

    useEffect(() => {
      // setup observer + initial focus
      const obs = new MutationObserver(() => {
        if (queryRef.current.trim()) doSearch();
      });
      observerRef.current = obs;
      if (container) obs.observe(container, { childList: true, subtree: true });
      inputRef.current?.focus();
      return () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        obs.disconnect();
        clearMarks();
      };
      // 仅按 container 重建 observer。
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [container]);

    return (
      <div className="ps-bar" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="ps-input"
          type="text"
          placeholder={t('previewSearchPlaceholder')}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            queryRef.current = e.target.value;
            onInput();
          }}
          onKeyDown={onKeydown}
        />
        {query.trim() && (
          <span className="ps-count">{matchCount > 0 ? `${currentIdx + 1}/${matchCount}` : t('noResults')}</span>
        )}
        <button className="ps-btn" disabled={matchCount === 0} onClick={goPrev} title="Previous"><Icon name="chevron-up" size={13} /></button>
        <button className="ps-btn" disabled={matchCount === 0} onClick={goNext} title="Next"><Icon name="chevron-down" size={13} /></button>
        <button className="ps-btn ps-btn--close" onClick={close} title="Close"><Icon name="close" size={13} /></button>
      </div>
    );
  },
);

export default PreviewSearch;
