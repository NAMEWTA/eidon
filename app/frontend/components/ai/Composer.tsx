/**
 * Composer —— AI 对话输入框，支持 @ / $ 触发的自动补全。
 *
 * 触发规则（光标前最近一个未被空白隔断的触发符）：
 *  - `@`            → 模糊匹配工作区文件/文件夹；`@agent:` 前缀 → 选择激活某 Agent。
 *  - `/`（行首/空白后）→ `skill:xxx` / `command:xxx` 选择激活/运行。
 *  - `$`            → 插入变量/上下文 token（$selection/$file/$date…）。
 * 菜单开启时 ↑/↓ 选择、Enter/Tab 确认、Esc 关闭；菜单关闭时 Enter 发送、Shift+Enter 换行。
 *
 * 数据由父级经 resolveItems 注入（保持本组件通用）；选中 = 用 item.insert 替换触发 token。
 */
import { useLayoutEffect, useMemo, useRef, useState } from 'react';

export type ComposerTrigger = '@' | '/' | '$';

export interface MenuItem {
  key: string;
  label: string;
  hint?: string;
  /** 替换触发 token（含触发符到光标之间）后插入的文本。 */
  insert: string;
  /** 选中时的副作用（如切换 Agent）；提供时仅移除触发 token、不插入文本。 */
  action?: () => void;
}

interface ActiveTrigger {
  trigger: ComposerTrigger;
  query: string;
  /** 触发符在文本中的起始下标。 */
  start: number;
}

interface ComposerProps {
  disabled?: boolean;
  placeholder?: string;
  streaming?: boolean;
  resolveItems: (ctx: { trigger: ComposerTrigger; query: string }) => MenuItem[];
  onSend: (text: string) => void;
  onCancel?: () => void;
}

const TRIGGERS: ComposerTrigger[] = ['@', '/', '$'];

/** 解析光标前的活动触发符（无则 null）。 */
function detectTrigger(text: string, caret: number): ActiveTrigger | null {
  for (let i = caret - 1; i >= 0; i--) {
    const ch = text[i];
    if (ch === '\n' || ch === ' ' || ch === '\t') return null;
    if (TRIGGERS.includes(ch as ComposerTrigger)) {
      // `/` 仅在行首或空白后触发（避免路径中的斜杠误触发）。
      if (ch === '/') {
        const prev = i > 0 ? text[i - 1] : '';
        if (prev && prev !== ' ' && prev !== '\n' && prev !== '\t') return null;
      }
      return { trigger: ch as ComposerTrigger, query: text.slice(i + 1, caret), start: i };
    }
  }
  return null;
}

export function Composer({
  disabled,
  placeholder,
  streaming,
  resolveItems,
  onSend,
  onCancel,
}: ComposerProps) {
  const [text, setText] = useState('');
  const [active, setActive] = useState<ActiveTrigger | null>(null);
  const [index, setIndex] = useState(0);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  const items = useMemo(
    () => (active ? resolveItems({ trigger: active.trigger, query: active.query }).slice(0, 8) : []),
    [active, resolveItems],
  );

  // 输入框高度自适应。
  useLayoutEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [text]);

  function refreshTrigger(value: string, caret: number) {
    const next = detectTrigger(value, caret);
    setActive(next);
    setIndex(0);
  }

  function onChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setText(value);
    refreshTrigger(value, e.target.selectionStart ?? value.length);
  }

  function pick(item: MenuItem) {
    if (!active) return;
    const before = text.slice(0, active.start);
    const after = text.slice(active.start + 1 + active.query.length);
    if (item.action) {
      // 副作用型（如 @agent: 切换）：移除触发 token，不插入文本。
      item.action();
      setText(`${before}${after.replace(/^\s+/, '')}`);
      setActive(null);
      requestAnimationFrame(() => {
        const ta = taRef.current;
        if (!ta) return;
        ta.focus();
        ta.setSelectionRange(before.length, before.length);
      });
      return;
    }
    const next = `${before}${item.insert} ${after}`;
    setText(next);
    setActive(null);
    requestAnimationFrame(() => {
      const ta = taRef.current;
      if (!ta) return;
      const caret = before.length + item.insert.length + 1;
      ta.focus();
      ta.setSelectionRange(caret, caret);
    });
  }

  function submit() {
    if (disabled || streaming) return;
    const value = text.trim();
    if (!value) return;
    onSend(value);
    setText('');
    setActive(null);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.nativeEvent.isComposing) return;
    if (active && items.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setIndex((i) => Math.min(i + 1, items.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        pick(items[index]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setActive(null);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="ai-composer">
      {active && items.length > 0 && (
        <ul className="ai-composer__menu" role="listbox">
          {items.map((it, i) => (
            <li
              key={it.key}
              className={`ai-composer__menu-item${i === index ? ' is-active' : ''}`}
              onMouseEnter={() => setIndex(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(it);
              }}
            >
              <span className="ai-composer__menu-label">{it.label}</span>
              {it.hint && <span className="ai-composer__menu-hint">{it.hint}</span>}
            </li>
          ))}
        </ul>
      )}
      <div className="ai-composer__row">
        <textarea
          ref={taRef}
          className="ai-composer__input"
          value={text}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onClick={(e) => refreshTrigger(text, e.currentTarget.selectionStart ?? 0)}
          placeholder={placeholder}
          rows={1}
          spellCheck={false}
          disabled={disabled}
        />
        {streaming ? (
          <button className="ai-composer__btn ai-composer__btn--stop" onClick={() => onCancel?.()}>
            ■
          </button>
        ) : (
          <button
            className="ai-composer__btn ai-composer__btn--send"
            onClick={submit}
            disabled={disabled || !text.trim()}
          >
            ↑
          </button>
        )}
      </div>
    </div>
  );
}

export default Composer;
