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
  AiStreamEvent,
  ModelInfo,
  ModelRef,
  ProviderInfo,
} from '@shared/models';

import type { Channel } from '@shared/contracts';

import { useToastsStore } from './toasts';

export type ChatPart =
  | { type: 'text'; text: string }
  | { type: 'thinking'; text: string }
  | { type: 'tool'; toolCallId: string; toolName: string; output: string; isError: boolean; done: boolean };

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

  async init() {
    if (get().ready) return;
    set({ ready: true });
    // 订阅流 + 会话状态 + 后台活动事件（仅一次）。
    if (!unsubscribe) {
      const offStream = await aiBridge.onStream((e) => get()._ingest(e));
      const offState = await aiBridge.onSessionState((s: AiSessionState) =>
        set({ isStreaming: s.isStreaming, model: s.model, sessionId: s.sessionId }),
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
    });
    set({ sessionId, model: state.model, isStreaming: state.isStreaming });
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
              { type: 'tool', toolCallId: e.toolCallId, toolName: e.toolName, output: '', isError: false, done: false },
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
                ? { ...p, output: p.output + e.chunk }
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
                ? { ...p, isError: e.isError, done: true }
                : p,
            ),
          })),
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
