/**
 * CjkProofread.tsx — CJK 校对浮层（从 CjkProofread.vue 迁移）。
 * ⌘⇧J 打开；列出 invoke('cjk_proofread') 的问题按严重度分组，点击跳转、Apply 替换、批量应用
 * （右→左走以保字节偏移有效）。逐字保留 UTF-8 字节偏移 → 字符切片逻辑。
 */
import { useEffect, useMemo, useState } from 'react';
import { Icon } from './Icons';
import { invoke } from '../../core/bridge/tauri';
import { useTabsStore } from '../stores/tabs';
import { useToastsStore } from '../stores/toasts';
import { useTilesStore } from '../stores/tiles';
import { useI18n } from '../i18n';

interface Issue {
  line: number;
  col_start: number;
  col_end: number;
  severity: 'high' | 'medium' | 'low';
  category: 'punct_halfwidth' | 'de_misuse' | 'latin_quotes' | 'cjk_latin_space' | 'repeat' | 'digit_unit_space';
  original: string;
  suggestion: string;
  explanation: string;
}

export function CjkProofread({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const activeContent = useTabsStore((s) => s.activeTab()?.content);
  const hasActive = useTabsStore((s) => !!s.activeTab());
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);

  async function rescan() {
    const tab = useTabsStore.getState().activeTab();
    if (!tab) {
      setIssues([]);
      return;
    }
    setLoading(true);
    try {
      const result = await invoke<Issue[]>('cjk_proofread', { text: tab.content ?? '' });
      setIssues(result);
      setSelectedIdx(-1);
    } catch (e) {
      console.error('cjk_proofread invoke failed', e);
      useToastsStore.getState().warning(`Proofread failed: ${e}`);
      setIssues([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) {
      rescan();
    }
  }, [open]);

  // active 文档内容变化时（且面板开着）重扫。
  useEffect(() => {
    if (open) rescan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeContent]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const counts = useMemo(() => {
    let high = 0, medium = 0, low = 0;
    for (const i of issues) {
      if (i.severity === 'high') high++;
      else if (i.severity === 'medium') medium++;
      else low++;
    }
    return { high, medium, low };
  }, [issues]);

  const grouped = useMemo(() => {
    const high: Issue[] = [], medium: Issue[] = [], low: Issue[] = [];
    for (const i of issues) {
      if (i.severity === 'high') high.push(i);
      else if (i.severity === 'medium') medium.push(i);
      else low.push(i);
    }
    return { high, medium, low };
  }, [issues]);

  function categoryLabel(cat: Issue['category']): string {
    switch (cat) {
      case 'punct_halfwidth': return t('proofread.categoryPunct');
      case 'de_misuse': return t('proofread.categoryDe');
      case 'latin_quotes': return t('proofread.categoryQuotes');
      case 'repeat': return t('proofread.categoryRepeat');
      case 'cjk_latin_space': return t('proofread.categorySpace');
      case 'digit_unit_space': return t('proofread.categoryUnit');
    }
  }

  function contextOf(issue: Issue): { before: string; hit: string; after: string } {
    const tab = useTabsStore.getState().activeTab();
    if (!tab) return { before: '', hit: '', after: '' };
    const text = tab.content ?? '';
    const enc = new TextEncoder();
    const dec = new TextDecoder();
    const bytes = enc.encode(text);
    const safeStart = Math.max(0, issue.col_start);
    const safeEnd = Math.min(bytes.length, issue.col_end);
    const before = dec.decode(bytes.slice(Math.max(0, safeStart - 15), safeStart));
    const hit = dec.decode(bytes.slice(safeStart, safeEnd));
    const after = dec.decode(bytes.slice(safeEnd, Math.min(bytes.length, safeEnd + 15)));
    return { before: before.slice(-5), hit, after: after.slice(0, 5) };
  }

  function jumpTo(issue: Issue, idx: number) {
    setSelectedIdx(idx);
    window.dispatchEvent(
      new CustomEvent('eidon:outline-goto', { detail: { line: issue.line, paneId: useTilesStore.getState().focusedPaneId } }),
    );
  }

  function applyOne(issue: Issue) {
    const tab = useTabsStore.getState().activeTab();
    if (!tab) return;
    const text = tab.content ?? '';
    const enc = new TextEncoder();
    const dec = new TextDecoder();
    const bytes = enc.encode(text);
    if (issue.col_start > bytes.length || issue.col_end > bytes.length) {
      useToastsStore.getState().warning(t('proofread.outOfRange'));
      return;
    }
    const before = dec.decode(bytes.slice(0, issue.col_start));
    const after = dec.decode(bytes.slice(issue.col_end));
    useTabsStore.getState().setContent(tab.id, before + issue.suggestion + after);
    useToastsStore.getState().success(t('proofread.appliedToast', { n: 1 }));
  }

  function applyAll(severity: 'high' | 'medium' | 'low' | 'all') {
    const tab = useTabsStore.getState().activeTab();
    if (!tab) return;
    const target = severity === 'all' ? [...issues] : issues.filter((i) => i.severity === severity);
    if (target.length === 0) {
      useToastsStore.getState().info(t('proofread.nothingToApply'));
      return;
    }
    const sorted = target.slice().sort((a, b) => b.col_start - a.col_start);
    const enc = new TextEncoder();
    const dec = new TextDecoder();
    let bytes = enc.encode(tab.content ?? '');
    let applied = 0;
    let lastStart = Infinity;
    for (const issue of sorted) {
      if (issue.col_end > lastStart) continue;
      if (issue.col_start > bytes.length || issue.col_end > bytes.length) continue;
      const sugBytes = enc.encode(issue.suggestion);
      const merged = new Uint8Array(issue.col_start + sugBytes.length + (bytes.length - issue.col_end));
      merged.set(bytes.slice(0, issue.col_start), 0);
      merged.set(sugBytes, issue.col_start);
      merged.set(bytes.slice(issue.col_end), issue.col_start + sugBytes.length);
      bytes = merged;
      applied++;
      lastStart = issue.col_start;
    }
    const next = dec.decode(bytes);
    if (next === tab.content) return;
    useTabsStore.getState().setContent(tab.id, next);
    useToastsStore.getState().success(t('proofread.appliedToast', { n: applied }));
  }

  if (!open) return null;
  const buckets = ['high', 'medium', 'low'] as const;
  return (
    <div className="proof__backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="proof" role="dialog" aria-label="CJK Proofread">
        <header className="proof__head">
          <h2 className="proof__title">中 {t('proofread.heading')}</h2>
          <div className="proof__counts">
            <span className="proof__pill proof__pill--high">{t('proofread.severityHigh')} · {counts.high}</span>
            <span className="proof__pill proof__pill--medium">{t('proofread.severityMedium')} · {counts.medium}</span>
            <span className="proof__pill proof__pill--low">{t('proofread.severityLow')} · {counts.low}</span>
          </div>
          <div className="proof__actions">
            <button className="btn btn--ghost" onClick={rescan} disabled={loading}>{t('proofread.rescan')}</button>
            <button className="btn btn--primary" disabled={issues.length === 0} onClick={() => applyAll('all')}>{t('proofread.applyAll')}</button>
            <button className="btn btn--close" onClick={onClose} aria-label="Close"><Icon name="close" size={18} /></button>
          </div>
        </header>
        <p className="proof__legend">{t('proofread.legend')}</p>
        {!hasActive ? (
          <div className="proof__empty">{t('proofread.noActive')}</div>
        ) : loading ? (
          <div className="proof__empty">…</div>
        ) : issues.length === 0 ? (
          <div className="proof__empty">{t('proofread.noIssues')}</div>
        ) : (
          <div className="proof__body">
            {buckets.map((bucket) =>
              grouped[bucket].length ? (
                <section key={bucket} className={`proof__bucket proof__bucket--${bucket}`}>
                  <header className="proof__buckethead">
                    <span className="proof__bucketlabel">
                      {t(`proofread.severity${bucket.charAt(0).toUpperCase() + bucket.slice(1)}`)} ({grouped[bucket].length})
                    </span>
                    <button className="btn btn--small" onClick={() => applyAll(bucket)} title={t('proofread.applyAllSeverity', { severity: bucket })}>
                      {t('proofread.applyAll')}
                    </button>
                  </header>
                  <ul className="proof__list">
                    {grouped[bucket].map((issue, i) => {
                      const ctx = contextOf(issue);
                      const globalIdx = issues.indexOf(issue);
                      return (
                        <li
                          key={`${issue.col_start}-${issue.col_end}-${i}`}
                          className={`proof__row${selectedIdx === globalIdx ? ' proof__row--selected' : ''}`}
                          onClick={() => jumpTo(issue, globalIdx)}
                        >
                          <span className="proof__lineno">{t('proofread.line', { n: issue.line })}</span>
                          <span className="proof__category">{categoryLabel(issue.category)}</span>
                          <span className="proof__ctx">
                            <span className="proof__ctx-side">{ctx.before}</span>
                            <span className="proof__ctx-hit">{ctx.hit}</span>
                            <span className="proof__ctx-side">{ctx.after}</span>
                          </span>
                          <span className="proof__arrow"><Icon name="arrow-right" size={13} /></span>
                          <span className="proof__suggestion">{issue.suggestion}</span>
                          <button
                            className="btn btn--apply"
                            onClick={(e) => {
                              e.stopPropagation();
                              applyOne(issue);
                            }}
                            title={issue.explanation}
                          >
                            {t('proofread.apply')}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ) : null,
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default CjkProofread;
