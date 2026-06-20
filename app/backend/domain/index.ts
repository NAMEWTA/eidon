// backend/domain —— 框架无关业务内核（节点/模板/待办/一致性/快照/AI 占位）。
// 仅 import @shared/{contracts,models,utils} + zod + 注入端口；禁 electron/UI（可单测）。
// 数据模型类型在 @shared/models；纯函数工具（路径/日历/提醒）在 @shared/utils。
export * from "./ai";
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
