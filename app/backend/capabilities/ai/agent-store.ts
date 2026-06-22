/**
 * backend/capabilities/ai/agent-store —— Agent 文件夹 CRUD（纯 node）。
 *
 * 每个 Agent 是一个目录 `~/.eidon/agents/{id}/`（参考 HanaAgent「Agent=文件夹」）：
 *   config.json（{@link AgentConfigSchema}）+ identity.md（人格正文）+ sessions/ + memory/ + cron-jobs.json。
 * 读容错（坏 config 跳过），便于「删缓存/损坏单个 Agent 不影响其余」。
 */
import { promises as fs } from "node:fs";

import { AgentConfigSchema, type AgentConfig } from "@shared/contracts";

import {
  agentConfigPath,
  agentDir,
  agentExperiencePath,
  agentIdentityPath,
  agentIshikiPath,
  agentMemoryDir,
  agentPinnedPath,
  agentSessionsDir,
  agentsDir,
  assertSafeId,
} from "./paths";
import { writeJson } from "./store";

/** 列出含合法 config.json 的 Agent id（字典序=创建序）。 */
export async function listAgentIds(): Promise<string[]> {
  let entries;
  try {
    entries = await fs.readdir(agentsDir(), { withFileTypes: true });
  } catch {
    return [];
  }
  const ids: string[] = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    try {
      await fs.access(agentConfigPath(e.name));
      ids.push(e.name);
    } catch {
      // 无 config.json 的目录不算 Agent
    }
  }
  return ids.sort();
}

/** 读单个 Agent 配置；缺失/损坏 → null。 */
export async function readAgentConfig(id: string): Promise<AgentConfig | null> {
  assertSafeId(id);
  try {
    const raw = await fs.readFile(agentConfigPath(id), "utf8");
    const parsed = AgentConfigSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** 读全部 Agent 配置（跳过损坏项）。 */
export async function listAgentConfigs(): Promise<AgentConfig[]> {
  const ids = await listAgentIds();
  const configs = await Promise.all(ids.map(readAgentConfig));
  return configs.filter((c): c is AgentConfig => c !== null);
}

/** 校验并写回 Agent 配置（含创建目录骨架）。 */
export async function writeAgentConfig(config: AgentConfig): Promise<AgentConfig> {
  assertSafeId(config.id);
  await ensureAgentDir(config.id);
  return writeJson(AgentConfigSchema, agentConfigPath(config.id), config);
}

/** 建 Agent 目录骨架（sessions/ + memory/）。 */
export async function ensureAgentDir(id: string): Promise<void> {
  assertSafeId(id);
  await fs.mkdir(agentSessionsDir(id), { recursive: true });
  await fs.mkdir(agentMemoryDir(id), { recursive: true });
}

/** 读人格正文 identity.md；缺失 → null。 */
export async function readIdentity(id: string): Promise<string | null> {
  assertSafeId(id);
  try {
    return await fs.readFile(agentIdentityPath(id), "utf8");
  } catch {
    return null;
  }
}

/** 写人格正文 identity.md。 */
export async function writeIdentity(id: string, markdown: string): Promise<void> {
  assertSafeId(id);
  await fs.mkdir(agentDir(id), { recursive: true });
  await fs.writeFile(agentIdentityPath(id), markdown, "utf8");
}

/** 读/写 Agent 目录内人格相关 markdown 文档（意识/经验/置顶记忆同构）。 */
async function readAgentDoc(id: string, path: string): Promise<string | null> {
  assertSafeId(id);
  try {
    return await fs.readFile(path, "utf8");
  } catch {
    return null;
  }
}
async function writeAgentDoc(id: string, path: string, markdown: string): Promise<void> {
  assertSafeId(id);
  await fs.mkdir(agentDir(id), { recursive: true });
  await fs.writeFile(path, markdown, "utf8");
}

/** 意识（详细人格，系统提示主体）；缺失 → null。 */
export const readIshiki = (id: string): Promise<string | null> => readAgentDoc(id, agentIshikiPath(id));
export const writeIshiki = (id: string, markdown: string): Promise<void> =>
  writeAgentDoc(id, agentIshikiPath(id), markdown);

/** 经验库正文（分类 markdown）；缺失 → null。 */
export const readExperience = (id: string): Promise<string | null> =>
  readAgentDoc(id, agentExperiencePath(id));
export const writeExperience = (id: string, markdown: string): Promise<void> =>
  writeAgentDoc(id, agentExperiencePath(id), markdown);

/** 置顶记忆（自由 markdown 列表）；缺失 → null。 */
export const readPinned = (id: string): Promise<string | null> => readAgentDoc(id, agentPinnedPath(id));
export const writePinned = (id: string, markdown: string): Promise<void> =>
  writeAgentDoc(id, agentPinnedPath(id), markdown);

/** 删除整个 Agent 目录（含会话/记忆/定时任务）。 */
export async function deleteAgent(id: string): Promise<void> {
  assertSafeId(id);
  await fs.rm(agentDir(id), { recursive: true, force: true });
}
