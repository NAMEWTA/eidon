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
  type SessionEntry,
  type ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import type { ImageContent } from "@earendil-works/pi-ai";

import type {
  AiSessionState,
  AiSessionSummary,
  AiStreamEvent,
  ChatMessageWire,
  ChatPartWire,
  ModelRef,
  SessionPermissionMode,
  ThinkingLevel,
} from "@shared/models";

import { buildRegistry, resolveModel } from "./provider";
import { SessionGate } from "./tool-gate";

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
      // pi 已在此事件带工具入参 args；透传供前端展开查看（修复「工具无法展开看内容」）。
      return [{ kind: "tool_start", sessionId, toolCallId: ev.toolCallId, toolName: ev.toolName, args: ev.args }];
    case "tool_execution_update":
      return [{ kind: "tool_update", sessionId, toolCallId: ev.toolCallId, chunk: stringifyChunk(ev.partialResult) }];
    case "tool_execution_end":
      // pi 已在此事件带最终 result；截断后透传供前端展开查看。
      return [{ kind: "tool_end", sessionId, toolCallId: ev.toolCallId, isError: ev.isError, result: stringifyChunk(ev.result) }];
    case "agent_end":
      return [{ kind: "done", sessionId }];
    default:
      return [];
  }
}

/** pi 消息内容部件的最小结构形状（避免依赖 pi-agent-core 私有类型导出）。 */
interface PiTextContent {
  type: "text";
  text: string;
}
interface PiThinkingContent {
  type: "thinking";
  thinking: string;
}
interface PiToolCall {
  type: "toolCall";
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}
interface PiUserMessage {
  role: "user";
  content: string | Array<{ type: string; text?: string }>;
}
interface PiAssistantMessage {
  role: "assistant";
  content: Array<PiTextContent | PiThinkingContent | PiToolCall>;
}
interface PiToolResultMessage {
  role: "toolResult";
  toolCallId: string;
  toolName: string;
  content: Array<{ type: string; text?: string }>;
  isError: boolean;
}
type PiMessage = PiUserMessage | PiAssistantMessage | PiToolResultMessage;

/** 把（字符串或 content 部件数组）抽成纯文本。 */
function contentToText(content: string | Array<{ type: string; text?: string }>): string {
  if (typeof content === "string") return content;
  return content
    .filter((c) => c.type === "text" && typeof c.text === "string")
    .map((c) => c.text)
    .join("");
}

/**
 * 把持久化会话条目序列投影为可渲染历史消息（供 `ai:loadSession` 回放，**纯函数**，单测友好）。
 *  - user      → 文本气泡。
 *  - assistant → text / thinking / tool 三类 part（tool 带 args）。
 *  - toolResult→ 回填最近 assistant 里同 toolCallId 的 tool part 的 result / isError。
 */
export function projectHistory(entries: readonly SessionEntry[]): ChatMessageWire[] {
  const messages: ChatMessageWire[] = [];
  let seq = 0;
  // toolCallId → 已 push 的 tool part 引用（toolResult 到达时原地回填）。
  const toolParts = new Map<string, Extract<ChatPartWire, { type: "tool" }>>();

  for (const entry of entries) {
    if (entry.type !== "message") continue;
    const msg = entry.message as unknown as PiMessage;

    if (msg.role === "user") {
      const text = contentToText(msg.content).trim();
      if (text) messages.push({ id: `h${seq++}`, role: "user", parts: [{ type: "text", text }] });
      continue;
    }

    if (msg.role === "assistant") {
      const parts: ChatPartWire[] = [];
      for (const part of msg.content) {
        if (part.type === "text" && part.text) {
          parts.push({ type: "text", text: part.text });
        } else if (part.type === "thinking" && part.thinking) {
          parts.push({ type: "thinking", text: part.thinking });
        } else if (part.type === "toolCall") {
          const toolPart: Extract<ChatPartWire, { type: "tool" }> = {
            type: "tool",
            toolCallId: part.id,
            toolName: part.name,
            args: part.arguments,
            result: "",
            isError: false,
            done: true,
          };
          parts.push(toolPart);
          toolParts.set(part.id, toolPart);
        }
      }
      if (parts.length) messages.push({ id: `h${seq++}`, role: "assistant", parts });
      continue;
    }

    // toolResult：回填对应 tool part。
    const toolPart = toolParts.get(msg.toolCallId);
    if (toolPart) {
      toolPart.result = contentToText(msg.content);
      toolPart.isError = msg.isError;
    }
  }

  return messages;
}

