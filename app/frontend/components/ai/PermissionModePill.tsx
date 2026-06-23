/**
 * PermissionModePill —— 权限档下拉（仿 HanaAgent PlanModeButton + PermissionModeIcon）。
 *
 * 四档：自动审核(auto) / 完整权限(operate) / 操作前询问(ask) / 只读模式(read_only)。
 * 切档即时下发后端（store.setPermissionMode → ai:setPermissionMode）。
 */
import { useEffect, useRef, useState } from 'react';

import type { SessionPermissionMode } from '@shared/models';
import { useI18n } from '../../i18n';
import { useAiStore } from '../../stores/ai';

const MODES: SessionPermissionMode[] = ['auto', 'operate', 'ask', 'read_only'];

function labelKey(mode: SessionPermissionMode): string {
  if (mode === 'auto') return 'ai.modeAuto';
  if (mode === 'operate') return 'ai.modeOperate';
  if (mode === 'ask') return 'ai.modeAsk';
  return 'ai.modeReadOnly';
}
function hintKey(mode: SessionPermissionMode): string {
  if (mode === 'auto') return 'ai.modeAutoHint';
  if (mode === 'operate') return 'ai.modeOperateHint';
  if (mode === 'ask') return 'ai.modeAskHint';
  return 'ai.modeReadOnlyHint';
}

/** 各档图标（SVG 直接移植自 HanaAgent PermissionModeIcon）。 */
export function PermissionModeIcon({ mode }: { mode: SessionPermissionMode }) {
  if (mode === 'auto') {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3.5 19 6v5.4c0 4.1-2.7 7.5-7 9.1-4.3-1.6-7-5-7-9.1V6l7-2.5Z" />
      </svg>
    );
  }
  if (mode === 'read_only') {
    return (
      <svg width="13" height="13" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
        <path d="M30 25c0 1.104-.927 1.656-2 2 0 0-5.443 1.515-11 2.977V5l11-3c1.104 0 2 .896 2 2v21ZM15 29.998C9.538 28.53 4 27 4 27c-1.136-.312-2-.896-2-2V4c0-1.104.896-2 2-2l11 3v24.998ZM28 0s-5.789 1.594-11.05 3c-.659.025-1.323 0-1.983 0C9.955 1.656 4 0 4 0 1.791 0 0 1.791 0 4v21c0 2.209 1.885 3.313 4 4 0 0 5.393 1.5 10.967 3h2.025C22.612 30.5 28 29 28 29c2.053-.531 4-1.791 4-4V4c0-2.209-1.791-4-4-4Z" />
      </svg>
    );
  }
  if (mode === 'ask') {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.7-2.5 2-2.5 4" />
        <path d="M12 17h.01" />
      </svg>
    );
  }
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}

export function PermissionModePill() {
  const { t } = useI18n();
  const mode = useAiStore((s) => s.permissionMode);
  const setMode = useAiStore((s) => s.setPermissionMode);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="ai-pill-wrap" ref={ref}>
      <button
        className={`ai-pill ai-pill--mode-${mode}${open ? ' is-open' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        title={t(hintKey(mode))}
      >
        <PermissionModeIcon mode={mode} />
        <span className="ai-pill__label">{t(labelKey(mode))}</span>
      </button>
      {open && (
        <div className="ai-pill__menu ai-pill__menu--up">
          {MODES.map((m) => (
            <button
              key={m}
              className={`ai-pill__option${m === mode ? ' is-active' : ''}`}
              onClick={() => {
                setMode(m);
                setOpen(false);
              }}
            >
              <span className="ai-pill__option-icon">
                <PermissionModeIcon mode={m} />
              </span>
              <span className="ai-pill__option-text">
                <span className="ai-pill__option-label">{t(labelKey(m))}</span>
                <span className="ai-pill__option-hint">{t(hintKey(m))}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default PermissionModePill;
