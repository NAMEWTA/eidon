/**
 * SessionHistoryPopover —— 标题栏「历史」浮层（仿 HanaAgent SessionList，但为浮层非常驻侧栏）。
 *
 * 列出当前 Agent 的历史会话（按更新时间倒序），点选即载入续聊；顶部「新对话」开新会话。
 */
import { useEffect, useRef } from 'react';

import { useI18n } from '../../i18n';
import { useAiStore } from '../../stores/ai';

/** 相对时间（刚刚 / N 分钟前 / N 小时前 / N 天前 / 日期）。 */
function relTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} 天前`;
  return new Date(then).toLocaleDateString();
}

export function SessionHistoryPopover({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const sessions = useAiStore((s) => s.sessions);
  const loadSession = useAiStore((s) => s.loadSession);
  const newChat = useAiStore((s) => s.newChat);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (ref.current?.contains(target)) return;
      // 触发按钮自行 toggle，避免双重切换。
      if (target.closest('[data-ai-history-trigger]')) return;
      onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div className="ai-history" ref={ref}>
      <div className="ai-history__head">
        <span className="ai-history__title-label">{t('ai.history')}</span>
        <button
          className="ai-history__new"
          onClick={() => {
            newChat();
            onClose();
          }}
        >
          ＋ {t('ai.newChat')}
        </button>
      </div>
      {sessions.length === 0 ? (
        <div className="ai-history__empty">{t('ai.noHistory')}</div>
      ) : (
        <ul className="ai-history__list">
          {sessions.map((s) => (
            <li key={s.sessionFile}>
              <button
                className="ai-history__item"
                onClick={() => {
                  void loadSession(s.sessionFile);
                  onClose();
                }}
                title={s.title}
              >
                <span className="ai-history__item-title">{s.title}</span>
                <span className="ai-history__item-meta">
                  {relTime(s.updatedAt)} · {s.messageCount} {t('ai.msgCount')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default SessionHistoryPopover;
