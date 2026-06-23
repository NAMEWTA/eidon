/**
 * backend/domain/ai —— AI-Native 业务内核公共出口（唯一可 import Pi SDK 的 domain）。
 *
 * 仅依赖 Pi SDK（@earendil-works/pi-ai · pi-coding-agent）+ @shared；不 import 任何 EIDON
 * capability/electron/UI（四层边界，见 AGENTS.md §2.1）。capability IO（凭证/Agent 文件夹）
 * 与编排在 backend/services/ai-service。
 */
export {
  buildRegistry,
  listAllModels,
  listAvailableModels,
  listProviderNames,
  resolveModel,
} from "./provider";

export {
  AiSession,
  projectEvent,
  projectHistory,
  listSessionSummaries,
  type CreateSessionParams,
  type PromptImage,
} from "./session";

export {
  SessionGate,
  gateTool,
  classifyToolPermission,
  INFORMATION_TOOLS,
  SIDE_EFFECT_TOOLS,
  type ToolGateDecision,
} from "./tool-gate";

export {
  createSubagentTool,
  createNotifyTool,
  createSearchKbTool,
  createReadNodeTool,
  createBuiltinSideEffectTool,
  SIDE_EFFECT_BUILTIN_TOOLS,
  type CollaborationDeps,
  type NotifyDeps,
  type KnowledgeDeps,
} from "./tools";

export { resolveToolNames } from "./tool-policy";

export { listSkills } from "./skills";
