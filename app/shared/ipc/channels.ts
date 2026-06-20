/**
 * shared/ipc/channels.ts — typed IPC 契约「单一事实源」。
 *
 * `IpcContract` 为每条通道声明 `{ req, res }`，同时为三层供型：
 *  - renderer 客户端 `src/ipc/client.ts` 的 `invoke<C>(c, req): Promise<Res<C>>`
 *  - preload `window.eidon.invoke`
 *  - main 的 `Handlers = { [C in Channel]: (req: Req<C>) => Promise<Res<C>> }`（映射类型强制穷尽，
 *    漏/多通道即编译错）
 *
 * 请求体/响应体一律 camelCase（wire 形状见 shared/models，已统一 camelCase，见 ADR-0025/D7）。
 * 通道命名：`<domain>:<verb>`。
 */
import type {
  AggregatedTodo,
  AppBuildInfo,
  BacklinkRef,
  CjkIssue,
  CloudFolderInfo,
  CommitMeta,
  ConsistencyReport,
  CreateNodeInput,
  DialogFilter,
  DiffResult,
  FileReadResult,
  FsDirEntry,
  IndexEntry,
  InvalidTemplate,
  Misspelling,
  MoveNodeInput,
  NodeMutationResult,
  NodeRef,
  NormalizationResult,
  PandocExportArgs,
  PandocInfo,
  PromoteFolderInput,
  PruneResult,
  RenameNodeInput,
  ScannedNode,
  SearchHit,
  SessionPayload,
  SiblingSession,
  TagCount,
  Template,
  TemplateInput,
  UpdateNodeFieldsInput,
  UpgradeNodeSchemaInput,
  WorkspaceStatus,
} from "../models";
import type { NodeTodoFile } from "../contracts";

/** 无参请求的占位类型（renderer 传 `{}`）。 */
export type NoReq = Record<string, never>;

export interface IpcContract {
  // ── editor ────────────────────────────────────────────────────────
  "editor:readFile": { req: { path: string }; res: FileReadResult | null };
  "editor:writeFile": {
    req: { path: string; content: string; encoding: string };
    res: void;
  };
  "editor:readBinaryFile": { req: { path: string }; res: Uint8Array };
  "editor:writeBinaryFile": {
    req: { path: string; data: Uint8Array | number[] };
    res: void;
  };
  "editor:print": { req: NoReq; res: void };
  "editor:copyFile": { req: { src: string; dst: string }; res: void };
  "editor:listDir": {
    req: { path: string; includeHidden?: boolean };
    res: FsDirEntry[];
  };
  "editor:createFile": {
    req: { path: string; content?: string | null };
    res: void;
  };
  "editor:createDir": { req: { path: string }; res: void };
  "editor:delete": { req: { path: string }; res: void };
  "editor:rename": { req: { from: string; to: string }; res: void };
  "editor:convert": { req: { path: string }; res: string };
  "editor:pandocDetect": { req: NoReq; res: PandocInfo | null };
  "editor:pandocExport": { req: { args: PandocExportArgs }; res: void };
  "editor:watchFile": { req: { path: string }; res: void };
  "editor:unwatchFile": { req: { path: string }; res: void };

  // ── knowledge ─────────────────────────────────────────────────────
  "kn:indexInit": { req: { workspace: string }; res: number };
  "kn:indexFiles": { req: NoReq; res: IndexEntry[] };
  "kn:backlinks": { req: { target: string }; res: BacklinkRef[] };
  "kn:tags": { req: NoReq; res: TagCount[] };
  "kn:resolve": { req: { name: string }; res: string | null };
  "kn:rescan": { req: NoReq; res: number };
  "kn:search": {
    req: { root: string; query: string; maxResults?: number };
    res: SearchHit[];
  };
  "kn:spellInit": { req: { lang: string }; res: number };
  "kn:spellCheck": { req: { text: string }; res: Misspelling[] };
  "kn:spellSuggest": { req: { word: string }; res: string[] };
  "kn:spellAdd": { req: { word: string }; res: void };
  "kn:spellLoadUser": { req: NoReq; res: string[] };
  "kn:cjkProofread": { req: { text: string }; res: CjkIssue[] };

