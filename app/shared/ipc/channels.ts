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
  AgentDetail,
  AgentSummary,
  AggregatedTodo,
  AiSessionState,
  AiSessionSummary,
  ChatMessageWire,
  SessionPermissionMode,
  AppBuildInfo,
  BacklinkRef,
  BridgeBinding,
  BridgeStatus,
  CjkIssue,
  CloudFolderInfo,
  CommitMeta,
  ConsistencyReport,
  CreateAgentInput,
  CreateNodeInput,
  CronJob,
  CronJobInput,
  CronJobPatch,
  DialogFilter,
  DiffResult,
  FileReadResult,
  FsDirEntry,
  IndexEntry,
  InvalidTemplate,
  Misspelling,
  ModelInfo,
  MoveNodeInput,
  NodeMutationResult,
  NodeRef,
  NormalizationResult,
  PandocExportArgs,
  RelocateNodeInput,
  PandocInfo,
  ProviderInfo,
  PromoteFolderInput,
  PruneResult,
  RenameNodeInput,
  ScannedNode,
  SearchHit,
  SessionPayload,
  ThinkingLevel,
  SiblingSession,
  SkillInfo,
  TagCount,
  Template,
  ToolInfo,
  TemplateInput,
  UpdateAgentPatch,
  UpdateNodeFieldsInput,
  UpgradeNodeSchemaInput,
  WorkspaceStatus,
} from "../models";
import type {
  BridgePlatform,
  Channel as ChannelEntity,
  ModelMeta,
  ModelRef,
  NodeTodoFile,
} from "../contracts";

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
  /** 降级/重定位节点：向下移动 + 按新深度重写 level 或剥离 `.node/` 身份。 */
  "nodes:relocate": {
    req: { workspace: string } & RelocateNodeInput;
    res: { path: string; strippedIdentity: boolean };
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

  // ── providers（模型提供商 / 模型配置；全局 ~/.eidon）─────────────────────
  "ai:isAvailable": { req: NoReq; res: boolean };
  "providers:list": { req: NoReq; res: ProviderInfo[] };
  "providers:listModels": { req: { provider?: string }; res: ModelInfo[] };
  "providers:setKey": { req: { provider: string; apiKey: string }; res: void };
  "providers:setDefaultModel": { req: { model: ModelRef | null }; res: void };
  "providers:getDefaultModel": { req: NoReq; res: ModelRef | null };
  "providers:setConfig": {
    req: {
      provider: string;
      patch: { enabled?: boolean; baseUrl?: string | null; api?: string | null; headers?: Record<string, string> };
    };
    res: void;
  };
  "providers:setModelMeta": {
    req: { provider: string; modelId: string; meta: ModelMeta };
    res: void;
  };
  "providers:removeModelMeta": { req: { provider: string; modelId: string }; res: void };
  "providers:remove": { req: { provider: string }; res: void };
  "providers:test": {
    req: { provider: string; baseUrl: string; api: string; apiKey?: string };
    res: boolean;
  };
  "providers:fetchModels": {
    req: { provider: string; baseUrl: string; api: string; apiKey?: string };
    res: string[];
  };

  // ── ai（会话控制；流式结果经 eidon:ai-stream 事件推送）──────────────────
  "ai:newSession": {
    req: { agentId?: string; workspace?: string };
    res: { sessionId: string; state: AiSessionState };
  };
  "ai:prompt": { req: { sessionId: string; text: string }; res: void };
  "ai:cancel": { req: { sessionId: string }; res: void };
  "ai:setModel": { req: { sessionId: string; model: ModelRef }; res: boolean };
  "ai:disposeSession": { req: { sessionId: string }; res: void };
  "ai:sessionState": {
    req: { sessionId: string };
    res: AiSessionState | null;
  };
  /** 列出某 Agent 的历史会话（按更新时间倒序），供标题栏历史浮层。 */
  "ai:listSessions": {
    req: { agentId?: string };
    res: AiSessionSummary[];
  };
  /** 载入一个历史会话续聊：建活会话 + 回放历史消息视图。 */
  "ai:loadSession": {
    req: { agentId?: string; sessionFile: string };
    res: { sessionId: string; state: AiSessionState; messages: ChatMessageWire[] };
  };
  /** 运行时切换会话权限档（工具门控立即生效）。 */
  "ai:setPermissionMode": {
    req: { sessionId: string; mode: SessionPermissionMode };
    res: void;
  };
  /** 运行时切换会话推理强度。 */
  "ai:setThinkingLevel": {
    req: { sessionId: string; level: ThinkingLevel };
    res: void;
  };
  /** ask 档下用户对某次工具调用的批准/拒绝。 */
  "ai:approveTool": {
    req: { sessionId: string; toolCallId: string; approved: boolean };
    res: void;
  };

  // ── agents（多 Agent CRUD；全局 ~/.eidon/agents）─────────────────────────
  "agents:list": { req: NoReq; res: AgentSummary[] };
  "agents:get": { req: { agentId: string }; res: AgentDetail | null };
  "agents:create": { req: CreateAgentInput; res: AgentSummary };
  "agents:update": {
    req: { agentId: string; patch: UpdateAgentPatch };
    res: AgentSummary;
  };
  "agents:delete": { req: { agentId: string }; res: void };
  /** 默认助手：对话未显式选 Agent 时使用；`null` = 回退首个 Agent。 */
  "agents:setDefault": { req: { agentId: string | null }; res: void };
  "agents:getDefault": { req: NoReq; res: string | null };

  // ── tools / skills（全局工具管理 + skill 发现）───────────────────────────
  "tools:list": { req: NoReq; res: ToolInfo[] };
  "tools:setEnabled": { req: { name: string; enabled: boolean }; res: void };
  "skills:list": { req: { workspace?: string }; res: SkillInfo[] };

  // ── cron（每 Agent 定时任务）─────────────────────────────────────────────
  "cron:list": { req: { agentId: string }; res: CronJob[] };
  "cron:add": { req: { agentId: string; input: CronJobInput }; res: CronJob };
  "cron:update": {
    req: { agentId: string; jobId: string; patch: CronJobPatch };
    res: CronJob | null;
  };
  "cron:toggle": { req: { agentId: string; jobId: string }; res: CronJob | null };
  "cron:remove": { req: { agentId: string; jobId: string }; res: void };

  // ── channels（多 Agent 群聊）─────────────────────────────────────────────
  "channels:list": { req: NoReq; res: ChannelEntity[] };
  "channels:create": { req: { name: string; members: string[] }; res: ChannelEntity };
  "channels:update": {
    req: { id: string; patch: { name?: string; members?: string[] } };
    res: ChannelEntity | null;
  };
  "channels:delete": { req: { id: string }; res: void };
  "channels:prompt": {
    req: { channelId: string; text: string; workspace?: string };
    res: void;
  };

  // ── bridge（多平台接入：飞书 + 微信官方 iLink）─────────────────────────────
  "bridge:listBindings": { req: NoReq; res: BridgeBinding[] };
  "bridge:status": { req: NoReq; res: BridgeStatus[] };
  "bridge:bind": {
    req: {
      platform: BridgePlatform;
      agentId: string | null;
      creds?: Record<string, string>;
      enabled?: boolean;
    };
    res: void;
  };
  "bridge:setEnabled": { req: { platform: BridgePlatform; enabled: boolean }; res: void };
  "bridge:unbind": { req: { platform: BridgePlatform }; res: void };
  "bridge:wechatStartLogin": { req: NoReq; res: void };
  "bridge:wechatCancelLogin": { req: NoReq; res: void };
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
  "nodes:relocate": true,
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
  "ai:isAvailable": true,
  "providers:list": true,
  "providers:listModels": true,
  "providers:setKey": true,
  "providers:setDefaultModel": true,
  "providers:getDefaultModel": true,
  "providers:setConfig": true,
  "providers:setModelMeta": true,
  "providers:removeModelMeta": true,
  "providers:remove": true,
  "providers:test": true,
  "providers:fetchModels": true,
  "ai:newSession": true,
  "ai:prompt": true,
  "ai:cancel": true,
  "ai:setModel": true,
  "ai:disposeSession": true,
  "ai:sessionState": true,
  "ai:listSessions": true,
  "ai:loadSession": true,
  "ai:setPermissionMode": true,
  "ai:setThinkingLevel": true,
  "ai:approveTool": true,
  "agents:list": true,
  "agents:get": true,
  "agents:create": true,
  "agents:update": true,
  "agents:delete": true,
  "agents:setDefault": true,
  "agents:getDefault": true,
  "tools:list": true,
  "tools:setEnabled": true,
  "skills:list": true,
  "cron:list": true,
  "cron:add": true,
  "cron:update": true,
  "cron:toggle": true,
  "cron:remove": true,
  "channels:list": true,
  "channels:create": true,
  "channels:update": true,
  "channels:delete": true,
  "channels:prompt": true,
  "bridge:listBindings": true,
  "bridge:status": true,
  "bridge:bind": true,
  "bridge:setEnabled": true,
  "bridge:unbind": true,
  "bridge:wechatStartLogin": true,
  "bridge:wechatCancelLogin": true,
};

export const ALL_CHANNELS = Object.keys(CHANNEL_PRESENCE) as Channel[];
