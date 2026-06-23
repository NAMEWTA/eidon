/**
 * ToolCallCard —— 单条工具调用卡片（仿 HanaAgent ToolGroupBlock）。
 *
 * 折叠头：工具名 + 从入参提炼的摘要（文件路径/命令/查询…）+ 状态（运行…/✓/✗）。
 * 展开：入参（美化 JSON）+ 结果。ask 档待批准时，卡片内嵌「批准/拒绝」按钮。
 * 这是修复「工具无法展开看具体内容」的核心组件。
 */
import { useState } from 'react';

import { useI18n } from '../../i18n';
import { useAiStore, type ChatPart } from '../../stores/ai';

type ToolPart = Extract<ChatPart, { type: 'tool' }>;

/** 从入参里提炼一行人类可读摘要（常见字段优先）。 */
function summarizeArgs(args: unknown): string {
  if (!args || typeof args !== 'object') return '';
  const a = args as Record<string, unknown>;
  const pick =
    a.path ?? a.file ?? a.filePath ?? a.command ?? a.query ?? a.pattern ?? a.agent ?? a.title ?? a.url;
  return typeof pick === 'string' ? pick : '';
}

/** 入参美化为可读文本。 */
function prettyArgs(args: unknown): string {
  if (args == null) return '';
  if (typeof args === 'string') return args;
  try {
    return JSON.stringify(args, null, 2);
  } catch {
    return String(args);
  }
}

export function ToolCallCard({ part }: { part: ToolPart }) {
  const { t } = useI18n();
  const approveTool = useAiStore((s) => s.approveTool);
  const [open, setOpen] = useState(false);

  const pending = part.approval === 'pending';
  const denied = part.approval === 'denied';
  const summary = summarizeArgs(part.args);
  const hasBody = part.args != null || part.result.length > 0;

  const statusClass = denied
    ? 'is-denied'
    : part.isError
      ? 'is-error'
      : !part.done
        ? 'is-running'
        : 'is-done';

  return (
    <div className={`ai-tool ${statusClass}${pending ? ' is-pending' : ''}`}>
      <button
        className="ai-tool__head"
        onClick={() => setOpen((v) => !v)}
        disabled={!hasBody}
        title={summary || part.toolName}
      >
        <span className="ai-tool__chevron">{hasBody ? (open ? '▾' : '▸') : '·'}</span>
        <span className="ai-tool__name">{part.toolName}</span>
        {summary && <span className="ai-tool__summary">{summary}</span>}
        <span className="ai-tool__status">
          {denied ? '⊘' : part.isError ? '✗' : !part.done ? <span className="ai-tool__spinner" /> : '✓'}
        </span>
      </button>

      {pending && (
        <div className="ai-tool__approval">
          <span className="ai-tool__approval-text">{t('ai.awaitingApproval')}</span>
          <div className="ai-tool__approval-actions">
            <button
              className="ai-tool__btn ai-tool__btn--deny"
              onClick={() => approveTool(part.toolCallId, false)}
            >
              {t('ai.deny')}
            </button>
            <button
              className="ai-tool__btn ai-tool__btn--approve"
              onClick={() => approveTool(part.toolCallId, true)}
            >
              {t('ai.approve')}
            </button>
          </div>
        </div>
      )}

      {open && hasBody && (
        <div className="ai-tool__body">
          {part.args != null && (
            <div className="ai-tool__section">
              <div className="ai-tool__label">{t('ai.toolArgs')}</div>
              <pre className="ai-tool__pre">{prettyArgs(part.args)}</pre>
            </div>
          )}
          {part.result && (
            <div className="ai-tool__section">
              <div className="ai-tool__label">{t('ai.toolResult')}</div>
              <pre className="ai-tool__pre">{part.result}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ToolCallCard;
