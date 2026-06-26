/**
 * AiPanel —— 右抽屉 AI 对话面板（P1）。
 *
 * 未配置模型提供商 → 引导去「设置 → AI」；已配置 → 消息流 + Composer（@//$ 自动补全）。
 * 标题栏：对话对象选择 + 历史浮层 + 复制整段 + 新对话。模型/思考/权限档移入 Composer 控制条。
 * 打开时把当前编辑器文件作为对话上下文（Composer 上方芯片 + 发送时前置一行提示）。
 * @ 文件来自工作区索引；$ 变量为内置上下文 token；@agent: 与 /skill|command 框架就绪。
 */
import { useCallback, useEffect, useState } from 'react';

import { aiBridge } from '@bridge/ipc';
import type { ModelRef, SkillInfo, ThinkingLevel } from '@shared/models';
import { useI18n } from '../../i18n';
import { useAiStore } from '../../stores/ai';
import { useTabsStore } from '../../stores/tabs';
import { useWorkspaceStore } from '../../stores/workspace';
import { useWorkspaceIndexStore } from '../../stores/workspaceIndex';
import { Composer, type ComposerTrigger, type MenuItem } from './Composer';
import { MessageList } from './MessageList';
import { SessionHistoryPopover } from './SessionHistoryPopover';

/** 内置 $ 变量（发送时对部分做客户端展开）。 */
const VARIABLES: { name: string; hint: string }[] = [
  { name: 'selection', hint: '当前选中文本' },
  { name: 'file', hint: '当前文件' },
  { name: 'node', hint: '当前节点' },
  { name: 'date', hint: '今天日期' },
  { name: 'workspace', hint: '工作区路径' },
];

function basename(p: string): string {
  const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
  return i >= 0 ? p.slice(i + 1) : p;
}

/** 子序列模糊匹配（query 字符按序出现即命中）。 */
function fuzzy(query: string, target: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  let i = 0;
  for (const ch of t) {
    if (ch === q[i]) i++;
    if (i === q.length) return true;
  }
  return i === q.length;
}

function modelKey(m: ModelRef | null): string {
  return m ? `${m.provider}/${m.id}` : '';
}

