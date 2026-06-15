/**
 * CommandPalette.tsx — ⌘K 命令面板（从 CommandPalette.vue 迁移）。
 * 过滤用 M6 `filterCommands`（纯函数，AND 分词）；键盘导航 ↑↓/Enter/Esc；IME 守卫。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useCommands } from '../composables/useCommands';
import { filterCommands } from '../lib/command-filter';
import { useI18n } from '../i18n';

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const allCommands = useCommands();
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo(() => filterCommands(allCommands, query), [allCommands, query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  async function runIdx(i: number) {
    const cmd = filtered[i];
    if (!cmd) return;
    onClose();
    await Promise.resolve(cmd.run());
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runIdx(selectedIdx);
    }
  }

  if (!open) return null;
  return (
    <div className="palette__backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette" role="dialog" aria-label="Command palette">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKey}
          className="palette__input"
          placeholder={t('commandPalette.placeholder')}
          spellCheck={false}
        />
        {filtered.length ? (
          <ul className="palette__list">
            {filtered.map((c, i) => (
              <li
                key={c.id}
                className={`palette__item${i === selectedIdx ? ' palette__item--active' : ''}`}
                onClick={() => runIdx(i)}
                onMouseEnter={() => setSelectedIdx(i)}
              >
                <span className="palette__title">{c.title}</span>
                {c.shortcut && <span className="palette__shortcut">{c.shortcut}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <div className="palette__empty">{t('commandPalette.noMatch')}</div>
        )}
      </div>
    </div>
  );
}

export default CommandPalette;
