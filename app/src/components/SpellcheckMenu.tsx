/**
 * SpellcheckMenu.tsx — 右键拼写建议菜单（从 SpellcheckMenu.vue 迁移）。
 * 受控：父（Editor 宿主）传 word/suggestions/x/y + 回调 onSelect/onAddToDict/onIgnore/onClose。
 * Esc / 外部点击关闭。
 */
import { useEffect, useRef } from 'react';
import { useI18n } from '../i18n';

export interface SpellcheckMenuProps {
  word: string;
  suggestions: string[];
  x: number;
  y: number;
  onSelect: (word: string) => void;
  onAddToDict: () => void;
  onIgnore: () => void;
  onClose: () => void;
}

export function SpellcheckMenu({ word, suggestions, x, y, onSelect, onAddToDict, onIgnore, onClose }: SpellcheckMenuProps) {
  const { t } = useI18n();
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const el = rootRef.current;
      if (el && !el.contains(e.target as Node)) onClose();
    };
    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('mousedown', onDocClick, true);
    document.addEventListener('keydown', onKeydown);
    rootRef.current?.focus();
    return () => {
      document.removeEventListener('mousedown', onDocClick, true);
      document.removeEventListener('keydown', onKeydown);
    };
  }, [onClose]);

  return (
    <div
      ref={rootRef}
      className="spellcheck-menu"
      role="menu"
      tabIndex={-1}
      style={{ left: `${x}px`, top: `${y}px` }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="spellcheck-menu__header">
        {t('spellcheck.suggestions')}
        <span className="spellcheck-menu__word">{word}</span>
      </div>
      {suggestions.length === 0 && <div className="spellcheck-menu__empty">—</div>}
      {suggestions.map((s) => (
        <button
          key={s}
          type="button"
          className="spellcheck-menu__item"
          role="menuitem"
          onClick={() => {
            onSelect(s);
            onClose();
          }}
        >
          {s}
        </button>
      ))}
      <div className="spellcheck-menu__divider" />
      <button
        type="button"
        className="spellcheck-menu__item"
        role="menuitem"
        onClick={() => {
          onAddToDict();
          onClose();
        }}
      >
        {t('spellcheck.addToDict')}
      </button>
      <button
        type="button"
        className="spellcheck-menu__item"
        role="menuitem"
        onClick={() => {
          onIgnore();
          onClose();
        }}
      >
        {t('spellcheck.ignoreOnce')}
      </button>
    </div>
  );
}

export default SpellcheckMenu;
