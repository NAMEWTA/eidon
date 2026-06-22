/**
 * backend/services/ai-service —— AI-Native 子系统编排层。
 *
 * 把 capability IO（凭证/Agent 文件夹，`capabilities/ai`）与 Pi SDK 会话内核（`domain/ai`）缝合，
 * 并经 `ipc/emit` 把流式事件推送给渲染层。持有会话注册表（sessionId → AiSession）。
 * 不 import electron（emit 走 backend-events）。
 */
import { promises as fs } from "node:fs";
import { resolve as resolvePath, sep as pathSep } from "node:path";

import { createNodeId } from "@shared/utils";
import type { AgentConfig, Channel, ModelMeta } from "@shared/contracts";
import type {
  AgentActivity,
  AgentDetail,
  AgentSummary,
  AiSessionState,
  BridgeBinding,
  BridgePlatform,
  BridgeStatus,
  CreateAgentInput,
  CronJob,
  CronJobInput,
  CronJobPatch,
  ModelInfo,
  ModelRef,
  ProviderInfo,
  SkillInfo,
  ToolInfo,
  UpdateAgentPatch,
} from "@shared/models";

import { getRuntimePaths } from "../capabilities/runtime-paths";
import { agentDir, agentSessionsDir, bridgeDataDir } from "../capabilities/ai/paths";
import {
  BRIDGE_PLATFORMS,
  createAdapter,
  getWechatQrcode,
  pollWechatQrcodeStatus,
  readBindings,
  readBridgeCreds,
  removeBinding,
  setBinding,
  setBridgeCreds,
  type BridgeAdapter,
  type BridgeInboundMessage,
  type BridgeRuntimeState,
} from "../capabilities/ai/bridge";
import {
  configuredProviders,
  readAuth,
  readProviders,
  removeModelMeta as storeRemoveModelMeta,
  removeProvider as storeRemoveProvider,
  setApiKey,
  setModelMeta as storeSetModelMeta,
  setProviderConfig as storeSetProviderConfig,
  writeProviders,
} from "../capabilities/ai/providers-store";
import {
  fetchModels as probeFetchModels,
  testProvider as probeTestProvider,
} from "../capabilities/ai/provider-probe";
import {
  deleteAgent as removeAgentDir,
  ensureAgentDir,
  listAgentConfigs,
  readAgentConfig,
  readExperience,
  readIdentity,
  readIshiki,
  readPinned,
  writeAgentConfig,
  writeExperience,
  writeIdentity,
  writeIshiki,
  writePinned,
} from "../capabilities/ai/agent-store";
import { readTools, setToolEnabled } from "../capabilities/ai/tools-store";
import {
  addJob,
  listDueJobs,
  markRun,
  readJobs,
  removeJob,
  toggleJob,
  updateJob,
} from "../capabilities/ai/cron-store";
import {
  createChannel,
  deleteChannel,
  getChannel,
  listChannels,
  updateChannel,
} from "../capabilities/ai/channels-store";
import {
  AiSession,
  createNotifyTool,
  createReadNodeTool,
  createSearchKbTool,
  createSubagentTool,
  listAllModels,
  listAvailableModels,
  listProviderNames,
  listSkills as discoverSkills,
} from "../domain/ai";
import { searchInDir } from "../capabilities/knowledge/search";
import { emitEvent } from "../ipc/emit";

type SessionRole = "interactive" | "cron" | "subagent" | "bridge";

/** 内置工具目录（全局工具管理展示用）。 */
const BUILTIN_TOOLS: { name: string; description: string }[] = [
  { name: "read", description: "读取文件内容" },
  { name: "grep", description: "在文件中搜索文本" },
  { name: "find", description: "按名称查找文件" },
  { name: "ls", description: "列出目录" },
  { name: "bash", description: "执行 shell 命令" },
  { name: "edit", description: "编辑文件" },
  { name: "write", description: "写入文件" },
];

/** P0 默认启用的内置只读工具（让 Agent 能读/检索工作区文件）。 */
const DEFAULT_TOOL_NAMES = ["read", "grep", "find", "ls"];

/** 默认助手人格（首次自动建默认 Agent 时写入 identity.md）。 */
const DEFAULT_IDENTITY = `你是 {{agentName}}，EIDON 知识库中的本地 AI 助手。

- 用简洁、准确、可执行的中文回答。
- 需要了解用户的笔记/文件时，使用 read / grep / find / ls 工具在当前工作区中查找，不要臆测内容。
- 涉及不可逆或对外的操作前，先与用户确认。
`;

