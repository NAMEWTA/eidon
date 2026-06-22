/**
 * backend/capabilities/ai/paths —— AI 全局主目录 `~/.eidon` 下的路径解析（纯 node）。
 *
 * 根目录经 `runtime-paths` 注入（main 启动时 = `os.homedir()/.eidon`，见 shell/index）；
 * 本模块只读注入的纯字符串、拼路径，不 import electron（保持能力层可单测）。
 * 磁盘布局见 shared/contracts/ai 头注释。
 */
import { join } from "node:path";

import { getRuntimePaths } from "../runtime-paths";

/** Agent / job / channel id 形状（ULID）；用于路径前防越权。 */
const SAFE_ID = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/** 防路径穿越：拼接 agent 子路径前校验 id 合法（contract 也校验，这里是纵深防御）。 */
export function assertSafeId(id: string): void {
  if (!SAFE_ID.test(id)) {
    throw new Error(`unsafe agent id: ${JSON.stringify(id)}`);
  }
}

export const aiHome = (): string => getRuntimePaths().aiHome;

export const agentsDir = (): string => join(aiHome(), "agents");
export const agentDir = (id: string): string => join(agentsDir(), id);
export const agentConfigPath = (id: string): string => join(agentDir(id), "config.json");
export const agentIdentityPath = (id: string): string => join(agentDir(id), "identity.md");
/** 意识（详细人格，系统提示主体）。 */
export const agentIshikiPath = (id: string): string => join(agentDir(id), "ishiki.md");
/** 经验库正文（分类 markdown；受 config.experience.enabled 门控）。 */
export const agentExperiencePath = (id: string): string => join(agentDir(id), "experience.md");
/** 置顶记忆（自由 markdown 列表，永不衰减）。 */
export const agentPinnedPath = (id: string): string => join(agentDir(id), "pinned.md");
export const agentCronPath = (id: string): string => join(agentDir(id), "cron-jobs.json");
export const agentSessionsDir = (id: string): string => join(agentDir(id), "sessions");
export const agentMemoryDir = (id: string): string => join(agentDir(id), "memory");

export const providersPath = (): string => join(aiHome(), "providers.json");
export const authPath = (): string => join(aiHome(), "auth.json");
export const channelsPath = (): string => join(aiHome(), "channels.json");
export const toolsPath = (): string => join(aiHome(), "tools.json");
/** 平台桥接绑定文件（非密元数据）。 */
export const bridgePath = (): string => join(aiHome(), "bridge.json");
/** 桥接运行态数据目录（微信 cursor / context 持久化等）。 */
export const bridgeDataDir = (): string => join(aiHome(), "bridge");
