/**
 * backend/domain/ai/session —— 单个 AI 会话的生命周期封装（Pi AgentSession 之上）。
 *
 * 职责：
 *  1) 用注入的凭证/模型/人格/工具创建 Pi AgentSession（会话持久化到 Agent 文件夹的 sessions/）。
 *  2) 把 Pi 的 `AgentSessionEvent` 投影为 EIDON 扁平 wire 事件 {@link AiStreamEvent}，供 service 经 IPC 推送。
 *
 * 仅依赖 Pi SDK + shared；不 import EIDON capability（service 负责喂入路径/凭证/人格/工具）。
 */
import {
  createAgentSession,
  DefaultResourceLoader,
  SessionManager,
  type AgentSession,
  type AgentSessionEvent,
  type ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import type { ImageContent } from "@earendil-works/pi-ai";

import type {
  AiSessionState,
  AiStreamEvent,
  ModelRef,
  ThinkingLevel,
} from "@shared/models";

import { buildRegistry, resolveModel } from "./provider";

/** pi 的 thinkingLevel 无 `off`；EIDON 的 `off` 映射为不传（用 SDK 默认/模型不支持时被忽略）。 */
type PiThinkingLevel = "minimal" | "low" | "medium" | "high" | "xhigh";
const toPiThinkingLevel = (level: ThinkingLevel): PiThinkingLevel | undefined =>
  level === "off" ? undefined : level;

/** 工具调用增量结果转字符串（截断保护，避免单条事件过大）。 */
const stringifyChunk = (value: unknown): string => {
  if (typeof value === "string") return value.slice(0, 4000);
  try {
    return JSON.stringify(value).slice(0, 4000);
  } catch {
    return "";
  }
};

/**
 * 把一条 Pi 会话事件投影为零或多条 EIDON wire 事件（**纯函数**，单测友好）。
 */
export function projectEvent(
  sessionId: string,
  ev: AgentSessionEvent,
): AiStreamEvent[] {
  switch (ev.type) {
    case "message_start":
      return [{ kind: "message_start", sessionId }];
    case "message_update": {
      const a = ev.assistantMessageEvent;
      if (a.type === "text_delta") return [{ kind: "text_delta", sessionId, delta: a.delta }];
      if (a.type === "thinking_delta") return [{ kind: "thinking_delta", sessionId, delta: a.delta }];
      return [];
    }
    case "message_end":
      return [{ kind: "message_end", sessionId }];
    case "tool_execution_start":
      return [{ kind: "tool_start", sessionId, toolCallId: ev.toolCallId, toolName: ev.toolName }];
    case "tool_execution_update":
      return [{ kind: "tool_update", sessionId, toolCallId: ev.toolCallId, chunk: stringifyChunk(ev.partialResult) }];
    case "tool_execution_end":
      return [{ kind: "tool_end", sessionId, toolCallId: ev.toolCallId, isError: ev.isError }];
    case "agent_end":
      return [{ kind: "done", sessionId }];
    default:
      return [];
  }
}

export interface CreateSessionParams {
  /** EIDON 侧会话 id（由 service 生成，区别于 pi 的 sessionId）。 */
  sessionId: string;
  agentId: string;
  /** provider→API key（service 从 auth.json 读出）。 */
  apiKeys: Record<string, string>;
  /** 期望模型（agent.model ?? 全局默认）；null = 用 registry 首个可用。 */
  model: ModelRef | null;
  thinkingLevel: ThinkingLevel;
  /** 人格/系统提示主体（identity.md）。 */
  systemPrompt: string;
  /** 工作目录：内置工具（read/grep/...）的根 + 上下文文件发现。 */
  cwd: string;
  /** Agent 目录 `~/.eidon/agents/{id}`：skills/extensions 发现根。 */
  agentDir: string;
  /** 会话持久化目录 `~/.eidon/agents/{id}/sessions`。 */
  sessionsDir: string;
  /**
   * 既有会话文件绝对路径：传入则 `SessionManager.open` 续接历史（桥接会话重启不丢上下文），
   * 缺省/打开失败则新建。
   */
  sessionFile?: string;
  /** 内置工具白名单（P0：read/grep/find/ls）。 */
  toolNames: string[];
  /** EIDON 专属自定义工具（P1+）。 */
  customTools?: ToolDefinition[];
}

/** 一张随消息附带的图片（base64 + MIME）；由 service 从桥接附件下载解密后构造。 */
export interface PromptImage {
  /** 图片二进制的 base64（无 data: 前缀）。 */
  data: string;
  mimeType: string;
}

/** 单个会话句柄：包装 Pi AgentSession，对外只暴露 EIDON 语义。 */
export class AiSession {
  readonly id: string;
  readonly agentId: string;
  private readonly session: AgentSession;
  /** 持久化管理器：用于回读会话文件路径（桥接索引登记）。 */
  private readonly sessionManager: SessionManager;
  /** create 时注入：setModel 需用同一组凭证重建 registry。 */
  private readonly apiKeys: Record<string, string>;
  private readonly listeners = new Set<(e: AiStreamEvent) => void>();
  private unsubscribe: (() => void) | null = null;

  private constructor(
    id: string,
    agentId: string,
    session: AgentSession,
    sessionManager: SessionManager,
    apiKeys: Record<string, string>,
  ) {
    this.id = id;
    this.agentId = agentId;
    this.session = session;
    this.sessionManager = sessionManager;
    this.apiKeys = apiKeys;
    this.unsubscribe = session.subscribe((ev) => {
      for (const e of projectEvent(this.id, ev)) this.dispatch(e);
    });
  }

  static async create(params: CreateSessionParams): Promise<AiSession> {
    // 单一 AuthStorage+Registry 对：streamFn 走 registry 的 authStorage，须与传入的一致。
    const { authStorage, registry } = buildRegistry(params.apiKeys);
    const model = resolveModel(registry, params.model);

    const resourceLoader = new DefaultResourceLoader({
      cwd: params.cwd,
      agentDir: params.agentDir,
      systemPrompt: params.systemPrompt,
    });
    await resourceLoader.reload();

    // 既有会话文件 → open 续接历史；缺省/打开失败 → 新建（桥接会话重启不丢上下文）。
    const sessionManager = AiSession.openOrCreateManager(params);

    const { session } = await createAgentSession({
      cwd: params.cwd,
      agentDir: params.agentDir,
      authStorage,
      modelRegistry: registry,
      model,
      thinkingLevel: toPiThinkingLevel(params.thinkingLevel),
      sessionManager,
      resourceLoader,
      tools: params.toolNames,
      customTools: params.customTools,
    });

    return new AiSession(params.sessionId, params.agentId, session, sessionManager, params.apiKeys);
  }

  /** 既有会话文件存在则 `open` 续接，否则（或打开失败）`create` 新建。 */
  private static openOrCreateManager(params: CreateSessionParams): SessionManager {
    if (params.sessionFile) {
      try {
        return SessionManager.open(params.sessionFile, params.sessionsDir);
      } catch {
        // 文件缺失/损坏：退回新建，避免一条坏历史阻断对话。
      }
    }
    return SessionManager.create(params.cwd, params.sessionsDir);
  }

  /** 当前会话的持久化文件绝对路径（供桥接索引登记；尚未落盘则 null）。 */
  getSessionFile(): string | null {
    return this.sessionManager.getSessionFile() ?? null;
  }

  /** 发送用户消息（可附图片，供视觉模型；流式结果经事件推送）。 */
  async prompt(text: string, images?: PromptImage[]): Promise<void> {
    try {
      const imageContents: ImageContent[] | undefined = images?.length
        ? images.map((img) => ({ type: "image", data: img.data, mimeType: img.mimeType }))
        : undefined;
      await this.session.prompt(text, imageContents ? { images: imageContents } : undefined);
    } catch (err) {
      this.dispatch({
        kind: "error",
        sessionId: this.id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /** 中途转向（流式中追加指令）。 */
  async steer(text: string): Promise<void> {
    await this.session.steer(text);
  }

  /** 中止当前生成。 */
  async cancel(): Promise<void> {
    await this.session.abort();
  }

  /** 运行时切换模型（须已配置该 provider 凭证）。 */
  async setModel(ref: ModelRef): Promise<boolean> {
    const { registry } = buildRegistry(this.apiKeys);
    const model = registry.find(ref.provider, ref.id);
    if (!model) return false;
    await this.session.setModel(model);
    return true;
  }

  getState(): AiSessionState {
    const m = this.session.model;
    return {
      sessionId: this.id,
      agentId: this.agentId,
      model: m ? { provider: m.provider, id: m.id } : null,
      thinkingLevel: this.session.thinkingLevel as ThinkingLevel,
      isStreaming: this.session.isStreaming,
      messageCount: this.session.agent.state.messages.length,
    };
  }

  subscribe(listener: (e: AiStreamEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.listeners.clear();
    this.session.dispose();
  }

  private dispatch(e: AiStreamEvent): void {
    for (const listener of this.listeners) listener(e);
  }
}
