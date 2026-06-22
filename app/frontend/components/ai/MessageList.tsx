/**
 * MessageList —— AI 对话消息流渲染（参考 HanaAgent chat，复用 EIDON 既有 markdown 渲染）。
 *
 * 每条消息按 part 类型渲染：text（assistant 走 markdown / user 走纯文本气泡）/
 * thinking（可折叠思考块）/ tool（工具调用 + 输出）。流式期间增量更新；自动滚动到底部。
 */
import { useEffect, useMemo, useRef, useState } from 'react';

import { useI18n } from '../../i18n';
import { renderMarkdown } from '../../lib/markdown';
import type { ChatMessage, ChatPart } from '../../stores/ai';

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

function ToolBlock({ part }: { part: Extract<ChatPart, { type: 'tool' }> }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <div className={`ai-msg__tool${part.isError ? ' is-error' : ''}`}>
      <button className="ai-msg__tool-toggle" onClick={() => setOpen((v) => !v)}>
        {open ? '▾' : '▸'} {t('ai.toolCall')}: <code>{part.toolName}</code>
        {!part.done && <span className="ai-msg__tool-spin"> …</span>}
      </button>
      {open && part.output && <pre className="ai-msg__tool-body">{part.output}</pre>}
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
  return <ToolBlock part={part} />;
}

export function MessageList({ messages, streaming }: { messages: ChatMessage[]; streaming: boolean }) {
  const { t } = useI18n();
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, streaming]);

  return (
    <div className="ai-messages">
      {messages.map((m) => (
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
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}

export default MessageList;
