/**
 * capabilities/ai/bridge/bridge-session-index —— 桥接会话索引（纯 node）。
 *
 * 把「外部会话标识 sessionKey（如 wechat_dm_xxx@agentId）」映射到该 Agent `sessions/` 下
 * 已落盘的会话文件，使桥接对话**重启后可续接历史**（参照 HanaAgent bridge-session-manager 的
 * index 思路，按 EIDON 四层精简：每 Agent 一份 `bridge-sessions.json`）。
 *
 * 设计：file 存 sessionsDir 相对路径（可移植 + 防越权）；读时校验存在性。
 * 同步读改写：单条调用内 read→write 无 await 间隙，天然避免同 Agent 多会话并发写的交错。
 * 索引可重建（坏文件 → 视为空），符合「可重建」铁律。
 */
import fs from "node:fs";
import path from "node:path";

import { agentDir, agentSessionsDir } from "../paths";

/** 索引条目附带的轻量元数据（仅展示/诊断用）。 */
export interface BridgeSessionMeta {
  senderName?: string;
  updatedAt?: string;
}

interface IndexEntry extends BridgeSessionMeta {
  /** sessionsDir 相对路径（POSIX 分隔）。 */
  file: string;
}

type Index = Record<string, IndexEntry>;

const indexPath = (agentId: string): string => path.join(agentDir(agentId), "bridge-sessions.json");

function read(agentId: string): Index {
  try {
    const data: unknown = JSON.parse(fs.readFileSync(indexPath(agentId), "utf8"));
    return data && typeof data === "object" && !Array.isArray(data) ? (data as Index) : {};
  } catch {
    return {};
  }
}

function write(agentId: string, index: Index): void {
  const target = indexPath(agentId);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const tmp = `${target}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(index, null, 2));
  fs.renameSync(tmp, target);
}

/** 该 sessionKey 已落盘会话文件的绝对路径；无记录 / 文件已删 → null。 */
export function getBridgeSessionFile(agentId: string, sessionKey: string): string | null {
  const entry = read(agentId)[sessionKey];
  if (!entry?.file) return null;
  const abs = path.join(agentSessionsDir(agentId), entry.file);
  return fs.existsSync(abs) ? abs : null;
}

/** 登记/更新某 sessionKey 的会话文件（absFile 必须位于该 Agent 的 sessionsDir 内）。 */
export function setBridgeSessionFile(
  agentId: string,
  sessionKey: string,
  absFile: string,
  meta: BridgeSessionMeta = {},
): void {
  const rel = path.relative(agentSessionsDir(agentId), absFile);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) return; // 越界保护：不在 sessionsDir 内则不记
  const index = read(agentId);
  index[sessionKey] = {
    ...index[sessionKey],
    ...meta,
    file: rel.split(path.sep).join("/"),
    updatedAt: new Date().toISOString(),
  };
  write(agentId, index);
}

/** 启动期清理孤儿条目（file 指向已不存在的文件）。 */
export function reconcileBridgeIndex(agentId: string): void {
  const index = read(agentId);
  let changed = false;
  for (const [key, entry] of Object.entries(index)) {
    const abs = entry?.file ? path.join(agentSessionsDir(agentId), entry.file) : null;
    if (!abs || !fs.existsSync(abs)) {
      delete index[key];
      changed = true;
    }
  }
  if (changed) write(agentId, index);
}
