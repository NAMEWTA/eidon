/**
 * bridge/ipc/ai —— AI / providers 域 IPC 包装（渲染侧门面）。
 *
 * 请求-响应走 eidonInvoke；流式结果经 onStream / onSessionState 订阅 main→renderer 事件。
 */
import type {
  AgentActivity,
  AgentDetail,
  AgentSummary,
  AiSessionState,
  AiSessionSummary,
  AiStreamEvent,
  BridgeBinding,
  BridgeInbound,
  BridgeStatus,
  ChatMessageWire,
  CreateAgentInput,
  CronJob,
  CronJobInput,
  CronJobPatch,
  ModelInfo,
  ProviderInfo,
  SessionPermissionMode,
  SkillInfo,
  ThinkingLevel,
  ToolInfo,
  UpdateAgentPatch,
  WechatLoginState,
} from "@shared/models";
import type { BridgePlatform, Channel, ModelMeta, ModelRef } from "@shared/contracts";

import { eidonInvoke } from "./client";
import { listen, type UnlistenFn } from "./events";

export const aiBridge = {
  // providers / models
  isAvailable: (): Promise<boolean> => eidonInvoke("ai:isAvailable", {}),
  listProviders: (): Promise<ProviderInfo[]> => eidonInvoke("providers:list", {}),
  listModels: (provider?: string): Promise<ModelInfo[]> =>
    eidonInvoke("providers:listModels", { provider }),
  setKey: (provider: string, apiKey: string): Promise<void> =>
    eidonInvoke("providers:setKey", { provider, apiKey }),
  setDefaultModel: (model: ModelRef | null): Promise<void> =>
    eidonInvoke("providers:setDefaultModel", { model }),
  getDefaultModel: (): Promise<ModelRef | null> =>
    eidonInvoke("providers:getDefaultModel", {}),
  setProviderConfig: (
    provider: string,
    patch: { enabled?: boolean; baseUrl?: string | null; api?: string | null; headers?: Record<string, string> },
  ): Promise<void> => eidonInvoke("providers:setConfig", { provider, patch }),
  setModelMeta: (provider: string, modelId: string, meta: ModelMeta): Promise<void> =>
    eidonInvoke("providers:setModelMeta", { provider, modelId, meta }),
  removeModelMeta: (provider: string, modelId: string): Promise<void> =>
    eidonInvoke("providers:removeModelMeta", { provider, modelId }),
  removeProvider: (provider: string): Promise<void> =>
    eidonInvoke("providers:remove", { provider }),
  testProvider: (req: { provider: string; baseUrl: string; api: string; apiKey?: string }): Promise<boolean> =>
    eidonInvoke("providers:test", req),
  fetchProviderModels: (req: { provider: string; baseUrl: string; api: string; apiKey?: string }): Promise<string[]> =>
    eidonInvoke("providers:fetchModels", req),

  // sessions
  newSession: (req: {
    agentId?: string;
    workspace?: string;
    permissionMode?: SessionPermissionMode;
  }): Promise<{
    sessionId: string;
    state: AiSessionState;
  }> => eidonInvoke("ai:newSession", req),
  prompt: (sessionId: string, text: string): Promise<void> =>
    eidonInvoke("ai:prompt", { sessionId, text }),
  cancel: (sessionId: string): Promise<void> =>
    eidonInvoke("ai:cancel", { sessionId }),
  setModel: (sessionId: string, model: ModelRef): Promise<boolean> =>
    eidonInvoke("ai:setModel", { sessionId, model }),
  disposeSession: (sessionId: string): Promise<void> =>
    eidonInvoke("ai:disposeSession", { sessionId }),
  sessionState: (sessionId: string): Promise<AiSessionState | null> =>
    eidonInvoke("ai:sessionState", { sessionId }),
  /** 列出某 Agent 的历史会话（缺省取默认 Agent）。 */
  listSessions: (agentId?: string): Promise<AiSessionSummary[]> =>
    eidonInvoke("ai:listSessions", { agentId }),
  /** 载入历史会话续聊：建活会话 + 回放历史消息视图。 */
  loadSession: (
    sessionFile: string,
    agentId?: string,
  ): Promise<{ sessionId: string; state: AiSessionState; messages: ChatMessageWire[] }> =>
    eidonInvoke("ai:loadSession", { agentId, sessionFile }),
  /** 运行时切换会话权限档。 */
  setPermissionMode: (sessionId: string, mode: SessionPermissionMode): Promise<void> =>
    eidonInvoke("ai:setPermissionMode", { sessionId, mode }),
  /** 运行时切换会话推理强度。 */
  setThinkingLevel: (sessionId: string, level: ThinkingLevel): Promise<void> =>
    eidonInvoke("ai:setThinkingLevel", { sessionId, level }),
  /** ask 档下对某次工具调用批准/拒绝。 */
  approveTool: (sessionId: string, toolCallId: string, approved: boolean): Promise<void> =>
    eidonInvoke("ai:approveTool", { sessionId, toolCallId, approved }),

  // agents
  listAgents: (): Promise<AgentSummary[]> => eidonInvoke("agents:list", {}),
  getAgent: (agentId: string): Promise<AgentDetail | null> =>
    eidonInvoke("agents:get", { agentId }),
  createAgent: (input: CreateAgentInput): Promise<AgentSummary> =>
    eidonInvoke("agents:create", input),
  updateAgent: (agentId: string, patch: UpdateAgentPatch): Promise<AgentSummary> =>
    eidonInvoke("agents:update", { agentId, patch }),
  deleteAgent: (agentId: string): Promise<void> =>
    eidonInvoke("agents:delete", { agentId }),
  setDefaultAgent: (agentId: string | null): Promise<void> =>
    eidonInvoke("agents:setDefault", { agentId }),
  getDefaultAgent: (): Promise<string | null> =>
    eidonInvoke("agents:getDefault", {}),

  // tools
  listTools: (): Promise<ToolInfo[]> => eidonInvoke("tools:list", {}),
  setToolEnabled: (name: string, enabled: boolean): Promise<void> =>
    eidonInvoke("tools:setEnabled", { name, enabled }),
  listSkills: (workspace?: string): Promise<SkillInfo[]> =>
    eidonInvoke("skills:list", { workspace }),

  // cron（每 Agent 定时任务）
  listCron: (agentId: string): Promise<CronJob[]> =>
    eidonInvoke("cron:list", { agentId }),
  addCron: (agentId: string, input: CronJobInput): Promise<CronJob> =>
    eidonInvoke("cron:add", { agentId, input }),
  updateCron: (agentId: string, jobId: string, patch: CronJobPatch): Promise<CronJob | null> =>
    eidonInvoke("cron:update", { agentId, jobId, patch }),
  toggleCron: (agentId: string, jobId: string): Promise<CronJob | null> =>
    eidonInvoke("cron:toggle", { agentId, jobId }),
  removeCron: (agentId: string, jobId: string): Promise<void> =>
    eidonInvoke("cron:remove", { agentId, jobId }),

  // channels（多 Agent 群聊）
  listChannels: (): Promise<Channel[]> => eidonInvoke("channels:list", {}),
  createChannel: (name: string, members: string[]): Promise<Channel> =>
    eidonInvoke("channels:create", { name, members }),
  updateChannel: (id: string, patch: { name?: string; members?: string[] }): Promise<Channel | null> =>
    eidonInvoke("channels:update", { id, patch }),
  deleteChannel: (id: string): Promise<void> => eidonInvoke("channels:delete", { id }),
  promptChannel: (channelId: string, text: string, workspace?: string): Promise<void> =>
    eidonInvoke("channels:prompt", { channelId, text, workspace }),

  // bridge（多平台接入：飞书 + 微信官方 iLink）
  listBridgeBindings: (): Promise<BridgeBinding[]> => eidonInvoke("bridge:listBindings", {}),
  bridgeStatus: (): Promise<BridgeStatus[]> => eidonInvoke("bridge:status", {}),
  bindBridge: (req: {
    platform: BridgePlatform;
    agentId: string | null;
    creds?: Record<string, string>;
    enabled?: boolean;
  }): Promise<void> => eidonInvoke("bridge:bind", req),
  setBridgeEnabled: (platform: BridgePlatform, enabled: boolean): Promise<void> =>
    eidonInvoke("bridge:setEnabled", { platform, enabled }),
  unbindBridge: (platform: BridgePlatform): Promise<void> =>
    eidonInvoke("bridge:unbind", { platform }),
  wechatStartLogin: (): Promise<void> => eidonInvoke("bridge:wechatStartLogin", {}),
  wechatCancelLogin: (): Promise<void> => eidonInvoke("bridge:wechatCancelLogin", {}),

  // events
  onStream: (cb: (e: AiStreamEvent) => void): Promise<UnlistenFn> =>
    listen<AiStreamEvent>("eidon:ai-stream", ({ payload }) => cb(payload)),
  onSessionState: (cb: (s: AiSessionState) => void): Promise<UnlistenFn> =>
    listen<AiSessionState>("eidon:ai-session", ({ payload }) => cb(payload)),
  onActivity: (cb: (a: AgentActivity) => void): Promise<UnlistenFn> =>
    listen<AgentActivity>("eidon:agent-activity", ({ payload }) => cb(payload)),
  onBridgeStatus: (cb: (s: BridgeStatus) => void): Promise<UnlistenFn> =>
    listen<BridgeStatus>("eidon:bridge-status", ({ payload }) => cb(payload)),
  onBridgeInbound: (cb: (m: BridgeInbound) => void): Promise<UnlistenFn> =>
    listen<BridgeInbound>("eidon:bridge-inbound", ({ payload }) => cb(payload)),
  onWechatQr: (cb: (s: WechatLoginState) => void): Promise<UnlistenFn> =>
    listen<WechatLoginState>("eidon:bridge-wechat-qr", ({ payload }) => cb(payload)),
};