const fillTemplate = (text: string, config: AgentConfig): string =>
  text
    .replace(/\{\{agentName\}\}/g, config.name)
    .replace(/\{\{userName\}\}/g, "用户");

/**
 * 拼装人格系统提示：身份简介(identity) + 意识(ishiki) + 置顶记忆(pinned)（+ 经验(experience)，若启用）。
 * 模板占位（{{agentName}} 等）由调用方再过 fillTemplate 统一替换。
 */
function assemblePersona(
  identity: string,
  ishiki: string,
  pinned: string,
  experience: string,
): string {
  const parts: string[] = [];
  if (identity.trim()) parts.push(identity.trim());
  if (ishiki.trim()) parts.push(ishiki.trim());
  if (pinned.trim()) parts.push(`## 置顶记忆\n\n${pinned.trim()}`);
  if (experience.trim()) parts.push(`## 经验\n\n${experience.trim()}`);
  return parts.join("\n\n");
}

class AiService {
  private readonly sessions = new Map<string, AiSession>();
  private cronTimer: ReturnType<typeof setInterval> | null = null;
  private cronRunning = false;

  // ── bridge 运行态 ──
  private readonly bridgeAdapters = new Map<BridgePlatform, BridgeAdapter>();
  private readonly bridgeState = new Map<BridgePlatform, { state: BridgeRuntimeState; error: string | null }>();
  private readonly bridgeSessions = new Map<string, AiSession>();
  private wechatLoginCancelled = false;

  // ── providers / models ───────────────────────────────────────────────

  /** 至少配置了一个 provider 的 API key 即视为可用。 */
  async isAvailable(): Promise<boolean> {
    return (await configuredProviders()).size > 0;
  }

  /** 列出全部已知 provider + 配置状态。 */
  async listProviders(): Promise<ProviderInfo[]> {
    const file = await readProviders();
    const configured = await configuredProviders();
    return listProviderNames().map((id) => ({
      id,
      label: id,
      configured: configured.has(id),
      enabled: file.providers[id]?.enabled ?? true,
      baseUrl: file.providers[id]?.baseUrl ?? null,
      api: file.providers[id]?.api ?? null,
      headers: file.providers[id]?.headers ?? {},
      models: file.providers[id]?.models ?? {},
    }));
  }

  /** 已配置凭证的可用模型；可按 provider 过滤。未配任何 key 时回退展示该 provider 全部内置模型。 */
  async listModels(provider?: string): Promise<ModelInfo[]> {
    const auth = await readAuth();
    const available = listAvailableModels(auth.keys);
    if (available.length === 0 && provider) return listAllModels(provider);
    return provider ? available.filter((m) => m.provider === provider) : available;
  }

  async setProviderKey(provider: string, apiKey: string): Promise<void> {
    await setApiKey(provider, apiKey);
  }

  async setDefaultModel(model: ModelRef | null): Promise<void> {
    const file = await readProviders();
    await writeProviders({ ...file, defaultModel: model });
  }

  async getDefaultModel(): Promise<ModelRef | null> {
    return (await readProviders()).defaultModel;
  }

  /** 更新某 provider 的非凭证配置（enabled/baseUrl/api/自定义 headers）。 */
  async setProviderConfig(
    provider: string,
    patch: { enabled?: boolean; baseUrl?: string | null; api?: string | null; headers?: Record<string, string> },
  ): Promise<void> {
    await storeSetProviderConfig(provider, patch);
  }

  /** 写入某 provider 单个模型的元数据覆盖（逐模型编辑）。 */
  async setModelMeta(provider: string, modelId: string, meta: ModelMeta): Promise<void> {
    await storeSetModelMeta(provider, modelId, meta);
  }

  /** 删除某 provider 下单个已添加模型的元数据条目。 */
  async removeModelMeta(provider: string, modelId: string): Promise<void> {
    await storeRemoveModelMeta(provider, modelId);
  }

  /** 删除某 provider 配置（自定义 provider 移除）。 */
  async removeProvider(provider: string): Promise<void> {
    await storeRemoveProvider(provider);
  }

  /** 连通性测试：未传 apiKey 时回退用已存凭证；headers 取已存配置。 */
  async testProvider(req: { provider: string; baseUrl: string; api: string; apiKey?: string }): Promise<boolean> {
    const [auth, file] = await Promise.all([readAuth(), readProviders()]);
    const apiKey = req.apiKey?.trim() || auth.keys[req.provider] || "";
    const headers = file.providers[req.provider]?.headers ?? {};
    return probeTestProvider({ baseUrl: req.baseUrl, api: req.api, apiKey, headers });
  }

