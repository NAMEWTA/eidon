/**
 * PomodoroPill.tsx — 番茄钟倒计时 pill（从 PomodoroPill.vue 迁移）。
 * 点击 pause/resume；右键菜单 stop/reset。颜色编码 focus/break/flash。getters→方法，
 * 经 selector 订阅使其每 tick 重渲染（store.now 每秒变化触发）。
 */
import { useEffect, useRef, useState } from 'react';
import { usePomodoroStore } from '../stores/pomodoro';
import { useI18n } from '../i18n';

export function PomodoroPill() {
  const { t } = useI18n();
  const flashing = usePomodoroStore((s) => s.flashing);
  const isBreak = usePomodoroStore((s) => s.isBreak());
  const isPaused = usePomodoroStore((s) => s.isPaused());
  const countdown = usePomodoroStore((s) => s.countdown());

  const [menu, setMenu] = useState<{ open: boolean; x: number; y: number }>({ open: false, x: 0, y: 0 });
  const menuOpenRef = useRef(menu.open);
  menuOpenRef.current = menu.open;

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!menuOpenRef.current) return;
      const target = e.target as HTMLElement | null;
      if (target && target.closest('.pomo-pill__menu')) return;
      setMenu((m) => ({ ...m, open: false }));
    };
    document.addEventListener('click', onDocClick, true);
    return () => document.removeEventListener('click', onDocClick, true);
  }, []);

  const tomatoEmoji = flashing ? '✅' : isBreak ? '☕' : '🍅';
  const pillTitle = flashing
    ? t('pomodoro.complete')
    : isPaused
      ? t('pomodoro.pillPaused')
      : isBreak
        ? t('pomodoro.pillBreak')
        : t('pomodoro.pillFocus');

  const cls = [
    'pomo-pill',
    flashing ? 'pomo-pill--flash' : '',
    isBreak && !flashing ? 'pomo-pill--break' : '',
    isPaused ? 'pomo-pill--paused' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <button
        className={cls}
        title={pillTitle}
        onClick={() => {
          if (flashing) return;
          usePomodoroStore.getState().togglePause();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenu({ open: true, x: e.clientX, y: e.clientY });
        }}
      >
        <span className="pomo-pill__icon">{tomatoEmoji}</span>
        <span className="pomo-pill__time">{flashing ? t('pomodoro.done') : countdown}</span>
      </button>
      {menu.open && (
        <div className="pomo-pill__menu" style={{ left: `${menu.x}px`, top: `${menu.y}px` }}>
          <button
            className="pomo-pill__menu-item"
            onMouseDown={(e) => {
              e.preventDefault();
              usePomodoroStore.getState().stop();
              setMenu((m) => ({ ...m, open: false }));
            }}
          >
            {t('pomodoro.stop')}
          </button>
          <button
            className="pomo-pill__menu-item"
            onMouseDown={(e) => {
              e.preventDefault();
              usePomodoroStore.getState().reset();
              setMenu((m) => ({ ...m, open: false }));
            }}
          >
            {t('pomodoro.reset')}
          </button>
        </div>
      )}
    </>
  );
}

export default PomodoroPill;
