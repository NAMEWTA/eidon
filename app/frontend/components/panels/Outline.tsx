/**
 * Outline.tsx — 大纲面板（视觉对齐 docs/原型参考 的 OutlinePanel 设计）。
 * 标题树（折叠/展开）、随光标行高亮当前项并滚动入视、vimium 式键盘跳转
 * （字母→跳标签，g+数字+Enter→跳行）、底部正文字数/标题数统计。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../shared/Icons';
import { useTabsStore } from '../../stores/tabs';
import { useI18n } from '../../i18n';
import { extractOutline, type OutlineItem } from '../../lib/markdown';
import { cjkWordCount } from '../../lib/chinese';

interface OutlineNode {
  item: OutlineItem;
  children: OutlineNode[];
}
interface VisibleOutlineItem extends OutlineItem {
  hasChildren: boolean;
  collapsed: boolean;
  depth: number;
}

const LABEL_ALPHABET = 'abcdefhijklmnopqrstuvwxyz123456789'.split(''); // skip 'g'

function labelAt(index: number): string {
  if (index < LABEL_ALPHABET.length) return LABEL_ALPHABET[index];
  const a = Math.floor((index - LABEL_ALPHABET.length) / 26);
  const b = (index - LABEL_ALPHABET.length) % 26;
  if (a >= 26) return '';
  return 'abcdefhijklmnopqrstuvwxyz'[a] + 'abcdefhijklmnopqrstuvwxyz'[b];
}

function buildTree(list: OutlineItem[]): OutlineNode[] {
  const roots: OutlineNode[] = [];
  const stack: OutlineNode[] = [];
  for (const item of list) {
    const node: OutlineNode = { item, children: [] };
    while (stack.length && stack[stack.length - 1].item.level >= item.level) stack.pop();
    if (stack.length) stack[stack.length - 1].children.push(node);
    else roots.push(node);
    stack.push(node);
  }
  return roots;
}

function flattenVisible(nodes: OutlineNode[], collapsed: Set<number>, depth = 0): VisibleOutlineItem[] {
  const out: VisibleOutlineItem[] = [];
  for (const node of nodes) {
    const hasChildren = node.children.length > 0;
    const isCollapsed = hasChildren && collapsed.has(node.item.line);
    out.push({ ...node.item, hasChildren, collapsed: isCollapsed, depth });
    if (hasChildren && !isCollapsed) out.push(...flattenVisible(node.children, collapsed, depth + 1));
  }
  return out;
}

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  if (t.isContentEditable) return true;
  const tag = t.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select';
}

export function Outline({ cursorLine, onGoto }: { cursorLine?: number; onGoto: (line: number) => void }) {
  const { t } = useI18n();
  const activeTab = useTabsStore((s) => s.activeTab());
  const listRef = useRef<HTMLUListElement | null>(null);
  const [collapsedByTab, setCollapsedByTab] = useState<Record<string, number[]>>({});
  const [jumpMode, setJumpMode] = useState<'idle' | 'line-jump'>('idle');
  const [lineBuffer, setLineBuffer] = useState('');

  const activeMarkdownTab = activeTab && activeTab.language === 'markdown' ? activeTab : null;
  const items = useMemo(() => (activeMarkdownTab ? extractOutline(activeMarkdownTab.content) : []), [activeMarkdownTab]);

  // 底部统计：复用 StatusBar 的 cjkWordCount（CJK 按字、拉丁按词）。
  const docStats = useMemo(
    () => (activeMarkdownTab ? cjkWordCount(activeMarkdownTab.content) : null),
    [activeMarkdownTab],
  );

  const collapsedLinesFor = (tabId: string | null | undefined): number[] => (tabId ? collapsedByTab[tabId] ?? [] : []);

  const visibleItems = useMemo(() => {
    const tree = buildTree(items);
    const collapsed = new Set(collapsedLinesFor(activeMarkdownTab?.id));
    return flattenVisible(tree, collapsed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, collapsedByTab, activeMarkdownTab?.id]);

  // 剪除指向已不存在标题行的折叠状态。
  useEffect(() => {
    const tabId = activeMarkdownTab?.id;
    if (!tabId) return;
    const valid = new Set(items.map((item) => item.line));
    const cur = collapsedLinesFor(tabId);
    const pruned = cur.filter((line) => valid.has(line));
    if (pruned.length !== cur.length) {
      setCollapsedByTab((m) => ({ ...m, [tabId]: pruned }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, activeMarkdownTab?.id]);

  const activeIndex = useMemo(() => {
    const line = cursorLine ?? 1;
    let idx = -1;
    for (let i = 0; i < visibleItems.length; i++) {
      if (visibleItems[i].line <= line) idx = i;
      else break;
    }
    return idx;
  }, [cursorLine, visibleItems]);

  // 活动项滚动入视。
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const el = list.querySelector('.outline__row--active') as HTMLElement | null;
    if (!el) return;
    const parentRect = list.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    if (elRect.top < parentRect.top || elRect.bottom > parentRect.bottom) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [activeIndex]);

  function toggleCollapsed(line: number) {
    const tabId = activeMarkdownTab?.id;
    if (!tabId) return;
    const current = collapsedLinesFor(tabId);
    if (current.includes(line)) {
      setCollapsedByTab((m) => ({ ...m, [tabId]: current.filter((n) => n !== line) }));
    } else {
      setCollapsedByTab((m) => ({ ...m, [tabId]: [...current, line].sort((a, b) => a - b) }));
    }
  }

  // 键盘跳转：用 refs 让 window 监听器读到最新值。
  const visibleItemsRef = useRef(visibleItems);
  visibleItemsRef.current = visibleItems;
  const jumpModeRef = useRef(jumpMode);
  jumpModeRef.current = jumpMode;
  const lineBufferRef = useRef(lineBuffer);
  lineBufferRef.current = lineBuffer;
  const onGotoRef = useRef(onGoto);
  onGotoRef.current = onGoto;

  useEffect(() => {
    function jumpToLabel(label: string): boolean {
      const list = visibleItemsRef.current;
      for (let i = 0; i < list.length; i++) {
        if (labelAt(i) === label) {
          onGotoRef.current(list[i].line);
          return true;
        }
      }
      return false;
    }
    function commitLineJump() {
      const n = parseInt(lineBufferRef.current, 10);
      setJumpMode('idle');
      setLineBuffer('');
      if (Number.isFinite(n) && n >= 1) onGotoRef.current(n);
    }
    function onWindowKey(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (jumpModeRef.current === 'line-jump') {
        if (e.key >= '0' && e.key <= '9') {
          setLineBuffer((b) => b + e.key);
          e.preventDefault();
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          commitLineJump();
          return;
        }
        if (e.key === 'Escape' || e.key === 'Backspace') {
          e.preventDefault();
          setJumpMode('idle');
          setLineBuffer('');
          return;
        }
        return;
      }
      if (e.key === 'g') {
        e.preventDefault();
        setJumpMode('line-jump');
        setLineBuffer('');
        return;
      }
      if (e.key === 'Escape') return;
      if (e.key.length === 1 && /[a-z0-9]/.test(e.key)) {
        if (jumpToLabel(e.key)) e.preventDefault();
      }
    }
    window.addEventListener('keydown', onWindowKey);
    return () => window.removeEventListener('keydown', onWindowKey);
  }, []);

  // 根类名用 outline-pane：`outline` 会与 Tailwind v4 的 .outline 工具类撞名（产生 1px 深色轮廓线）。
  return (
    <aside className="outline-pane">
      <div className="outline__header">
        <span className="outline__title">
          <Icon name="outline" size={14} />
          {t('outlinePane.title')}
        </span>
        <button
          className="rs-pane-close"
          type="button"
          title={t('outlinePane.hide')}
          onClick={() => {
            const id = useTabsStore.getState().activeId;
            if (id) useTabsStore.getState().toggleOutline(id);
          }}
        >
          <Icon name="close" size={16} />
        </button>
      </div>
      {!activeMarkdownTab ? (
        <div className="outline__empty">{t('outlinePane.notMarkdown')}</div>
      ) : !visibleItems.length ? (
        <div className="outline__empty">{t('outlinePane.empty')}</div>
      ) : (
        <ul ref={listRef} className="outline__list">
          {visibleItems.map((it, i) => (
            <li
              key={`${it.line}-${it.text}`}
              className="outline__item"
            >
              <div
                className={`outline__row${i === activeIndex ? ' outline__row--active' : ''}`}
                data-level={it.level}
                style={{ ['--outline-pl' as string]: `${8 + it.depth * 12}px` }}
                onClick={() => onGoto(it.line)}
                title={labelAt(i) ? `${it.text} · ${labelAt(i)}` : it.text}
              >
                {it.hasChildren ? (
                  <button
                    className="outline__twisty"
                    title={it.collapsed ? t('outlinePane.expand') : t('outlinePane.collapse')}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCollapsed(it.line);
                    }}
                  >
                    {it.collapsed ? <Icon name="chevron-right" size={12} /> : <Icon name="chevron-down" size={12} />}
                  </button>
                ) : (
                  <span className="outline__twisty outline__twisty--spacer" aria-hidden="true" />
                )}
                <span className="outline__tier">H{it.level}</span>
                <span className="outline__label">{it.text}</span>
                <span className="outline__line">L{it.line}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      {/* 底部统计区：正文字数 / 标题数（原型 OutlinePanel 的 wordcount 区） */}
      {activeMarkdownTab && docStats ? (
        <div className="outline__stats">
          <div className="outline__stats-title">{t('outlinePane.statsTitle')}</div>
          <div className="outline__stats-grid">
            <span>{t('outlinePane.words')}</span>
            <span className="outline__stats-num">{docStats.total.toLocaleString()}</span>
            <span>{t('outlinePane.headings')}</span>
            <span className="outline__stats-num">{items.length}</span>
          </div>
        </div>
      ) : null}
      {jumpMode === 'line-jump' ? (
        <div className="outline__statusbar">
          <span className="outline__statusbar-prefix">: g</span>
          <span className="outline__statusbar-buf">{lineBuffer || '_'}</span>
          <span className="outline__statusbar-hint">{t('outlinePane.jumpHint')}</span>
        </div>
      ) : null}
    </aside>
  );
}

export default Outline;
