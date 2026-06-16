/**
 * StatusBar.tsx — 底部状态栏（从 StatusBar.vue 迁移）。行列、行数、字数（含 CJK 字）、
 * 字符数、选区统计、写作目标 pill、今日总计、番茄钟 pill、编码、语言。
 */
import { useMemo } from 'react';
import { useTabsStore } from '../stores/tabs';
import { useSettingsStore } from '../stores/settings';
import { useWritingSessionStore } from '../stores/writingSession';
import { cjkWordCount } from '../lib/chinese';
import { useI18n } from '../i18n';
import { WritingGoals } from './WritingGoals';
import { PomodoroPill } from './PomodoroPill';
import { usePomodoroStore } from '../stores/pomodoro';

export function StatusBar({ line, col, selectionText = '' }: { line: number; col: number; selectionText?: string }) {
  const { t } = useI18n();
  const content = useTabsStore((s) => s.activeTab()?.content ?? '');
  const language = useTabsStore((s) => s.activeTab()?.language);
  const enc = useTabsStore((s) => s.activeTab()?.encoding ?? 'UTF-8');
  const showWritingStats = useSettingsStore((s) => s.showWritingStats);
  const showWorkspaceDailyTotal = useSettingsStore((s) => s.showWorkspaceDailyTotal);
  const daily = useWritingSessionStore((s) => s.daily);
  const pomodoroActive = usePomodoroStore((s) => s.active);

  const stats = useMemo(() => cjkWordCount(content), [content]);
  const lineCount = content ? content.split('\n').length : 0;
  const selStats = useMemo(() => (selectionText ? cjkWordCount(selectionText) : null), [selectionText]);
  const lang = language === 'markdown' ? 'Markdown' : 'Plain Text';
  const showTodayTotal = showWritingStats && showWorkspaceDailyTotal && daily.paths.length > 0;

  return (
    <div className="statusbar">
      <span className="seg">Ln {line}, Col {col}</span>
      <span className="sep">·</span>
      <span className="seg">{lineCount} lines</span>
      <span className="sep">·</span>
      <span className="seg">{stats.total} words</span>
      {stats.cjk > 0 && (
        <span className="seg seg--cjk" title={`${stats.cjk} CJK characters`}>({stats.cjk} 字)</span>
      )}
      <span className="sep">·</span>
      <span className="seg">{stats.chars} chars</span>
      {selStats && (
        <span className="seg seg--selection" title={t('statusBar.selectionTooltip')}>
          · {t('statusBar.selection', { words: String(selStats.total), chars: String(selStats.chars) })}
          {selStats.cjk > 0 && <span className="seg--cjk"> ({selStats.cjk} 字)</span>}
        </span>
      )}
      {showWritingStats && <WritingGoals />}
      <span className="spacer" />
      {showTodayTotal && (
        <span className="seg seg--today" title={t('writingStats.todayTooltip')}>
          {t('writingStats.todayWorkspaceValue', {
            n: daily.totalNewWords.toLocaleString(),
            docs: String(daily.paths.length),
          })}
        </span>
      )}
      {pomodoroActive && <PomodoroPill />}
      <span className="seg">{enc}</span>
      <span className="sep">·</span>
      <span className="seg seg--lang">{lang}</span>
    </div>
  );
}

export default StatusBar;