export function AiPanel() {
  const { t } = useI18n();
  const store = useAiStore();
  const currentFolder = useWorkspaceStore((s) => s.currentFolder);
  const entries = useWorkspaceIndexStore((s) => s.entries);
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [copiedAll, setCopiedAll] = useState(false);

  // 当前编辑器文件 → 对话上下文芯片（随活动标签变化）。
  const activeFilePath = useTabsStore((s) => {
    const tab = s.tabs.find((x) => x.id === s.activeId);
    return tab?.filePath ?? tab?.fileName ?? null;
  });

  useEffect(() => {
    void store.init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    store.setContextFile(activeFilePath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilePath]);

  // 发现可用 skills（随工作区变化刷新）。
  useEffect(() => {
    void aiBridge.listSkills(currentFolder ?? undefined).then(setSkills);
  }, [currentFolder]);

  /** composer `/` 的内置命令（动作型）。 */
  const COMMANDS: { name: string; hint: string; run: () => void }[] = [
    { name: 'new', hint: '开始新对话', run: () => store.newChat() },
    { name: 'clear', hint: '清空当前对话', run: () => store.newChat() },
  ];

  const resolveItems = useCallback(
    ({ trigger, query }: { trigger: ComposerTrigger; query: string }): MenuItem[] => {
      if (trigger === '@') {
        if (query.startsWith('agent:')) {
          // @agent: 选择激活某个 Agent（切换当前对话绑定的 Agent）。
          const aq = query.slice('agent:'.length);
          return store.agents
            .filter((a) => fuzzy(aq, a.name) || fuzzy(aq, a.id))
            .slice(0, 8)
            .map((a) => ({
              key: a.id,
              label: a.name,
              hint: a.description || a.id,
              insert: '',
              action: () => store.setActiveAgent(a.id),
            }));
        }
        return entries
          .filter((e) => fuzzy(query, e.name) || fuzzy(query, e.path))
          .slice(0, 8)
          .map((e) => ({
            key: e.path,
            label: e.name,
            hint: e.path,
            insert: `@${e.path}`,
          }));
      }
      if (trigger === '/') {
        // /skill:X 激活技能（插入指令）；/command:X 运行命令（动作）。裸 / 同时列两类。
        const skillItems: MenuItem[] = skills.map((s) => ({
          key: `skill:${s.name}`,
          label: `skill:${s.name}`,
          hint: s.description,
          insert: `请运用「${s.name}」技能：`,
        }));
        const commandItems: MenuItem[] = COMMANDS.map((c) => ({
          key: `command:${c.name}`,
          label: `command:${c.name}`,
          hint: c.hint,
          insert: '',
          action: c.run,
        }));
        if (query.startsWith('skill:')) {
          const q = query.slice('skill:'.length);
          return skillItems.filter((it) => fuzzy(q, it.label));
        }
        if (query.startsWith('command:')) {
          const q = query.slice('command:'.length);
          return commandItems.filter((it) => fuzzy(q, it.label));
        }
        return [...skillItems, ...commandItems].filter((it) => fuzzy(query, it.label));
      }
      // $ 变量
      return VARIABLES.filter((v) => fuzzy(query, v.name)).map((v) => ({
        key: v.name,
        label: `$${v.name}`,
        hint: v.hint,
        insert: `$${v.name}`,
      }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entries, store.agents, skills],
  );

  /** 发送前展开部分 $ 变量（其余保留字面，供 Agent/后续解析）。 */
  const expand = useCallback(
    (text: string): string =>
      text
        .replace(/\$date\b/g, new Date().toISOString().slice(0, 10))
        .replace(/\$workspace\b/g, currentFolder ?? '')
        .replace(/\$file\b/g, () => {
          const cf = currentFolder;
          return cf ? basename(cf) : '$file';
        }),
    [currentFolder],
  );

  const onSend = useCallback(
    (text: string) => {
      const expanded = expand(text);
      // 当前编辑器文件作为上下文：前置一行轻量提示，Agent 可据此用 read 打开。
      const cf = store.contextFile;
      const prefixed = cf ? `[当前查看文件：${cf}]\n${expanded}` : expanded;
      void store.send(prefixed, currentFolder ?? undefined);
    },
    [store, expand, currentFolder],
  );

  function openSettings() {
    window.dispatchEvent(new CustomEvent('eidon:open-settings', { detail: { section: 'ai' } }));
  }

  function copyAll() {
    const text = store.messages
      .map((m) => {
        const who = m.role === 'user' ? t('ai.you') : m.agentName || t('ai.assistant');
        const body = m.parts
          .filter((p): p is Extract<typeof p, { type: 'text' }> => p.type === 'text')
          .map((p) => p.text)
          .join('\n')
          .trim();
        return body ? `${who}:\n${body}` : '';
      })
      .filter(Boolean)
      .join('\n\n');
    if (!text) return;
    void navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 1200);
  }

  const selectValue = store.activeChannelId
    ? `channel:${store.activeChannelId}`
    : store.activeAgentId
      ? `agent:${store.activeAgentId}`
      : '';

  function onSelectTarget(value: string) {
    if (value.startsWith('channel:')) store.setActiveChannel(value.slice('channel:'.length));
    else if (value.startsWith('agent:')) store.setActiveAgent(value.slice('agent:'.length));
    else store.setActiveAgent(null);
  }

  // 「默认助手」解析名：设置里指定的 defaultAgentId（仍存在时）→ 否则首个 Agent。
  const defaultAgent =
    (store.defaultAgentId ? store.agents.find((a) => a.id === store.defaultAgentId) : null) ?? store.agents[0] ?? null;

  // 当前会话模型：用户选 > 会话态 > 该 Agent 默认 > 全局默认。
  const activeAgent = store.agents.find((a) => a.id === store.activeAgentId) ?? null;
  const displayModel = store.selectedModel ?? store.model ?? activeAgent?.model ?? store.defaultModel;

  const onModelChange = (v: string) => {
    const i = v.indexOf('/');
    store.selectModel(i > 0 ? { provider: v.slice(0, i), id: v.slice(i + 1) } : null);
  };

  return (
    <div className="ai-panel">
      <div className="ai-panel__header">
        <select
          className="ai-panel__target"
          value={selectValue}
          onChange={(e) => onSelectTarget(e.target.value)}
          title="切换对话对象（Agent / 群聊频道）"
        >
          <option value="">{defaultAgent ? `默认助手（${defaultAgent.name}）` : '默认助手'}</option>
          {store.agents.length > 0 && (
            <optgroup label="Agent">
              {store.agents.map((a) => (
                <option key={a.id} value={`agent:${a.id}`}>{a.name}</option>
              ))}
            </optgroup>
          )}
          {store.channels.length > 0 && (
            <optgroup label="群聊">
              {store.channels.map((c) => (
                <option key={c.id} value={`channel:${c.id}`}>＃{c.name}</option>
              ))}
            </optgroup>
          )}
        </select>

        <div className="ai-panel__header-actions">
          <div className="ai-panel__history-wrap">
            <button
              className="ai-panel__icon-btn"
              data-ai-history-trigger
              onClick={() => store.setHistoryOpen(!store.historyOpen)}
              title={t('ai.history')}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v5h5" />
                <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
                <path d="M12 7v5l3 2" />
              </svg>
            </button>
            {store.historyOpen && <SessionHistoryPopover onClose={() => store.setHistoryOpen(false)} />}
          </div>
          <button
            className={`ai-panel__icon-btn${copiedAll ? ' is-copied' : ''}`}
            onClick={copyAll}
            disabled={store.messages.length === 0}
            title={t('ai.copyAll')}
          >
            {copiedAll ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
          </button>
          <button className="ai-panel__icon-btn" onClick={() => store.newChat()} title={t('ai.newChat')}>
            ＋
          </button>
        </div>
      </div>

      {!store.available ? (
        <div className="ai-panel__setup">
          <p className="ai-panel__setup-title">{t('ai.notConfigured')}</p>
          <p className="ai-panel__setup-hint">{t('ai.configureHint')}</p>
          <button className="ai-panel__setup-btn" onClick={openSettings}>
            {t('ai.openSettings')}
          </button>
        </div>
      ) : (
        <>
          <MessageList messages={store.messages} streaming={store.isStreaming} />
          {store.error && (
            <div className="ai-panel__error">
              {t('ai.errorPrefix')}: {store.error}
            </div>
          )}
          <Composer
            placeholder={t('ai.placeholder')}
            streaming={store.isStreaming}
            resolveItems={resolveItems}
            onSend={onSend}
            onCancel={() => void store.cancel()}
            contextFile={store.contextFile}
            onRemoveContext={() => store.setContextFile(null)}
            models={store.activeChannelId ? [] : store.models}
            modelKey={modelKey(displayModel)}
            onModelChange={onModelChange}
            thinkingLevel={store.thinkingLevel as ThinkingLevel}
            onThinkingChange={(lv) => store.setThinkingLevel(lv)}
          />
        </>
      )}
    </div>
  );
}

export default AiPanel;
