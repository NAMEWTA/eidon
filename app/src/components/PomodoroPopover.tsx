/**
 * PomodoroPopover.tsx — 番茄钟启动浮层（从 PomodoroPopover.vue 迁移）。
 * 预设/自定义分钟 + 每会话开关（autoBreak/notify）；Esc 关闭。逻辑全在 store，UI 在此。
 */
import { useEffect, useState } from 'react';
import { usePomodoroStore } from '../stores/pomodoro';
import { useI18n } from '../i18n';

export function PomodoroPopover({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const [customMin, setCustomMin] = useState(15);
  const [autoBreak, setAutoBreak] = useState(false);
  const [notify, setNotify] = useState(true);

  useEffect(() => {
    if (!open) return;
    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeydown);
    return () => window.removeEventListener('keydown', onKeydown);
  }, [open, onClose]);

  function startWith(min: number) {
    if (!Number.isFinite(min) || min <= 0) return;
    usePomodoroStore.getState().start(min, { autoBreak, notify });
    onClose();
  }

  if (!open) return null;
  const presets = [
    { min: 25, label: t('pomodoro.preset25') },
    { min: 50, label: t('pomodoro.preset50') },
    { min: 90, label: t('pomodoro.preset90') },
  ];

  return (
    <div className="pomo-popover" role="dialog" aria-label={t('pomodoro.heading')}>
      <div className="pomo-popover__head">{t('pomodoro.heading')}</div>
      {presets.map((p) => (
        <button
          key={p.min}
          className="pomo-popover__row"
          onMouseDown={(e) => {
            e.preventDefault();
            startWith(p.min);
          }}
        >
          <span className="pomo-popover__row-name">{p.label}</span>
          <span className="pomo-popover__row-min">{p.min} {t('pomodoro.minShort')}</span>
        </button>
      ))}
      <div className="pomo-popover__custom">
        <input
          type="number"
          min={1}
          max={600}
          value={customMin}
          onChange={(e) => setCustomMin(Math.max(1, Math.min(600, +e.target.value || 1)))}
          className="pomo-popover__num"
          aria-label={t('pomodoro.customMinutes')}
        />
        <span className="pomo-popover__custom-suffix">{t('pomodoro.minShort')}</span>
        <button
          className="pomo-popover__start"
          onMouseDown={(e) => {
            e.preventDefault();
            startWith(Number(customMin));
          }}
        >
          {t('pomodoro.start')}
        </button>
      </div>
      <div className="pomo-popover__sep" />
      <label className="pomo-popover__toggle">
        <input type="checkbox" checked={autoBreak} onChange={(e) => setAutoBreak(e.target.checked)} />
        <span>{t('pomodoro.autoBreak')}</span>
      </label>
      <label className="pomo-popover__toggle">
        <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
        <span>{t('pomodoro.notify')}</span>
      </label>
      <div className="pomo-popover__hint">{t('pomodoro.shortcutHint')}</div>
    </div>
  );
}

export default PomodoroPopover;