  /** 读取模型：对 provider 端点发现可用模型 id（未传 apiKey 时回退已存凭证）。 */
  async fetchProviderModels(req: { provider: string; baseUrl: string; api: string; apiKey?: string }): Promise<string[]> {
    const [auth, file] = await Promise.all([readAuth(), readProviders()]);
    const apiKey = req.apiKey?.trim() || auth.keys[req.provider] || "";
    const headers = file.providers[req.provider]?.headers ?? {};
    return probeFetchModels({ baseUrl: req.baseUrl, api: req.api, apiKey, headers });
  }

  // ── 全局工具管理 ──────────────────────────────────────────────────────

  async listTools(): Promise<ToolInfo[]> {
    const disabled = new Set((await readTools()).disabled);
    return BUILTIN_TOOLS.map((t) => ({ ...t, enabled: !disabled.has(t.name) }));
  }

  async setToolEnabled(name: string, enabled: boolean): Promise<void> {
    await setToolEnabled(name, enabled);
  }

  /** 发现可用 skills（工作区 `.agents/skills/` + 全局 `~/.eidon/skills/`）。 */
  listSkills(workspace?: string): Promise<SkillInfo[]> {
    const home = getRuntimePaths().aiHome;
    return discoverSkills(workspace?.trim() || home, home);
  }

  // ── agents CRUD ───────────────────────────────────────────────────────

  private toSummary(c: AgentConfig): AgentSummary {
    return {
      id: c.id,
      name: c.name,
      description: c.description,
      avatar: c.avatar,
      model: c.model,
      visibility: c.visibility,
      activatableByAgents: c.activatableByAgents,
    };
  }

  async listAgents(): Promise<AgentSummary[]> {
    return (await listAgentConfigs()).map((c) => this.toSummary(c));
  }

  async getAgent(id: string): Promise<AgentDetail | null> {
    const config = await readAgentConfig(id);
    if (!config) return null;
    const [persona, ishiki, experience, pinned] = await Promise.all([
      readIdentity(id),
      readIshiki(id),
      readExperience(id),
      readPinned(id),
    ]);
    return {
      config,
      persona: persona ?? "",
      ishiki: ishiki ?? "",
      experience: experience ?? "",
      pinned: pinned ?? "",
    };
  }

  async createAgent(input: CreateAgentInput): Promise<AgentSummary> {
    const id = createNodeId();
    const now = new Date().toISOString();
    const config: AgentConfig = {
      version: 1,
      id,
      name: input.name.trim() || "新 Agent",
      description: input.description ?? "",
      avatar: null,
      model: input.model ?? null,
      params: { thinkingLevel: "medium", temperature: null },
      tools: { enabled: [], disabled: [] },
      skills: { enabled: [] },
      commands: { enabled: [] },
      visibility: input.visibility ?? "private",
      activatableByAgents: input.activatableByAgents ?? false,
      channelsEnabled: false,
      experience: { enabled: false },
      yuan: input.yuan ?? null,
      createdAt: now,
      updatedAt: now,
    };
    await writeAgentConfig(config);
    await writeIdentity(id, input.persona?.trim() || fillTemplate(DEFAULT_IDENTITY, config));
    if (input.ishiki?.trim()) await writeIshiki(id, input.ishiki);
    return this.toSummary(config);
  }

  async updateAgent(id: string, patch: UpdateAgentPatch): Promise<AgentSummary> {
    const config = await readAgentConfig(id);
    if (!config) throw new Error(`agent not found: ${id}`);
    const next: AgentConfig = {
      ...config,
      updatedAt: new Date().toISOString(),
      name: patch.name ?? config.name,
      description: patch.description ?? config.description,
      model: patch.model !== undefined ? patch.model : config.model,
      params: {
        thinkingLevel: patch.thinkingLevel ?? config.params.thinkingLevel,
        temperature: patch.temperature !== undefined ? patch.temperature : config.params.temperature,
      },
      visibility: patch.visibility ?? config.visibility,
      activatableByAgents: patch.activatableByAgents ?? config.activatableByAgents,
      channelsEnabled: patch.channelsEnabled ?? config.channelsEnabled,
      avatar: patch.avatar !== undefined ? patch.avatar : config.avatar,
      yuan: patch.yuan !== undefined ? patch.yuan : config.yuan,
      experience: { enabled: patch.experienceEnabled ?? config.experience.enabled },
      tools: patch.tools ?? config.tools,
      skills: patch.skills ?? config.skills,
    };
    await writeAgentConfig(next);
    if (patch.persona !== undefined) await writeIdentity(id, patch.persona);
    if (patch.ishiki !== undefined) await writeIshiki(id, patch.ishiki);
    if (patch.pinned !== undefined) await writePinned(id, patch.pinned);
    if (patch.experienceText !== undefined) await writeExperience(id, patch.experienceText);
    return this.toSummary(next);
  }