  // ── git ───────────────────────────────────────────────────────────
  "git:status": { req: { folder: string }; res: WorkspaceStatus };
  "git:init": {
    req: {
      folder: string;
      initialMessage?: string | null;
      excludeAssets?: boolean;
    };
    res: void;
  };
  "git:autoCommit": {
    req: { folder: string; filePath?: string | null; message?: string | null };
    res: string | null;
  };
  "git:fileHistory": {
    req: { folder: string; filePath: string; limit?: number };
    res: CommitMeta[];
  };
  "git:fileDiff": {
    req: { folder: string; filePath: string; sha: string };
    res: DiffResult;
  };
  "git:fileAtVersion": {
    req: { folder: string; filePath: string; sha: string };
    res: string;
  };
  "git:rollbackFile": {
    req: { folder: string; filePath: string; sha: string };
    res: void;
  };
  "git:dirty": { req: { workspace: string }; res: boolean };
  "git:createBranch": { req: { workspace: string; branch: string }; res: void };
  "git:checkout": { req: { workspace: string; branch: string }; res: string };
  "git:restoreHead": { req: { workspace: string; branch: string }; res: void };
  "git:deleteBranch": { req: { workspace: string; branch: string }; res: void };
  "git:repoSize": { req: { folder: string }; res: number };
  "git:pruneHistory": {
    req: { folder: string; maxCommits: number };
    res: PruneResult;
  };
  "git:cloudDetect": { req: { folder: string }; res: CloudFolderInfo };
  "git:deviceId": { req: NoReq; res: string };
  "git:sessionSave": {
    req: { folder: string; payload: SessionPayload };
    res: void;
  };
  "git:sessionLoad": {
    req: { folder: string; deviceId: string };
    res: SessionPayload | null;
  };
  "git:sessionListOthers": {
    req: { folder: string; ourDeviceId: string };
    res: SiblingSession[];
  };

  // ── shell / app ───────────────────────────────────────────────────
  "shell:buildInfo": { req: NoReq; res: AppBuildInfo };
  "shell:osPaths": {
    req: NoReq;
    res: { documents: string; temp: string; home: string };
  };
  "shell:saveLanguage": { req: { lang: string }; res: void };
  "shell:setMenuLanguage": { req: { lang: string }; res: void };
  "shell:forceClose": { req: NoReq; res: void };

  // ── native（dialog/clipboard/opener/notification/window）──
  "dialog:open": {
    req: {
      multiple?: boolean;
      directory?: boolean;
      defaultPath?: string;
      filters?: DialogFilter[];
    };
    res: string | string[] | null;
  };
  "dialog:save": {
    req: { defaultPath?: string; filters?: DialogFilter[] };
    res: string | null;
  };
  "clipboard:writeText": { req: { text: string }; res: void };
  "clipboard:writeHtml": { req: { html: string; text?: string }; res: void };
  "clipboard:writeImage": { req: { dataUrl: string }; res: void };
  "shell:openExternal": { req: { url: string }; res: void };
  "shell:openPath": { req: { path: string }; res: void };
  "shell:revealItemInDir": { req: { path: string }; res: void };
  "notify:requestPermission": { req: NoReq; res: boolean };
  "notify:send": { req: { title: string; body?: string }; res: void };
  "win:setTitle": { req: { title: string }; res: void };

  // ── nodes（节点域，原 shared/domain/nodes 经 IPC 暴露，见 ADR-0025/D1）──
  "nodes:scan": { req: { workspace: string }; res: ScannedNode[] };
  "nodes:create": {
    req: { workspace: string } & CreateNodeInput;
    res: NodeMutationResult;
  };
  "nodes:promote": {
    req: { workspace: string } & PromoteFolderInput;
    res: NodeMutationResult;
  };
  "nodes:rename": {
    req: { workspace: string } & RenameNodeInput;
    res: NodeMutationResult;
  };
  "nodes:move": {
    req: { workspace: string } & MoveNodeInput;
    res: NodeMutationResult;
  };
  "nodes:updateFields": {
    req: { workspace: string } & UpdateNodeFieldsInput;
    res: NodeMutationResult;
  };
  "nodes:upgradeSchema": {
    req: { workspace: string } & UpgradeNodeSchemaInput;
    res: NodeMutationResult;
  };
  "nodes:ensureInbox": { req: { workspace: string }; res: string };
  "nodes:ensureCalendar": {
    req: { workspace: string; date: string };
    res: string;
  };

  // ── templates（模板域，原 shared/domain/templates）────────────────────
  "templates:list": {
    req: { workspace: string };
    res: { templates: Template[]; invalid: InvalidTemplate[] };
  };
  "templates:init": {
    req: { workspace: string };
    res: { templates: Template[]; invalid: InvalidTemplate[] };
  };
  "templates:create": {
    req: { workspace: string; input: TemplateInput };
    res: Template;
  };
  "templates:edit": {
    req: { workspace: string; templateId: string; input: TemplateInput };
    res: Template;
  };
  "templates:delete": {
    req: { workspace: string; templateId: string };
    res: void;
  };
  "templates:get": {
    req: { workspace: string; templateId: string; version?: number };
    res: Template | null;
  };
  "templates:listVersions": {
    req: { workspace: string; templateId: string };
    res: number[];
  };

