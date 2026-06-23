/**
 * Composer —— AI 对话输入区（仿 HanaAgent InputArea）。
 *
 * 结构（自上而下）：
 *  - 上下文行：当前编辑器文件芯片（可移除），作为对话上下文。
 *  - 文本框：@ / $ 触发的自动补全；高度随内容自适应（上限 200px）。
 *  - 控制条：左=权限档 pill；右=思考强度 + 模型 + 发送/停止。
 *
 * 触发规则（光标前最近一个未被空白隔断的触发符）：
 *  - `@`            → 模糊匹配工作区文件/文件夹；`@agent:` 前缀 → 选择激活某 Agent。
 *  - `/`（行首/空白后）→ `skill:xxx` / `command:xxx` 选择激活/运行。
 *  - `$`            → 插入变量/上下文 token（$selection/$file/$date…）。
 * 菜单开启时 ↑/↓ 选择、Enter/Tab 确认、Esc 关闭；菜单关闭时 Enter 发送、Shift+Enter 换行。
 */
import { useLayoutEffect, useMemo, useRef, useState } from 'react';

import type { ModelInfo, ThinkingLevel } from '@shared/models';
import { useI18n } from '../../i18n';
import { PermissionModePill } from './PermissionModePill';

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
  /** 当前编辑器文件（上下文芯片）；null=无。 */
  contextFile?: string | null;
  onRemoveContext?: () => void;
  /** 模型选择（移入控制条）。 */
  models: ModelInfo[];
  modelKey: string;
  onModelChange: (key: string) => void;
  /** 思考强度选择。 */
  thinkingLevel: ThinkingLevel;
  onThinkingChange: (level: ThinkingLevel) => void;
}

const TRIGGERS: ComposerTrigger[] = ['@', '/', '$'];

/** 控制条可选的思考强度（off 不在内联档位，留给 Agent 设置）。 */
const THINKING_LEVELS: ThinkingLevel[] = ['minimal', 'low', 'medium', 'high', 'xhigh'];
const THINKING_LABEL: Record<string, string> = {
  off: '关闭',
  minimal: '极简',
  low: '浅',
  medium: '中',
  high: '深',
  xhigh: '极致',
};

function basename(p: string): string {
  const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
  return i >= 0 ? p.slice(i + 1) : p;
}

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
  contextFile,
  onRemoveContext,
  models,
  modelKey,
  onModelChange,
  thinkingLevel,
  onThinkingChange,
}: ComposerProps) {
  const { t } = useI18n();
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
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
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

      {/* 上下文行：当前编辑器文件芯片。 */}
      {contextFile && (
        <div className="ai-composer__context">
          <span className="ai-context-chip" title={contextFile}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span className="ai-context-chip__name">{basename(contextFile)}</span>
            {onRemoveContext && (
              <button className="ai-context-chip__remove" onClick={onRemoveContext} title="移除上下文">
                ×
              </button>
            )}
          </span>
        </div>
      )}

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

      {/* 控制条：左=权限档；右=思考强度 + 模型 + 发送/停止。 */}
      <div className="ai-composer__bar">
        <div className="ai-composer__bar-left">
          <PermissionModePill />
        </div>
        <div className="ai-composer__bar-right">
          <select
            className="ai-composer__select"
            value={thinkingLevel === 'off' ? 'medium' : thinkingLevel}
            onChange={(e) => onThinkingChange(e.target.value as ThinkingLevel)}
            title={t('ai.thinkingLevel')}
          >
            {THINKING_LEVELS.map((lv) => (
              <option key={lv} value={lv}>
                {THINKING_LABEL[lv] ?? lv}
              </option>
            ))}
          </select>
          <select
            className="ai-composer__select ai-composer__select--model"
            value={modelKey}
            onChange={(e) => onModelChange(e.target.value)}
            title={t('ai.selectModel')}
          >
            <option value="">{t('ai.defaultModel')}</option>
            {models.map((m) => (
              <option key={`${m.provider}/${m.id}`} value={`${m.provider}/${m.id}`}>
                {m.name}
              </option>
            ))}
          </select>
          {streaming ? (
            <button className="ai-composer__btn ai-composer__btn--stop" onClick={() => onCancel?.()} title={t('ai.cancel')}>
              ■
            </button>
          ) : (
            <button
              className="ai-composer__btn ai-composer__btn--send"
              onClick={submit}
              disabled={disabled || !text.trim()}
              title={t('ai.send')}
            >
              ↑
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default Composer;
