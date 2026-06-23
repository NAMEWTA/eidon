/**
 * AI 对话 store（Zustand v5）。
 *
 * 订阅 main→renderer 的 `eidon:ai-stream` / `eidon:ai-session` 事件，把扁平流事件累积为可渲染
 * 的消息视图模型（text / thinking / tool 三类 part）。请求经 `aiBridge`（bridge/ipc/ai）。
 */
import { create } from 'zustand';

import { aiBridge, notification } from '@bridge/ipc';
import type {
  AgentActivity,
  AgentSummary,
  AiSessionState,
  AiSessionSummary,
  AiStreamEvent,
  ModelInfo,
  ModelRef,
  ProviderInfo,
  SessionPermissionMode,
  ThinkingLevel,
} from '@shared/models';

import type { Channel } from '@shared/contracts';

import { useToastsStore } from './toasts';

export type ChatPart =
  | { type: 'text'; text: string }
  | { type: 'thinking'; text: string }
  | {
      type: 'tool';
      toolCallId: string;
      toolName: string;
      /** 工具入参（pi tool_execution_start 带）；展开工具卡片时显示。 */
      args?: unknown;
      /** 工具结果（流式累积 + tool_end 的最终结果）。 */
      result: string;
      isError: boolean;
      done: boolean;
      /** ask 档审批态：pending=等用户批准，approved/denied=已决。 */
      approval?: 'pending' | 'approved' | 'denied';
    };

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  parts: ChatPart[];
  /** 群聊中此条发言的 Agent 名（用于标注发言人）。 */
  agentName?: string;
}

interface AiState {
  ready: boolean;
  available: boolean;
  sessionId: string | null;
  isStreaming: boolean;
  model: ModelRef | null;
  /** 用户在对话面板手动选择的模型（null = 用当前 Agent/全局默认）；切 Agent 时重置。 */
  selectedModel: ModelRef | null;
  messages: ChatMessage[];
  error: string | null;
  providers: ProviderInfo[];
  models: ModelInfo[];
  defaultModel: ModelRef | null;
  agents: AgentSummary[];
  /** 当前对话绑定的 Agent（null = 默认）。 */
  activeAgentId: string | null;
  channels: Channel[];
  /** 当前绑定的群聊频道（非 null = 群聊模式）。 */
  activeChannelId: string | null;
  /** 最近的 Agent 后台活动（cron/notify 回灌），最新在前。 */
  activities: AgentActivity[];
  /** 当前会话工具权限档（操作前询问/自动审核/完整权限/只读）。 */
  permissionMode: SessionPermissionMode;
  /** 当前会话推理强度（随会话状态回灌）。 */
  thinkingLevel: ThinkingLevel;
  /** 当前 Agent 的历史会话列表（标题栏历史浮层用）。 */
  sessions: AiSessionSummary[];
  /** 历史浮层是否展开。 */
  historyOpen: boolean;
  /** 当前编辑器打开的文件（作为对话上下文芯片；null=无/已移除）。 */
  contextFile: string | null;
}

interface AiActions {
  /** 首次挂载：订阅事件 + 拉取可用性/提供商/模型（幂等）。 */
  init(): Promise<void>;
  refreshConfig(): Promise<void>;
  refreshAgents(): Promise<void>;
  refreshChannels(): Promise<void>;
  setActiveAgent(agentId: string | null): void;
  setActiveChannel(channelId: string | null): void;
  ensureSession(workspace?: string): Promise<void>;
  send(text: string, workspace?: string): Promise<void>;
  cancel(): Promise<void>;
  newChat(): void;
  /** 刷新当前 Agent 的历史会话列表。 */
  refreshSessions(): Promise<void>;
  /** 载入一个历史会话续聊（回放历史 + 切活会话）。 */
  loadSession(sessionFile: string): Promise<void>;
  /** 切换工具权限档（有活会话则即时下发后端）。 */
  setPermissionMode(mode: SessionPermissionMode): void;
  /** 切换推理强度（有活会话则即时下发后端）。 */
  setThinkingLevel(level: ThinkingLevel): void;
  /** ask 档下对某次工具调用批准/拒绝。 */
  approveTool(toolCallId: string, approved: boolean): void;
  /** 设置/清除作为上下文的当前编辑器文件。 */
  setContextFile(path: string | null): void;
  /** 开关历史浮层。 */
  setHistoryOpen(open: boolean): void;
  setProviderKey(provider: string, apiKey: string): Promise<void>;
  setDefaultModel(model: ModelRef | null): Promise<void>;
  switchModel(model: ModelRef): Promise<void>;
  /** 对话面板选择模型：记住选择，有会话则即时切换。 */
  selectModel(model: ModelRef | null): void;
  /** 内部：消费一条流事件。 */
  _ingest(e: AiStreamEvent): void;
}