  async deleteAgent(id: string): Promise<void> {
    for (const [sid, session] of this.sessions) {
      if (session.agentId === id) {
        session.dispose();
        this.sessions.delete(sid);
      }
    }
    await removeAgentDir(id);
  }

  /** 无 Agent 时建一个默认助手，返回其 id；否则返回首个 Agent id。 */
  async ensureDefaultAgent(): Promise<string> {
    const configs = await listAgentConfigs();
    if (configs.length > 0) return configs[0].id;
    const summary = await this.createAgent({
      name: "默认助手",
      description: "EIDON 默认 AI 助手",
    });
    return summary.id;
  }

  // ── sessions ──────────────────────────────────────────────────────────

  /** 新建会话（解析 Agent 模型/人格/工具 + 团队名册 + 协作工具 → 订阅转发流事件）。 */
  async newSession(req: {
    agentId?: string;
    workspace?: string;
  }): Promise<{ sessionId: string; state: AiSessionState }> {
    const agentId = req.agentId ?? (await this.ensureDefaultAgent());
    const session = await this.buildSession(agentId, {
      workspace: req.workspace,
      role: "interactive",
    });

    session.subscribe((e) => emitEvent("eidon:ai-stream", e));
    this.sessions.set(session.id, session);

    const state = session.getState();
    emitEvent("eidon:ai-session", state);
    return { sessionId: session.id, state };
  }

  /** 委派子任务给目标 Agent（受可见性/激活开关约束），返回其文本结论。 */
  async runSubAgent(agentId: string, task: string, workspace?: string): Promise<string> {
    const config = await readAgentConfig(agentId);
    if (!config) return `（找不到 Agent: ${agentId}）`;
    if (!(config.visibility === "public" && config.activatableByAgents)) {
      return `（Agent「${config.name}」未开放被其他 Agent 调用）`;
    }
    const session = await this.buildSession(agentId, { workspace, role: "subagent" });
    let text = "";
    const off = session.subscribe((e) => {
      if (e.kind === "text_delta") text += e.delta;
    });
    try {
      await session.prompt(task);
    } finally {
      off();
      session.dispose();
    }
    return text.trim() || "（子 Agent 无文本输出）";
  }

  // ── cron（每 Agent 定时任务）──────────────────────────────────────────

  listCronJobs(agentId: string): Promise<CronJob[]> {
    return readJobs(agentId);
  }
  addCronJob(agentId: string, input: CronJobInput): Promise<CronJob> {
    return addJob(agentId, input);
  }
  updateCronJob(agentId: string, jobId: string, patch: CronJobPatch): Promise<CronJob | null> {
    return updateJob(agentId, jobId, patch);
  }
  toggleCronJob(agentId: string, jobId: string): Promise<CronJob | null> {
    return toggleJob(agentId, jobId);
  }
  removeCronJob(agentId: string, jobId: string): Promise<void> {
    return removeJob(agentId, jobId);
  }

  /** 启动确定性 60s 调度器（main 常驻，依赖托盘）。重复调用安全。 */
  startScheduler(): void {
    if (this.cronTimer) return;
    this.cronTimer = setInterval(() => void this.checkDueJobs(), 60_000);
  }

  stopScheduler(): void {
    if (this.cronTimer) {
      clearInterval(this.cronTimer);
      this.cronTimer = null;
    }
  }

  /** 巡检所有 Agent 的到期任务并依次执行（防重入；单任务失败不阻断其余）。 */
  async checkDueJobs(): Promise<void> {
    if (this.cronRunning) return;
    this.cronRunning = true;
    try {
      const due = await listDueJobs(new Date());
      for (const { agentId, job } of due) {
        try {
          await this.runScheduledJob(agentId, job);
        } catch {
          // 单个任务失败不阻断调度；仍推进 nextRunAt 避免卡死。
        }
        await markRun(agentId, job.id, new Date());
      }
    } finally {
      this.cronRunning = false;
    }
  }

