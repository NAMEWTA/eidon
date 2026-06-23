/**
 * MessageList —— AI 对话消息流渲染（仿 HanaAgent chat，复用 EIDON 既有 markdown 渲染）。
 *
 * 每条消息按 part 类型渲染：text（assistant 走 markdown / user 走纯文本气泡）/
 * thinking（可折叠思考块）/ tool（可展开的工具卡片，见 ToolCallCard）。
 * 每条消息悬停出现「复制」按钮（复制该条文本）。流式期间增量更新；自动滚动到底部。
 */
import { useEffect, useMemo, useRef, useState } from 'react';

import { useI18n } from '../../i18n';
import { renderMarkdown } from '../../lib/markdown';
import type { ChatMessage, ChatPart } from '../../stores/ai';
import { ToolCallCard } from './ToolCallCard';

/** assistant 文本 → 复用 EIDON 的 markdown-it 渲染（代码高亮/列表/表格/数学等）。 */
function MarkdownBlock({ text }: { text: string }) {
  const html = useMemo(() => renderMarkdown(text), [text]);
  return <div className="ai-md" dangerouslySetInnerHTML={{ __html: html }} />;
}

function ThinkingBlock({ text }: { text: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <div className="ai-msg__thinking">
      <button className="ai-msg__thinking-toggle" onClick={() => setOpen((v) => !v)}>
        {open ? '▾' : '▸'} {t('ai.thinking')}
      </button>
      {open && <pre className="ai-msg__thinking-body">{text}</pre>}
    </div>
  );
}

function Part({ part, role }: { part: ChatPart; role: ChatMessage['role'] }) {
  if (part.type === 'text') {
    return role === 'assistant'
      ? <MarkdownBlock text={part.text} />
      : <div className="ai-msg__text">{part.text}</div>;
  }
  if (part.type === 'thinking') return <ThinkingBlock text={part.text} />;
  return <ToolCallCard part={part} />;
}

/** 该条消息的可复制文本（仅 text part）。 */
function messageText(m: ChatMessage): string {
  return m.parts
    .filter((p): p is Extract<ChatPart, { type: 'text' }> => p.type === 'text')
    .map((p) => p.text)
    .join('\n\n')
    .trim();
}

function CopyButton({ text }: { text: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <button
      className={`ai-msg__copy${copied ? ' is-copied' : ''}`}
      title={copied ? t('ai.copied') : t('ai.copy')}
      onClick={() => {
        void navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {copied ? (
          <polyline points="20 6 9 17 4 12" />
        ) : (
          <>
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </>
        )}
      </svg>
    </button>
  );
}

export function MessageList({ messages, streaming }: { messages: ChatMessage[]; streaming: boolean }) {
  const { t } = useI18n();
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, streaming]);

  return (
    <div className="ai-messages">
      {messages.map((m) => {
        const text = messageText(m);
        return (
          <div key={m.id} className={`ai-msg ai-msg--${m.role}`}>
            <div className="ai-msg__role">
              {m.role === 'user' ? t('ai.you') : m.agentName || t('ai.assistant')}
            </div>
            <div className="ai-msg__body">
              {m.parts.length === 0 && streaming && m.role === 'assistant' ? (
                <div className="ai-msg__pending">{t('ai.streaming')}</div>
              ) : (
                m.parts.map((p, i) => <Part key={i} part={p} role={m.role} />)
              )}
            </div>
            {text && (
              <div className="ai-msg__actions">
                <CopyButton text={text} />
              </div>
            )}
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}

export default MessageList;