const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

/** 取（或在末尾新建）当前流式 assistant 气泡，返回新 messages 数组。 */
function withLastAssistant(
  messages: ChatMessage[],
  update: (msg: ChatMessage) => ChatMessage,
): ChatMessage[] {
  const idx = messages.length - 1;
  if (idx < 0 || messages[idx].role !== 'assistant') {
    return [...messages, update({ id: uid(), role: 'assistant', parts: [] })];
  }
  const next = messages.slice();
  next[idx] = update(messages[idx]);
  return next;
}

/** 把增量追加到指定 part 类型的「最后一个同类 part」，否则新建。 */
function appendToPart(
  parts: ChatPart[],
  kind: 'text' | 'thinking',
  delta: string,
): ChatPart[] {
  const idx = parts.length - 1;
  if (idx >= 0 && parts[idx].type === kind) {
    const next = parts.slice();
    const p = next[idx] as { type: 'text' | 'thinking'; text: string };
    next[idx] = { type: kind, text: p.text + delta };
    return next;
  }
  return [...parts, { type: kind, text: delta }];
}

let unsubscribe: (() => void) | null = null;

export const useAiStore = create<AiState & AiActions>()((set, get) => ({
  ready: false,
  available: false,
  sessionId: null,
  isStreaming: false,
  model: null,
  selectedModel: null,
  messages: [],
  error: null,
  providers: [],
  models: [],
  defaultModel: null,
  agents: [],
  activeAgentId: null,
  channels: [],
  activeChannelId: null,
  activities: [],
  permissionMode: 'auto',
  thinkingLevel: 'medium',
  sessions: [],
  historyOpen: false,
  contextFile: null,

  async init() {
    if (get().ready) return;
    set({ ready: true });
    // 订阅流 + 会话状态 + 后台活动事件（仅一次）。
    if (!unsubscribe) {
      const offStream = await aiBridge.onStream((e) => get()._ingest(e));
      const offState = await aiBridge.onSessionState((s: AiSessionState) =>
        set({
          isStreaming: s.isStreaming,
          model: s.model,
          sessionId: s.sessionId,
          permissionMode: s.permissionMode,
          thinkingLevel: s.thinkingLevel,
        }),
      );
      const offActivity = await aiBridge.onActivity((a) => {
        set((s) => ({ activities: [a, ...s.activities].slice(0, 50) }));
        const title = `${a.agentName} · ${a.label}`;
        if (a.status === 'error') useToastsStore.getState().error(title);
        else useToastsStore.getState().info(title);
        // 系统通知（关窗隐藏到托盘时仍可送达）。
        if (a.notify) void notification.notify({ title, body: a.summary });
      });
      unsubscribe = () => {
        offStream();
        offState();
        offActivity();
      };
    }
    await get().refreshConfig();
  },

  async refreshConfig() {
    const [available, providers, models, defaultModel, agents, channels] = await Promise.all([
      aiBridge.isAvailable(),
      aiBridge.listProviders(),
      aiBridge.listModels(),
      aiBridge.getDefaultModel(),
      aiBridge.listAgents(),
      aiBridge.listChannels(),
    ]);
    set({ available, providers, models, defaultModel, agents, channels });
  },

  async refreshAgents() {
    set({ agents: await aiBridge.listAgents() });
  },

  async refreshChannels() {
    set({ channels: await aiBridge.listChannels() });
  },

  setActiveAgent(agentId: string | null) {
    if (get().activeAgentId === agentId && !get().activeChannelId) return;
    const old = get().sessionId;
    if (old) void aiBridge.disposeSession(old);
    set({
      activeAgentId: agentId,
      activeChannelId: null,
      sessionId: null,
      selectedModel: null,
      messages: [],
      isStreaming: false,
      error: null,
    });
  },

  setActiveChannel(channelId: string | null) {
    if (get().activeChannelId === channelId) return;
    const old = get().sessionId;
    if (old) void aiBridge.disposeSession(old);
    set({
      activeChannelId: channelId,
      sessionId: null,
      selectedModel: null,
      messages: [],
      isStreaming: false,
      error: null,
    });
  },

  async ensureSession(workspace?: string) {
    if (get().sessionId) return;
    const { sessionId, state } = await aiBridge.newSession({
      agentId: get().activeAgentId ?? undefined,
      workspace,
      permissionMode: get().permissionMode,
    });
    set({ sessionId, model: state.model, isStreaming: state.isStreaming, permissionMode: state.permissionMode });
    // 用户在面板里手动选过模型 → 在新会话上即时应用（覆盖 Agent 默认）。
    const sel = get().selectedModel;
    if (sel && (sel.provider !== state.model?.provider || sel.id !== state.model?.id)) {
      await aiBridge.setModel(sessionId, sel);
      set({ model: sel });
    }
  },

  async send(text: string, workspace?: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    set({ error: null });

    // 群聊模式：广播给频道成员（各自依次作答）。
    const channelId = get().activeChannelId;
    if (channelId) {
      set((s) => ({
        messages: [...s.messages, { id: uid(), role: 'user', parts: [{ type: 'text', text: trimmed }] }],
        isStreaming: true,
      }));
      try {
        await aiBridge.promptChannel(channelId, trimmed, workspace);
      } catch (err) {
        set({ error: err instanceof Error ? err.message : String(err), isStreaming: false });
      }
      return;
    }

    // 单 Agent 模式。
    await get().ensureSession(workspace);
    const sessionId = get().sessionId;
    if (!sessionId) {
      set({ error: 'no session' });
      return;
    }
    // 先落用户气泡，再发请求（流式回复经事件回填 assistant 气泡）。
    set((s) => ({
      messages: [...s.messages, { id: uid(), role: 'user', parts: [{ type: 'text', text: trimmed }] }],
      isStreaming: true,
    }));
    try {
      await aiBridge.prompt(sessionId, trimmed);
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), isStreaming: false });
    }
  },

  async cancel() {
    const sessionId = get().sessionId;
    if (sessionId) await aiBridge.cancel(sessionId);
    set({ isStreaming: false });
  },

  newChat() {
    const old = get().sessionId;
    if (old) void aiBridge.disposeSession(old);
    set({ sessionId: null, messages: [], isStreaming: false, error: null });
    void get().refreshSessions();
  },

  async refreshSessions() {
    // 群聊模式无持久化历史会话列表。
    if (get().activeChannelId) {
      set({ sessions: [] });
      return;
    }
    try {
      const sessions = await aiBridge.listSessions(get().activeAgentId ?? undefined);
      set({ sessions });
    } catch {
      set({ sessions: [] });
    }
  },

  async loadSession(sessionFile: string) {
    const old = get().sessionId;
    if (old) void aiBridge.disposeSession(old);
    set({ messages: [], isStreaming: false, error: null, historyOpen: false });
    try {
      const { sessionId, state, messages } = await aiBridge.loadSession(
        sessionFile,
        get().activeAgentId ?? undefined,
      );
      set({
        sessionId,
        model: state.model,
        permissionMode: state.permissionMode,
        messages,
        isStreaming: state.isStreaming,
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  setPermissionMode(mode: SessionPermissionMode) {
    set({ permissionMode: mode });
    const sessionId = get().sessionId;
    if (sessionId) void aiBridge.setPermissionMode(sessionId, mode);
  },

  setThinkingLevel(level: ThinkingLevel) {
    set({ thinkingLevel: level });
    const sessionId = get().sessionId;
    if (sessionId) void aiBridge.setThinkingLevel(sessionId, level);
  },

  approveTool(toolCallId: string, approved: boolean) {
    const sessionId = get().sessionId;
    if (!sessionId) return;
    // 乐观更新审批态（最终以 tool_end 收敛）。
    set((s) => ({
      messages: s.messages.map((m) => ({
        ...m,
        parts: m.parts.map((p) =>
          p.type === 'tool' && p.toolCallId === toolCallId
            ? { ...p, approval: approved ? 'approved' : 'denied' }
            : p,
        ),
      })),
    }));
    void aiBridge.approveTool(sessionId, toolCallId, approved);
  },

  setContextFile(path: string | null) {
    set({ contextFile: path });
  },

  setHistoryOpen(open: boolean) {
    set({ historyOpen: open });
    if (open) void get().refreshSessions();
  },

  async setProviderKey(provider: string, apiKey: string) {
    await aiBridge.setKey(provider, apiKey);
    await get().refreshConfig();
  },

  async setDefaultModel(model: ModelRef | null) {
    await aiBridge.setDefaultModel(model);
    set({ defaultModel: model });
  },

  async switchModel(model: ModelRef) {
    const sessionId = get().sessionId;
    if (sessionId) await aiBridge.setModel(sessionId, model);
    set({ model });
  },

  selectModel(model: ModelRef | null) {
    set({ selectedModel: model, model });
    const sessionId = get().sessionId;
    if (sessionId && model) void aiBridge.setModel(sessionId, model);
  },

  _ingest(e: AiStreamEvent) {
    switch (e.kind) {
      case 'message_start':
        set((s) => ({
          messages: [
            ...s.messages,
            { id: uid(), role: 'assistant', parts: [], agentName: e.agentName },
          ],
        }));
        break;
      case 'text_delta':
        set((s) => ({
          messages: withLastAssistant(s.messages, (m) => ({
            ...m,
            parts: appendToPart(m.parts, 'text', e.delta),
          })),
        }));
        break;
      case 'thinking_delta':
        set((s) => ({
          messages: withLastAssistant(s.messages, (m) => ({
            ...m,
            parts: appendToPart(m.parts, 'thinking', e.delta),
          })),
        }));
        break;
      case 'tool_start':
        set((s) => ({
          messages: withLastAssistant(s.messages, (m) => ({
            ...m,
            parts: [
              ...m.parts,
              {
                type: 'tool',
                toolCallId: e.toolCallId,
                toolName: e.toolName,
                args: e.args,
                result: '',
                isError: false,
                done: false,
              },
            ],
          })),
        }));
        break;
      case 'tool_update':
        set((s) => ({
          messages: withLastAssistant(s.messages, (m) => ({
            ...m,
            parts: m.parts.map((p) =>
              p.type === 'tool' && p.toolCallId === e.toolCallId
                ? { ...p, result: p.result + e.chunk }
                : p,
            ),
          })),
        }));
        break;
      case 'tool_end':
        set((s) => ({
          messages: withLastAssistant(s.messages, (m) => ({
            ...m,
            parts: m.parts.map((p) =>
              p.type === 'tool' && p.toolCallId === e.toolCallId
                ? {
                    ...p,
                    isError: e.isError,
                    done: true,
                    // 有最终结果则以其为准（覆盖流式累积）；审批态收敛为已批准。
                    result: e.result != null && e.result !== '' ? e.result : p.result,
                    approval: p.approval === 'pending' ? 'approved' : p.approval,
                  }
                : p,
            ),
          })),
        }));
        break;
      case 'tool_approval':
        // ask 档：把对应工具 part 标为待批准（若 tool_start 尚未到，先建一个占位 part）。
        set((s) => ({
          messages: withLastAssistant(s.messages, (m) => {
            const exists = m.parts.some((p) => p.type === 'tool' && p.toolCallId === e.toolCallId);
            if (exists) {
              return {
                ...m,
                parts: m.parts.map((p) =>
                  p.type === 'tool' && p.toolCallId === e.toolCallId
                    ? { ...p, approval: 'pending', args: p.args ?? e.args }
                    : p,
                ),
              };
            }
            return {
              ...m,
              parts: [
                ...m.parts,
                {
                  type: 'tool',
                  toolCallId: e.toolCallId,
                  toolName: e.toolName,
                  args: e.args,
                  result: '',
                  isError: false,
                  done: false,
                  approval: 'pending',
                },
              ],
            };
          }),
        }));
        break;
      case 'done':
        set({ isStreaming: false });
        break;
      case 'error':
        set({ isStreaming: false, error: e.message });
        break;
      case 'message_end':
      default:
        break;
    }
  },
}));
