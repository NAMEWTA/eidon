/**
 * WritingGoals.tsx — 写作目标 pill + 浮层。
 * 读 active doc front matter 的 goal；进度条/达标脉冲/会话 delta/streak/重置。
 * 无 goal 则惰性不显示。watch → useEffect；session getters→方法（订阅 sessions/daily 切片）。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../shared/Icons';
import { useTabsStore } from '../../stores/tabs';
import { useSettingsStore } from '../../stores/settings';
import { useWritingSessionStore, computeStreakDays } from '../../stores/writingSession';
import { useWritingGoals } from '../../hooks/useWritingGoals';
import { useI18n } from '../../i18n';

export function WritingGoals() {
  const { t } = useI18n();
  const wg = useWritingGoals();
  const showWritingStats = useSettingsStore((s) => s.showWritingStats);
  const showWorkspaceDailyTotal = useSettingsStore((s) => s.showWorkspaceDailyTotal);
  const activeId = useTabsStore((s) => s.activeId);
  const sessions = useWritingSessionStore((s) => s.sessions);
  const daily = useWritingSessionStore((s) => s.daily);

  const activePathKey = wg.activeTabPath;
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const prevReachedRef = useRef(wg.reachedGoal);
  const popoverOpenRef = useRef(popoverOpen);
  popoverOpenRef.current = popoverOpen;
  const rootRef = useRef<HTMLDivElement | null>(null);

  // 计数变化时推进 session（无 goal 跳过）。immediate 由 useEffect 首跑覆盖。
  const goalAmt = wg.goal?.goal ?? 0;
  useEffect(() => {
    if (!activePathKey || !goalAmt) return;
    useWritingSessionStore.getState().observe(activePathKey, wg.current);
    // 依赖故意用基本值 wg.current（数值），而非每次渲染新建的 wg 对象。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wg.current, activePathKey, goalAmt]);

  // 0→1 达标脉冲（不在持续增长时重复）。
  useEffect(() => {
    const val = wg.reachedGoal;
    if (val && !prevReachedRef.current) {
      setJustCompleted(true);
      const tid = setTimeout(() => setJustCompleted(false), 1600);
      prevReachedRef.current = val;
      return () => clearTimeout(tid);
    }
    prevReachedRef.current = val;
  }, [wg.reachedGoal]);

  // 跨日 rollover 轮询（30s）。
  useEffect(() => {
    const tid = setInterval(() => useWritingSessionStore.getState().rolloverIfNewDay(), 30_000);
    return () => clearInterval(tid);
  }, []);

  // 点击外部关闭浮层。
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!popoverOpenRef.current) return;
      const el = rootRef.current;
      if (el && e.target instanceof Node && !el.contains(e.target)) setPopoverOpen(false);
    };
    document.addEventListener('mousedown', onDocClick, true);
    return () => document.removeEventListener('mousedown', onDocClick, true);
  }, []);

  // activeId 变化只更新观察指针（与 既有实现一致，无副作用）。
  useEffect(() => {
    void activeId;
  }, [activeId]);

  const unitLabel = useMemo(() => {
    if (!wg.goal) return '';
    switch (wg.goal.unit) {
      case 'cjk':
        return t('writingStats.unitCjk');
      case 'chars':
        return t('writingStats.unitChars');
      case 'words':
      default:
        return t('writingStats.unitWords');
    }
  }, [wg.goal, t]);

  if (!showWritingStats || !wg.goal) return null;

  const percentText = `${Math.floor(wg.progress * 100)}%`;
  const pillText = `${wg.current} / ${wg.goal.goal} ${unitLabel} · ${percentText}`;
  const sessionEntry = sessions[activePathKey];
  const sessionDelta = sessionEntry ? Math.max(0, wg.current - sessionEntry.openCount) : 0;
  const sinceSavedDelta = Math.max(0, wg.current - wg.savedCount);
  const deltaSource: 'open' | 'save' = sessionEntry?.lastSavedAt ? 'save' : 'open';
  const streakDays = computeStreakDays(wg.goal.setAt ?? null);
  const showWorkspaceTotal = showWorkspaceDailyTotal && daily.paths.length > 0;

  const pillCls = [
    'writing-goals__pill',
    wg.reachedGoal ? 'writing-goals__pill--complete' : '',
    justCompleted ? 'writing-goals__pill--pulse' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div ref={rootRef} className="writing-goals">
      <button
        className={pillCls}
        title={t('writingStats.pillTooltip')}
        style={{ ['--wg-progress' as string]: `${Math.round(wg.progress * 100)}%` }}
        onClick={() => setPopoverOpen((v) => !v)}
      >
        <span className="writing-goals__bar" />
        <span className="writing-goals__label">
          {pillText}
          {wg.reachedGoal && <span className="writing-goals__check"><Icon name="check" size={13} /></span>}
        </span>
      </button>

      {popoverOpen && (
        <div className="writing-goals__popover" role="dialog">
          <header className="writing-goals__popover-header">{t('writingStats.popoverTitle')}</header>
          <div className="writing-goals__row">
            <span className="writing-goals__row-label">
              {deltaSource === 'save' ? t('writingStats.deltaSinceSave') : t('writingStats.deltaSinceOpen')}
            </span>
            <span className="writing-goals__row-value">
              +{deltaSource === 'save' ? sinceSavedDelta : sessionDelta} {unitLabel}
            </span>
          </div>
          <div className="writing-goals__row">
            <span className="writing-goals__row-label">{t('writingStats.streak')}</span>
            <span className="writing-goals__row-value">{t('writingStats.streakValue', { n: String(streakDays) })}</span>
          </div>
          {showWorkspaceTotal && (
            <div className="writing-goals__row">
              <span className="writing-goals__row-label">{t('writingStats.todayWorkspace')}</span>
              <span className="writing-goals__row-value">
                {t('writingStats.todayWorkspaceValue', {
                  n: daily.totalNewWords.toLocaleString(),
                  docs: String(daily.paths.length),
                })}
              </span>
            </div>
          )}
          <button
            type="button"
            className="writing-goals__reset"
            onClick={() => {
              if (!activePathKey) return;
              useWritingSessionStore.getState().resetSession(activePathKey, wg.current);
              setPopoverOpen(false);
            }}
          >
            {t('writingStats.resetSession')}
          </button>
        </div>
      )}
    </div>
  );
}

export default WritingGoals;
