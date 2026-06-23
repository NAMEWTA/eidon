/**
 * backend/domain/ai/tools —— EIDON 专属 Pi 工具（defineTool）。
 *
 * 多 Agent 协作工具：`subagent` 把子任务委派给另一个 Agent。工具只声明 schema + 调用注入的回调，
 * 真正的「跑一个子 Agent 会话」逻辑由 service 注入（保持 domain 不碰 capability）。
 */
import {
  createBashToolDefinition,
  createEditToolDefinition,
  createWriteToolDefinition,
  defineTool,
  type ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { Type } from "@earendil-works/pi-ai";

import type { AnyTool } from "./tool-gate";

import type { SearchHit } from "@shared/models";

/**
 * 需门控的副作用内置工具名（写盘 / 执行命令）。信息类内置（read/grep/find/ls）不在此列，
 * 仍走 SDK 的 `tools` 内置激活、永远放行；这三个改由 service 包装门控后作为 customTool 注入。
 */
export const SIDE_EFFECT_BUILTIN_TOOLS = ["bash", "edit", "write"] as const;

/**
 * 创建一个副作用内置工具的「定义」（非 AgentTool），供 service 用 {@link gateTool} 包门控后注入 customTools。
 * 这样 bash/edit/write 不再作为内置激活，而是经闸门的 customTool —— execute 前先过权限档判定。
 * @returns 对应工具定义；非副作用内置名返回 null。
 */
export function createBuiltinSideEffectTool(name: string, cwd: string): AnyTool | null {
  switch (name) {
    case "bash":
      return createBashToolDefinition(cwd);
    case "edit":
      return createEditToolDefinition(cwd);
    case "write":
      return createWriteToolDefinition(cwd);
    default:
      return null;
  }
}

export interface CollaborationDeps {
  /** 委派任务给目标 Agent（按 id），返回其文本结论；不可调用时返回说明文本。 */
  runSubAgent: (agentId: string, task: string) => Promise<string>;
}

export interface NotifyDeps {
  /** 发送一条通知给用户（弹 Toast + 系统通知）。 */
  notify: (title: string, body: string) => void;
}

/** `notify` 工具：Agent 主动把进展/结果回灌给用户（参考 HanaAgent cron/heartbeat 的 notify 工具）。 */
export function createNotifyTool(deps: NotifyDeps): ToolDefinition {
  return defineTool({
    name: "notify",
    label: "通知用户",
    description:
      "向用户发送一条通知（弹出 Toast + 系统通知）。" +
      "适合：定时/后台任务完成后回报结果、发现需要用户关注的事项时主动提醒。" +
      "title 简短，body 一两句话说清结论。",
    parameters: Type.Object({
      title: Type.String({ description: "通知标题（简短）" }),
      body: Type.String({ description: "通知正文（一两句话）" }),
    }),
    execute: async (_toolCallId, params) => {
      deps.notify(params.title, params.body);
      return { content: [{ type: "text", text: "已向用户发送通知。" }], details: null };
    },
  });
}

/** `subagent` 工具：委派子任务给名册中的其他 Agent。 */
export function createSubagentTool(deps: CollaborationDeps): ToolDefinition {
  return defineTool({
    name: "subagent",
    label: "委派子 Agent",
    description:
      "把一个明确的子任务委派给另一个 Agent（按其 id），返回它的文本结论。" +
      "适合借助其他 Agent 的专长、并行独立子任务、或获取不同视角审阅。" +
      "agent 参数必须是系统提示「团队」名册里反引号中的 id。",
    parameters: Type.Object({
      agent: Type.String({ description: "目标 Agent 的 id（见团队名册）" }),
      task: Type.String({ description: "要委派的具体任务描述（自包含、可独立执行）" }),
    }),
    execute: async (_toolCallId, params) => {
      const text = await deps.runSubAgent(params.agent, params.task);
      return { content: [{ type: "text", text }], details: null };
    },
  });
}

/** EIDON 知识库工具依赖（由 service 注入，绑定当前工作区；保持 domain 不碰 capability）。 */
export interface KnowledgeDeps {
  /** 工作区 Markdown 全文搜索，返回命中（file/line/snippet）。 */
  searchKb: (query: string, maxResults: number) => Promise<SearchHit[]>;
  /** 读取工作区内某文件全文（路径相对工作区根；越权/过大由实现侧处理）。 */
  readNode: (relPath: string) => Promise<string>;
}

/** `search_kb` 工具：在工作区知识库做结构化全文搜索（比裸 grep 更聚焦 Markdown 笔记）。 */
export function createSearchKbTool(deps: KnowledgeDeps): ToolDefinition {
  return defineTool({
    name: "search_kb",
    label: "搜索知识库",
    description:
      "在当前工作区的 Markdown 知识库做全文搜索，返回命中文件、行号与摘要。" +
      "回答涉及用户笔记/文档的问题前先用它查证，避免臆测。",
    parameters: Type.Object({
      query: Type.String({ description: "搜索关键词（子串，不分大小写）" }),
      maxResults: Type.Optional(Type.Number({ description: "最多返回条数（默认 20）" })),
    }),
    execute: async (_toolCallId, params) => {
      const hits = await deps.searchKb(params.query, params.maxResults ?? 20);
      const text = hits.length
        ? hits.map((h) => `${h.file}:${h.line}  ${h.snippet}`).join("\n")
        : `未找到匹配「${params.query}」的内容。`;
      return { content: [{ type: "text", text }], details: null };
    },
  });
}

/** `read_node` 工具：读取工作区内某节点/文件全文（search_kb 命中后取全文）。 */
export function createReadNodeTool(deps: KnowledgeDeps): ToolDefinition {
  return defineTool({
    name: "read_node",
    label: "读取节点",
    description:
      "读取工作区内某个文件/节点的完整文本（路径相对工作区根，如 `项目/计划.md`）。" +
      "适合 search_kb 命中后读全文、或读取用户指明的具体笔记。",
    parameters: Type.Object({
      path: Type.String({ description: "相对工作区根的文件路径" }),
    }),
    execute: async (_toolCallId, params) => {
      try {
        const text = await deps.readNode(params.path);
        return { content: [{ type: "text", text }], details: null };
      } catch (err) {
        return {
          content: [{ type: "text", text: `读取失败：${err instanceof Error ? err.message : String(err)}` }],
          details: null,
        };
      }
    },
  });
}