  /**
   * 执行一条定时任务：用该 Agent 跑一个后台会话（含 notify 工具），收集文本结果，
   * 完成后把摘要回灌为系统通知（即便 Agent 自己没调 notify 也有兜底回报）。
   */
  private async runScheduledJob(agentId: string, job: CronJob): Promise<void> {
    const config = await readAgentConfig(agentId);
    if (!config) return;
    const session = await this.buildSession(agentId, { role: "cron" });
    let text = "";
    const off = session.subscribe((e) => {
      if (e.kind === "text_delta") text += e.delta;
    });
    let status: "success" | "error" = "success";
    try {
      await session.prompt(job.prompt);
    } catch {
      status = "error";
    } finally {
      off();
      session.dispose();
    }
    const summary =
      text.trim().slice(0, 280) ||
      (status === "error" ? "执行出错。" : "任务已完成（无文本输出）。");
    this.emitActivity({
      kind: "cron",
      agentId,
      agentName: config.name,
      label: job.label || job.prompt.slice(0, 40),
      status,
      summary,
      notify: true,
    });
  }

  // ── channels（多 Agent 群聊）──────────────────────────────────────────

  listChannels(): Promise<Channel[]> {
    return listChannels();
  }
  createChannel(name: string, members: string[]): Promise<Channel> {
    return createChannel(name, members);
  }
  updateChannel(id: string, patch: { name?: string; members?: string[] }): Promise<Channel | null> {
    return updateChannel(id, patch);
  }
  deleteChannel(id: string): Promise<void> {
    return deleteChannel(id);
  }

  /**
   * 群聊一轮：成员依次基于「用户消息 + 在先成员发言」作答；每个成员的回复以其名义流式推送。
   * 用合成 sessionId `channel:{id}` 串起整轮，message_start 带 agentName 供 UI 标注发言人。
   */
  async promptChannel(channelId: string, text: string, workspace?: string): Promise<void> {
    const channel = await getChannel(channelId);
    const sessionId = `channel:${channelId}`;
    if (!channel || channel.members.length === 0) {
      emitEvent("eidon:ai-stream", {
        kind: "error",
        sessionId,
        message: "频道不存在或没有成员。",
      });
      emitEvent("eidon:ai-stream", { kind: "done", sessionId });
      return;
    }
    const transcript: string[] = [`用户：${text}`];
    for (const memberId of channel.members) {
      const config = await readAgentConfig(memberId);
      if (!config) continue;
      const context =
        transcript.join("\n\n") +
        `\n\n（你是「${config.name}」，请基于以上群聊内容简洁发表你的回应；不要复述他人发言。）`;
      const reply = await this.runMemberTurn(memberId, sessionId, context, config.name, workspace);
      if (reply) transcript.push(`${config.name}：${reply}`);
    }
    emitEvent("eidon:ai-stream", { kind: "done", sessionId });
  }

  /** 群聊单成员一轮：注入带 agentName 的 message_start，转发其文本/工具流，收尾 message_end。 */
  private async runMemberTurn(
    agentId: string,
    sessionId: string,
    context: string,
    agentName: string,
    workspace?: string,
  ): Promise<string> {
    const session = await this.buildSession(agentId, { workspace, role: "subagent" });
    emitEvent("eidon:ai-stream", { kind: "message_start", sessionId, agentName });
    let reply = "";
    const off = session.subscribe((e) => {
      if (e.kind === "text_delta") {
        reply += e.delta;
        emitEvent("eidon:ai-stream", { ...e, sessionId });
      } else if (
        e.kind === "thinking_delta" ||
        e.kind === "tool_start" ||
        e.kind === "tool_update" ||
        e.kind === "tool_end"
      ) {
        emitEvent("eidon:ai-stream", { ...e, sessionId });
      }
      // 成员自身的 message_start/message_end/done/error 不转发（由群聊编排统一收尾）。
    });
    try {
      await session.prompt(context);
    } finally {
      off();
      session.dispose();
    }
    emitEvent("eidon:ai-stream", { kind: "message_end", sessionId });
    return reply.trim();
  }

  async prompt(sessionId: string, text: string): Promise<void> {
    const session = this.requireSession(sessionId);
    emitEvent("eidon:ai-session", session.getState());
    await session.prompt(text);
    emitEvent("eidon:ai-session", session.getState());
  }

  async cancel(sessionId: string): Promise<void> {
    await this.sessions.get(sessionId)?.cancel();
  }

  async setModel(sessionId: string, model: ModelRef): Promise<boolean> {
    const session = this.requireSession(sessionId);
    const ok = await session.setModel(model);
    if (ok) emitEvent("eidon:ai-session", session.getState());
    return ok;
  }

  disposeSession(sessionId: string): void {
    this.sessions.get(sessionId)?.dispose();
    this.sessions.delete(sessionId);
  }

  sessionState(sessionId: string): AiSessionState | null {
    return this.sessions.get(sessionId)?.getState() ?? null;
  }

