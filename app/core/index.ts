export * from "./ai";
export * from "./bridge";
export * from "./contracts";
export * from "./shared";

export { detectStructureViolations } from "./consistency";
export type {
  ConsistencyReader,
  ConsistencyReport,
  DirEntry as ConsistencyDirEntry,
  StructureViolation,
  StructureViolationKind,
} from "./consistency";

export {
  createNode,
  DEFAULT_INBOX_PATH,
  DEFAULT_INBOX_SEGMENTS,
  ensureDefaultInboxStructure,
  listNodesUsingTemplate,
  moveNode,
  promoteFolderToNode,
  renameNode,
  scanWorkspace,
  updateNodeFields,
  upgradeNodeSchema,
} from "./nodes";
export type {
  CreateNodeInput,
  DirEntry as NodeDirEntry,
  EnsureDefaultInboxInput,
  EnsureDefaultInboxResult,
  MoveNodeInput,
  NodeMutationResult,
  NodeStore,
  NodeTree,
  PromoteFolderInput,
  RenameNodeInput,
  ScannedNode,
  UpdateNodeFieldsInput,
  UpgradeNodeSchemaInput,
  WorkspaceReader,
} from "./nodes";

export {
  commitSnapshot,
  diffFileSnapshot,
  getSnapshotStatus,
  initSnapshotHistory,
  listFileSnapshots,
  readFileSnapshot,
  restoreFileSnapshot,
} from "./snapshots";
export type {
  SnapshotCommitMeta,
  SnapshotDiffResult,
  SnapshotGateway,
  SnapshotWorkspaceStatus,
} from "./snapshots";

export {
  createTemplate,
  deleteTemplate,
  editTemplate,
  getTemplate,
  initWorkspaceTemplates,
  listTemplates,
  listTemplateVersions,
} from "./templates";
export type {
  DirEntry as TemplateDirEntry,
  LayerInput,
  Template,
  TemplateInput,
  TemplateStore,
} from "./templates";

export {
  collectDue,
  earliestFireAt,
  emptyTodoFile,
  nextFireTime,
  readNodeTodos,
  scanTodos,
  todosRelPath,
  writeNodeTodos,
} from "./todos";
export type {
  AggregatedTodo,
  DueReminder,
  NodeRef,
  TodoFileStore,
} from "./todos";