  // ── todos（待办域，磁盘读写；纯时间数学在 shared/utils/reminders）──────
  "todos:scan": {
    req: { workspace: string; nodes: NodeRef[] };
    res: AggregatedTodo[];
  };
  "todos:readNode": {
    req: { workspace: string; nodePath: string; nodeId: string };
    res: NodeTodoFile;
  };
  "todos:writeNode": {
    req: { workspace: string; nodePath: string; file: NodeTodoFile };
    res: NodeTodoFile;
  };

  // ── consistency（一致性检测 / 一键迁移）───────────────────────────────
  "consistency:check": { req: { workspace: string }; res: ConsistencyReport };
  "consistency:normalize": {
    req: { workspace: string };
    res: NormalizationResult;
  };
}

export type Channel = keyof IpcContract;
export type Req<C extends Channel> = IpcContract[C]["req"];
export type Res<C extends Channel> = IpcContract[C]["res"];

/**
 * 全通道清单（运行时可枚举）。下方 `Record<Channel, true>` 字面量强制穷尽：
 * 漏写某通道即缺键、写错则多键 —— 均为编译错误（启动期穷尽性校验）。
 * backend/ipc/register.ts 据此在启动时校验 handler 覆盖全部通道。
 */
const CHANNEL_PRESENCE: Record<Channel, true> = {
  "editor:readFile": true,
  "editor:writeFile": true,
  "editor:readBinaryFile": true,
  "editor:writeBinaryFile": true,
  "editor:print": true,
  "editor:copyFile": true,
  "editor:listDir": true,
  "editor:createFile": true,
  "editor:createDir": true,
  "editor:delete": true,
  "editor:rename": true,
  "editor:convert": true,
  "editor:pandocDetect": true,
  "editor:pandocExport": true,
  "editor:watchFile": true,
  "editor:unwatchFile": true,
  "kn:indexInit": true,
  "kn:indexFiles": true,
  "kn:backlinks": true,
  "kn:tags": true,
  "kn:resolve": true,
  "kn:rescan": true,
  "kn:search": true,
  "kn:spellInit": true,
  "kn:spellCheck": true,
  "kn:spellSuggest": true,
  "kn:spellAdd": true,
  "kn:spellLoadUser": true,
  "kn:cjkProofread": true,
  "git:status": true,
  "git:init": true,
  "git:autoCommit": true,
  "git:fileHistory": true,
  "git:fileDiff": true,
  "git:fileAtVersion": true,
  "git:rollbackFile": true,
  "git:dirty": true,
  "git:createBranch": true,
  "git:checkout": true,
  "git:restoreHead": true,
  "git:deleteBranch": true,
  "git:repoSize": true,
  "git:pruneHistory": true,
  "git:cloudDetect": true,
  "git:deviceId": true,
  "git:sessionSave": true,
  "git:sessionLoad": true,
  "git:sessionListOthers": true,
  "shell:buildInfo": true,
  "shell:osPaths": true,
  "shell:saveLanguage": true,
  "shell:setMenuLanguage": true,
  "shell:forceClose": true,
  "dialog:open": true,
  "dialog:save": true,
  "clipboard:writeText": true,
  "clipboard:writeHtml": true,
  "clipboard:writeImage": true,
  "shell:openExternal": true,
  "shell:openPath": true,
  "shell:revealItemInDir": true,
  "notify:requestPermission": true,
  "notify:send": true,
  "win:setTitle": true,
  "nodes:scan": true,
  "nodes:create": true,
  "nodes:promote": true,
  "nodes:rename": true,
  "nodes:move": true,
  "nodes:updateFields": true,
  "nodes:upgradeSchema": true,
  "nodes:ensureInbox": true,
  "nodes:ensureCalendar": true,
  "templates:list": true,
  "templates:init": true,
  "templates:create": true,
  "templates:edit": true,
  "templates:delete": true,
  "templates:get": true,
  "templates:listVersions": true,
  "todos:scan": true,
  "todos:readNode": true,
  "todos:writeNode": true,
  "consistency:check": true,
  "consistency:normalize": true,
};

export const ALL_CHANNELS = Object.keys(CHANNEL_PRESENCE) as Channel[];