  /** 应用退出时清理全部会话 + 停调度器 + 停桥接（释放 Pi/适配器后台资源）。 */
  disposeAll(): void {
    this.stopScheduler();
    void this.stopAllBridges();
    for (const session of this.sessions.values()) session.dispose();
    this.sessions.clear();
  }

  // ── bridge（多平台接入：飞书 + 微信官方 iLink）────────────────────────────

  async listBridgeBindings(): Promise<BridgeBinding[]> {
    return (await readBindings()).bindings;
  }

  /** 每平台状态快照（绑定元数据 + 运行态 + 凭证是否已配）。 */
  async bridgeStatus(): Promise<BridgeStatus[]> {
    const byPlatform = new Map((await readBindings()).bindings.map((b) => [b.platform, b]));
    return Promise.all(
      BRIDGE_PLATFORMS.map(async (platform): Promise<BridgeStatus> => {
        const b = byPlatform.get(platform);
        const rt = this.bridgeState.get(platform);
        const creds = await readBridgeCreds(platform);
        return {
          platform,
          agentId: b?.agentId ?? null,
          enabled: b?.enabled ?? false,
          configured: Object.keys(creds).length > 0,
          state: rt?.state ?? "idle",
          error: rt?.error ?? null,
        };
      }),
    );
  }

  /** 绑定平台↔Agent（可同时存凭证 + 启停）。 */
  async bindBridge(req: {
    platform: BridgePlatform;
    agentId: string | null;
    creds?: Record<string, string>;
    enabled?: boolean;
  }): Promise<void> {
    if (req.creds && Object.keys(req.creds).length > 0) {
      await setBridgeCreds(req.platform, req.creds);
    }
    const enabled = req.enabled ?? false;
    await setBinding(req.platform, { agentId: req.agentId, enabled });
    if (enabled && req.agentId) await this.startBridge(req.platform);
    else await this.stopBridge(req.platform);
    this.emitBridgeStatus(req.platform);
  }

  async setBridgeEnabled(platform: BridgePlatform, enabled: boolean): Promise<void> {
    const binding = await setBinding(platform, { enabled });
    if (enabled && binding.agentId) await this.startBridge(platform);
    else await this.stopBridge(platform);
    this.emitBridgeStatus(platform);
  }

  async unbindBridge(platform: BridgePlatform): Promise<void> {
    await this.stopBridge(platform);
    await removeBinding(platform);
    await setBridgeCreds(platform, {});
    this.bridgeState.delete(platform);
    this.emitBridgeStatus(platform);
  }

  /** main 就绪后拉起所有 enabled 绑定（托盘常驻；单平台失败不阻断）。 */
  async startEnabledBridges(): Promise<void> {
    for (const b of (await readBindings()).bindings) {
      if (b.enabled && b.agentId) {
        try {
          await this.startBridge(b.platform);
        } catch {
          // 单平台启动失败不阻断其余。
        }
      }
    }
  }

  async stopAllBridges(): Promise<void> {
    for (const platform of [...this.bridgeAdapters.keys()]) await this.stopBridge(platform);
  }

  /** 微信扫码登录：拉 QR → 轮询状态（服务器长轮询 hold ~35s）→ confirmed 存 botToken。 */
  async startWechatLogin(): Promise<void> {
    this.wechatLoginCancelled = false;
    const qr = await getWechatQrcode();
    if (!qr.ok || !qr.qrcodeId) {
      emitEvent("eidon:bridge-wechat-qr", { status: "error", error: qr.error ?? "获取二维码失败" });
      return;
    }
    emitEvent("eidon:bridge-wechat-qr", { status: "waiting", qrDataUrl: qr.qrcodeDataUrl });
    for (let i = 0; i < 20 && !this.wechatLoginCancelled; i++) {
      const st = await pollWechatQrcodeStatus(qr.qrcodeId);
      if (this.wechatLoginCancelled) return;
      if (st.status === "scanned") {
        emitEvent("eidon:bridge-wechat-qr", { status: "scanned", qrDataUrl: qr.qrcodeDataUrl });
        continue;
      }
      if (st.status === "confirmed" && st.botToken) {
        await setBridgeCreds("wechat", {
          botToken: st.botToken,
          ...(st.baseUrl ? { baseUrl: st.baseUrl } : {}),
        });
        emitEvent("eidon:bridge-wechat-qr", { status: "confirmed" });
        const binding = (await readBindings()).bindings.find((b) => b.platform === "wechat");
        if (binding?.enabled && binding.agentId) await this.startBridge("wechat");
        this.emitBridgeStatus("wechat");
        return;
      }
      if (st.status === "expired" || st.status === "error") {
        emitEvent("eidon:bridge-wechat-qr", { status: st.status, error: st.error });
        return;
      }
      // waiting → 继续轮询
    }
  }