/** ISO 化（pi 的 SessionInfo.created/modified 为 Date；防御性兼容字符串/数字）。 */
function toIso(value: Date | string | number): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

/**
 * 列出某 Agent 的历史会话摘要（按更新时间倒序），供「标题栏历史浮层」。
 * 读 `sessionsDir` 下全部会话文件元数据；目录缺失/损坏返回空列表（不阻断对话）。
 */
export async function listSessionSummaries(sessionsDir: string): Promise<AiSessionSummary[]> {
  let infos: Awaited<ReturnType<typeof SessionManager.listAll>>;
  try {
    infos = await SessionManager.listAll(sessionsDir);
  } catch {
    return [];
  }
  return infos
    .map((info) => ({
      sessionFile: info.path,
      id: info.id,
      title: (info.name?.trim() || info.firstMessage?.trim() || "新对话").slice(0, 60),
      createdAt: toIso(info.created),
      updatedAt: toIso(info.modified),
      messageCount: info.messageCount,
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
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
  /** 内置工具集（默认全部内置工具，service 侧已按全局/per-agent 禁用过滤）。 */
  toolNames: string[];
  /** EIDON 专属自定义工具（P1+）。 */
  customTools?: ToolDefinition[];
  /** 工具闸门：持有权限档 + ask 批准挂起表（service 注入，已绑定 emit）。 */
  gate: SessionGate;
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
  /** 工具闸门：权限档真相源 + ask 批准挂起表（被门控工具与本会话共享同一实例）。 */
  private readonly gate: SessionGate;
  private readonly listeners = new Set<(e: AiStreamEvent) => void>();
  private unsubscribe: (() => void) | null = null;

  private constructor(
    id: string,
    agentId: string,
    session: AgentSession,
    sessionManager: SessionManager,
    apiKeys: Record<string, string>,
    gate: SessionGate,
  ) {
    this.id = id;
    this.agentId = agentId;
    this.session = session;
    this.sessionManager = sessionManager;
    this.apiKeys = apiKeys;
    this.gate = gate;
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

    return new AiSession(params.sessionId, params.agentId, session, sessionManager, params.apiKeys, params.gate);
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

  /** 回放本会话已持久化的历史消息（供续聊载入时回灌渲染层）。 */
  getHistory(): ChatMessageWire[] {
    return projectHistory(this.sessionManager.getBranch());
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

  /** 运行时切换推理强度（off 不下发，保留模型默认）。 */
  setThinkingLevel(level: ThinkingLevel): void {
    const pi = toPiThinkingLevel(level);
    if (pi) this.session.setThinkingLevel(pi);
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
      permissionMode: this.gate.mode,
    };
  }

  /** 运行时切换工具权限档（立即作用于后续工具调用）。 */
  setPermissionMode(mode: SessionPermissionMode): void {
    this.gate.mode = mode;
  }

  /** ask 档下用户对某次工具调用的批准/拒绝（解析挂起的闸门 Promise）。 */
  approveTool(toolCallId: string, approved: boolean): void {
    this.gate.approve(toolCallId, approved);
  }

  subscribe(listener: (e: AiStreamEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    // 先放掉所有挂起批准（当拒绝），避免被门控工具永久挂起。
    this.gate.rejectAll();
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.listeners.clear();
    this.session.dispose();
  }

  private dispatch(e: AiStreamEvent): void {
    for (const listener of this.listeners) listener(e);
  }
}
