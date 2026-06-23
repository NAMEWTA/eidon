/**
 * backend/domain/ai/tool-gate —— 会话权限档「工具门控」策略（纯函数，单测友好）。
 *
 * 移植自 HanaAgent `core/session-permission-mode.ts` 的 `classifySessionPermission`，按 EIDON
 * 现有工具集收窄：信息类工具恒放行；副作用类工具按权限档放行 / 拒绝 / 请求人工批准。
 * 与 `tool-policy.ts`（工具「生效集合」）正交：本文件管「能不能执行」，那边管「模型可见哪些」。
 *
 * service 在每个副作用工具的 `execute()` 入口调用 {@link classifyToolPermission}：
 *  - `allow`  → 直接执行（含 auto 档：自动放行，但工具卡片仍显式呈现）。
 *  - `deny`   → 抛出带 reason 的错误，pi 作为工具失败把 reason 回灌给模型。
 *  - `prompt` → 发 tool_approval 事件 + 等用户在对话内批准；批准才执行。
 */
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";

import type { AiStreamEvent, SessionPermissionMode } from "@shared/models";

/** 信息类工具：只读、无副作用，任何权限档恒放行。 */
export const INFORMATION_TOOLS: ReadonlySet<string> = new Set([
  "read",
  "grep",
  "find",
  "ls",
  "search_kb",
  "read_node",
]);

/**
 * 副作用类工具：写盘 / 执行命令 / 对外动作。受权限档门控。
 * 仅作显式登记；判定逻辑对「非信息类」一律按副作用处理（未知工具默认从严）。
 */
export const SIDE_EFFECT_TOOLS: ReadonlySet<string> = new Set([
  "bash",
  "edit",
  "write",
  "notify",
  "subagent",
]);

/** 门控判定结果。 */
export type ToolGateAction = "allow" | "deny" | "prompt";

export interface ToolGateDecision {
  action: ToolGateAction;
  /** deny 时回灌给模型的原因（含「如何解锁」指引）。 */
  reason?: string;
}

const ALLOW: ToolGateDecision = { action: "allow" };

/**
 * 判定某工具在给定权限档下是否可执行。
 *
 * @param mode     当前会话权限档。
 * @param toolName 工具名。
 * @returns 放行 / 拒绝（带原因）/ 需人工批准。
 */
export function classifyToolPermission(
  mode: SessionPermissionMode,
  toolName: string,
): ToolGateDecision {
  // 信息类工具：任何档位恒放行。
  if (INFORMATION_TOOLS.has(toolName)) return ALLOW;

  switch (mode) {
    case "operate":
      // 完整权限：全放行。
      return ALLOW;
    case "auto":
      // 自动审核：自动放行（呈现由 UI 的工具卡片负责）。
      return ALLOW;
    case "read_only":
      // 只读模式：拒绝并告知如何解锁。
      return {
        action: "deny",
        reason:
          `「${toolName}」在只读模式下不可用。` +
          `把权限档切换到「完整权限 / 自动审核 / 操作前询问」后即可使用。`,
      };
    case "ask":
      // 操作前询问：副作用工具执行前请求用户批准。
      return { action: "prompt" };
    default:
      // 未知档位从严：请求批准。
      return { action: "prompt" };
  }
}

/**
 * 单会话工具闸门：持有「可变权限档」+「ask 档的批准挂起表」，是工具门控的运行期真相源。
 *
 * 由 service 在建会话时创建（注入 `emit` = 推 `eidon:ai-stream` 事件），同时交给：
 *  - 被门控的工具（execute 入口调用 {@link guard}）；
 *  - AiSession（持有以便 `getState`/`dispose` 读档与清理挂起）。
 */
export class SessionGate {
  /** 当前权限档（运行时可由 `setMode` 改）。 */
  mode: SessionPermissionMode;
  private readonly sessionId: string;
  private readonly emit: (e: AiStreamEvent) => void;
  /** toolCallId → 解析批准结果的 resolver。 */
  private readonly pending = new Map<string, (approved: boolean) => void>();

  constructor(sessionId: string, mode: SessionPermissionMode, emit: (e: AiStreamEvent) => void) {
    this.sessionId = sessionId;
    this.mode = mode;
    this.emit = emit;
  }

  /**
   * 工具 execute 入口闸门：放行则 resolve，拒绝/未批准则抛错（pi 作为工具失败回灌模型）。
   * @param toolName 工具名；@param toolCallId 本次调用 id；@param args 工具入参（透传给批准卡片）。
   */
  async guard(toolName: string, toolCallId: string, args: unknown): Promise<void> {
    const decision = classifyToolPermission(this.mode, toolName);
    if (decision.action === "allow") return;
    if (decision.action === "deny") {
      throw new Error(decision.reason ?? `「${toolName}」当前权限档下不可用。`);
    }
    // prompt：请求用户批准，挂起直到 approve() 被调用。
    this.emit({ kind: "tool_approval", sessionId: this.sessionId, toolCallId, toolName, args });
    const approved = await new Promise<boolean>((resolve) => this.pending.set(toolCallId, resolve));
    if (!approved) throw new Error(`用户拒绝了「${toolName}」的执行。`);
  }

  /** 用户对某次工具调用的批准/拒绝。 */
  approve(toolCallId: string, approved: boolean): void {
    const resolve = this.pending.get(toolCallId);
    if (resolve) {
      this.pending.delete(toolCallId);
      resolve(approved);
    }
  }

  /** 会话销毁/中止：把所有挂起批准当作拒绝放掉，避免工具永久挂起。 */
  rejectAll(): void {
    for (const resolve of this.pending.values()) resolve(false);
    this.pending.clear();
  }
}

/**
 * 用闸门包装一个工具定义：execute 前先过 {@link SessionGate.guard}（信息类工具会被 guard 直接放行）。
 * 保留原定义的 schema/渲染等其余字段。
 */
export function gateTool(def: ToolDefinition, gate: SessionGate): ToolDefinition {
  return {
    ...def,
    execute: async (toolCallId, params, signal, onUpdate, ctx) => {
      await gate.guard(def.name, toolCallId, params);
      return def.execute(toolCallId, params, signal, onUpdate, ctx);
    },
  };
}