  cancelWechatLogin(): void {
    this.wechatLoginCancelled = true;
  }

  /** 启动某平台适配器（注入 onMessage/onStatus；先停旧实例）。 */
  private async startBridge(platform: BridgePlatform): Promise<void> {
    const binding = (await readBindings()).bindings.find((b) => b.platform === platform);
    if (!binding?.agentId) return;
    await this.stopBridge(platform);
    const creds = await readBridgeCreds(platform);
    const agentId = binding.agentId;
    const adapter = createAdapter(platform, {
      creds,
      dataDir: bridgeDataDir(),
      onMessage: (msg) => void this.onBridgeInbound(platform, agentId, msg),
      onStatus: (state, error) => this.onBridgeStatus(platform, state, error),
    });
    this.bridgeAdapters.set(platform, adapter);
    await adapter.start();
  }

  private async stopBridge(platform: BridgePlatform): Promise<void> {
    const adapter = this.bridgeAdapters.get(platform);
    if (adapter) {
      try {
        await adapter.stop();
      } catch {
        // best-effort
      }
      this.bridgeAdapters.delete(platform);
    }
    for (const [key, session] of this.bridgeSessions) {
      if (key.startsWith(`${platform}_`)) {
        session.dispose();
        this.bridgeSessions.delete(key);
      }
    }
  }

  private onBridgeStatus(platform: BridgePlatform, state: BridgeRuntimeState, error?: string): void {
    this.bridgeState.set(platform, { state, error: error ?? null });
    this.emitBridgeStatus(platform);
  }

  private emitBridgeStatus(platform: BridgePlatform): void {
    void this.bridgeStatus().then((all) => {
      const s = all.find((x) => x.platform === platform);
      if (s) emitEvent("eidon:bridge-status", s);
    });
  }

  /** 入站外部消息 → 路由到绑定 Agent 的桥接会话 → prompt → 回发文本。 */
  private async onBridgeInbound(
    platform: BridgePlatform,
    agentId: string,
    msg: BridgeInboundMessage,
  ): Promise<void> {
    emitEvent("eidon:bridge-inbound", {
      platform,
      agentId,
      userId: msg.userId,
      preview: msg.text.slice(0, 80),
    });
    const adapter = this.bridgeAdapters.get(platform);
    if (!adapter) return;
    const sessionKey = `${platform}_${msg.isGroup ? "group" : "dm"}_${msg.chatId}@${agentId}`;
    let session = this.bridgeSessions.get(sessionKey);
    if (!session) {
      session = await this.buildSession(agentId, { role: "bridge" });
      this.bridgeSessions.set(sessionKey, session);
    }
    let reply = "";
    const off = session.subscribe((e) => {
      if (e.kind === "text_delta") reply += e.delta;
    });
    try {
      await session.prompt(msg.text);
    } finally {
      off();
    }
    const text = reply.trim();
    if (!text) return;
    try {
      await adapter.sendText(msg.chatId, text);
    } catch (err) {
      const config = await readAgentConfig(agentId);
      this.emitActivity({
        kind: "notify",
        agentId,
        agentName: config?.name ?? platform,
        label: `${platform} 回发失败`,
        status: "error",
        summary: err instanceof Error ? err.message : String(err),
        notify: false,
      });
    }
  }

  // ── internal ──────────────────────────────────────────────────────────

