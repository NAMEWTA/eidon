// backend/domain —— 框架无关业务内核（节点/模板/待办/一致性/快照/AI）。
// 仅 import @shared/{contracts,models,utils} + zod + 注入端口；禁 electron/UI（可单测）。
// 数据模型类型在 @shared/models；纯函数工具（路径/日历/提醒）在 @shared/utils。
//
// 注意：AI 内核（domain/ai，重度 Pi SDK）**不**在此 barrel 重导出，避免任何 domain 消费方
// 都被迫加载 Pi SDK；ai-service 直接从 "../domain/ai" 引入。
export * from "./snapshots";

export { detectStructureViolations, normalizeWorkspaceStructure } from "./consistency";

export {
  createNode,
  ensureCalendarStructure,
  ensureDefaultInboxStructure,
  listNodesUsingTemplate,
  moveNode,
  promoteFolderToNode,
  renameNode,
  scanWorkspace,
  updateNodeFields,
  upgradeNodeSchema,
} from "./nodes";

export {
  createTemplate,
  deleteTemplate,
  editTemplate,
  getTemplate,
  initWorkspaceTemplates,
  listInvalidTemplates,
  listTemplates,
  listTemplateVersions,
  DEFAULT_NODE_TEMPLATE_SEED,
  CALENDAR_TEMPLATE_SEED,
} from "./templates";

export {
  emptyTodoFile,
  readNodeTodos,
  scanTodos,
  todosRelPath,
  writeNodeTodos,
} from "./todos";