  /**
   * 构造一个会话：解析模型/人格/工具。按角色注入工具：
   *  - interactive：团队名册 + subagent（委派）+ notify（回灌）。
   *  - cron：notify（让定时任务能把结果回灌给用户）。
   *  - subagent：仅 Agent 基础工具（防递归 + 避免上下文膨胀）。
   */
  private async buildSession(
    agentId: string,
    opts: { workspace?: string; role: SessionRole },
  ): Promise<AiSession> {
    const config = await readAgentConfig(agentId);
    if (!config) throw new Error(`agent not found: ${agentId}`);
    await ensureAgentDir(agentId);

    const identity = (await readIdentity(agentId)) ?? DEFAULT_IDENTITY;
    const ishiki = (await readIshiki(agentId)) ?? "";
    const pinned = (await readPinned(agentId)) ?? "";
    const experience = config.experience.enabled ? ((await readExperience(agentId)) ?? "") : "";
    const auth = await readAuth();
    const model = await this.resolveModel(config);
    const cwd = opts.workspace?.trim() || getRuntimePaths().aiHome;
    const globalDisabled = (await readTools()).disabled;
    const toolNames = this.effectiveToolNames(config, globalDisabled);

    let systemPrompt = fillTemplate(
      assemblePersona(identity, ishiki, pinned, experience),
      config,
    );
    const customTools: ReturnType<typeof createSubagentTool>[] = [];
    if (opts.role === "interactive") {
      const roster = await this.buildRoster(agentId);
      if (roster) systemPrompt += `\n\n${roster}`;
      customTools.push(
        createSubagentTool({
          runSubAgent: (id, task) => this.runSubAgent(id, task, opts.workspace),
        }),
      );
    }
    if (opts.role === "interactive" || opts.role === "cron") {
      customTools.push(
        createNotifyTool({
          notify: (title, body) =>
            this.emitActivity({
              kind: "notify",
              agentId,
              agentName: config.name,
              label: title,
              status: "success",
              summary: body,
              notify: true,
            }),
        }),
      );
    }

    // EIDON 专属知识库工具：仅在有工作区时注入（搜索/读取当前工作区的结构化笔记）。
    const kbWorkspace = opts.workspace?.trim();
    if (kbWorkspace) {
      const kbDeps = {
        searchKb: (query: string, maxResults: number) => searchInDir(kbWorkspace, query, maxResults),
        readNode: (relPath: string) => this.readWorkspaceFile(kbWorkspace, relPath),
      };
      customTools.push(createSearchKbTool(kbDeps), createReadNodeTool(kbDeps));
    }

    return AiSession.create({
      sessionId: createNodeId(),
      agentId,
      apiKeys: auth.keys,
      model,
      thinkingLevel: config.params.thinkingLevel,
      systemPrompt,
      cwd,
      agentDir: agentDir(agentId),
      sessionsDir: agentSessionsDir(agentId),
      toolNames,
      customTools: customTools.length ? customTools : undefined,
    });
  }

  /** 推送一条 Agent 后台活动给渲染层（补全时间戳）。 */
  private emitActivity(activity: Omit<AgentActivity, "at">): void {
    emitEvent("eidon:agent-activity", { ...activity, at: new Date().toISOString() });
  }

  /** Agent 生效工具名 = (per-agent 白名单 或 默认集) − 全局禁用 − per-agent 黑名单。 */
  private effectiveToolNames(config: AgentConfig, globalDisabled: string[]): string[] {
    const base = config.tools.enabled.length ? config.tools.enabled : DEFAULT_TOOL_NAMES;
    const disabled = new Set([...globalDisabled, ...config.tools.disabled]);
    return base.filter((name) => !disabled.has(name));
  }

  /** 团队名册：可被发现且可激活的「其他」Agent（注入顶层会话系统提示）。 */
  private async buildRoster(excludeId: string): Promise<string> {
    const others = (await listAgentConfigs()).filter(
      (c) => c.id !== excludeId && c.visibility === "public" && c.activatableByAgents,
    );
    if (others.length === 0) return "";
    const lines = others
      .map((c) => `- \`${c.id}\`（${c.name}）：${c.description || "（无简介）"}`)
      .join("\n");
    return (
      "## 团队\n\n" +
      "你不是独自工作。可用 subagent 工具把子任务委派给以下 Agent（agent 参数传反引号里的 id）：\n\n" +
      lines
    );
  }

  /** 解析 Agent 实际模型：agent.model ?? 全局默认 ?? 首个可用。 */
  private async resolveModel(config: AgentConfig): Promise<ModelRef | null> {
    if (config.model) return config.model;
    const providers = await readProviders();
    if (providers.defaultModel) return providers.defaultModel;
    const auth = await readAuth();
    const available = listAvailableModels(auth.keys);
    return available[0]
      ? { provider: available[0].provider, id: available[0].id }
      : null;
  }

  /** 读取工作区内文件（防路径越界 + 大文件截断），供 read_node 工具用。 */
  private async readWorkspaceFile(workspace: string, relPath: string): Promise<string> {
    const resolved = resolvePath(workspace, relPath);
    if (resolved !== workspace && !resolved.startsWith(workspace + pathSep)) {
      throw new Error("路径越界（仅允许读取工作区内文件）");
    }
    const MAX = 50_000;
    const text = await fs.readFile(resolved, "utf8");
    return text.length > MAX ? `${text.slice(0, MAX)}\n…（已截断）` : text;
  }

  private requireSession(sessionId: string): AiSession {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`session not found: ${sessionId}`);
    return session;
  }
}

export const aiService = new AiService();
