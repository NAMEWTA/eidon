/**
 * isomorphic-git 共享底座。
 *
 * 纯 node:fs + isomorphic-git，无 electron 依赖。所有 git 能力共用此处的：
 *  - 仓库探测（isInitialized）
 *  - 提交签名（repo config → ~/.gitconfig → 回退 EIDON/eidon@local，对齐 ADR/计划 §风险8）
 *  - 绝对路径 → 仓库相对路径（含 macOS /tmp→/private 符号链接 canonical 回退）
 *  - 暂存（全量 / 单路径，含删除）
 *  - 跳过空提交（暂存树 == HEAD 树 → 返回 null），对齐 commit_staged
 */
import { promises as fs } from "node:fs";
import fsSync from "node:fs";
import path from "node:path";
import os from "node:os";
import git from "isomorphic-git";

export interface GitSignature {
  name: string;
  email: string;
  timestamp: number; // unix 秒
  timezoneOffset: number; // 分钟（与 isomorphic-git 约定一致）
}

/** isomorphic-git 统一参数（fs + dir）。 */
export function repo(dir: string): { fs: typeof fsSync; dir: string } {
  return { fs: fsSync, dir };
}

/** 该 folder 是否是已初始化的 git 仓库（存在可解析的 .git）。 */
export async function isInitialized(folder: string): Promise<boolean> {
  if (!folder) return false;
  try {
    await fs.access(path.join(folder, ".git"));
    return true;
  } catch {
    return false;
  }
}

/** 读 ~/.gitconfig 的 user.name / user.email（极简解析，best-effort）。 */
function readGlobalGitIdentity(): { name?: string; email?: string } {
  const home = os.homedir();
  for (const candidate of [path.join(home, ".gitconfig"), path.join(home, ".config", "git", "config")]) {
    try {
      const raw = fsSync.readFileSync(candidate, "utf8");
      const name = /^\s*name\s*=\s*(.+)$/m.exec(raw)?.[1]?.trim();
      const email = /^\s*email\s*=\s*(.+)$/m.exec(raw)?.[1]?.trim();
      if (name || email) return { name, email };
    } catch {
      /* 下一候选 */
    }
  }
  return {};
}

/** 提交签名：repo config → ~/.gitconfig → 回退 EIDON/eidon@local。 */
export async function buildSignature(dir: string): Promise<GitSignature> {
  let name: string | undefined;
  let email: string | undefined;
  try {
    name = (await git.getConfig({ ...repo(dir), path: "user.name" })) || undefined;
  } catch {
    /* ignore */
  }
  try {
    email = (await git.getConfig({ ...repo(dir), path: "user.email" })) || undefined;
  } catch {
    /* ignore */
  }
  if (!name?.trim() || !email?.trim()) {
    const global = readGlobalGitIdentity();
    name = name?.trim() || global.name;
    email = email?.trim() || global.email;
  }
  return {
    name: name?.trim() || "EIDON",
    email: email?.trim() || "eidon@local",
    timestamp: Math.floor(Date.now() / 1000),
    timezoneOffset: new Date().getTimezoneOffset(),
  };
}

/**
 * 绝对路径 → 仓库相对（正斜杠）路径；越界返回 null。
 * 先走廉价前缀剥离；不命中再 canonical 两侧重试（macOS /tmp→/private 符号链接）。
 */
export function relPath(dir: string, abs: string): string | null {
  const fast = stripPrefix(dir, abs);
  if (fast !== null) return fast;
  // canonical 父目录 + 文件名（文件可能刚创建，避免对文件本身 realpath）。
  try {
    const parent = path.dirname(abs);
    const canonParent = fsSync.realpathSync(parent);
    const canonAbs = path.join(canonParent, path.basename(abs));
    const canonDir = fsSync.realpathSync(dir);
    return stripPrefix(canonDir, canonAbs);
  } catch {
    return null;
  }
}

function stripPrefix(dir: string, abs: string): string | null {
  const base = path.resolve(dir);
  const target = path.resolve(abs);
  if (target === base) return "";
  const prefix = base.endsWith(path.sep) ? base : base + path.sep;
  if (!target.startsWith(prefix)) return null;
  return target.slice(prefix.length).split(path.sep).join("/");
}

/**
 * 暂存：
 *  - rel 为某路径：暂存该单文件（存在则 add，否则 remove 处理删除）。
 *  - rel 为 null：全量暂存所有改动 + 新增 + 删除（statusMatrix 驱动）。
 */
export async function stage(dir: string, rel: string | null): Promise<void> {
  if (rel !== null) {
    const exists = await pathExists(path.join(dir, rel));
    if (exists) await git.add({ ...repo(dir), filepath: rel });
    else await git.remove({ ...repo(dir), filepath: rel });
    return;
  }
  const matrix = await git.statusMatrix(repo(dir));
  for (const [filepath, , worktreeStatus] of matrix) {
    if (worktreeStatus === 0) {
      await git.remove({ ...repo(dir), filepath });
    } else {
      await git.add({ ...repo(dir), filepath });
    }
  }
}

/**
 * 提交当前索引；暂存内容与 HEAD 一致（无任何已暂存差异）则跳过返回 null（对齐 commit_staged）。
 *
 * isomorphic-git 的 commit() 从索引建树并自动以 HEAD 为父（未出生 HEAD → 根提交）。
 * 「是否有变化」用 statusMatrix 判定：任一文件的 STAGE 与 HEAD 不一致即需提交。
 */
export async function commitStaged(
  dir: string,
  sig: GitSignature,
  message: string,
): Promise<string | null> {
  if (!(await hasStagedChanges(dir))) return null;
  return git.commit({ ...repo(dir), message, author: sig, committer: sig });
}

/** 索引相对 HEAD 是否有差异（已暂存的增/删/改）。 */
async function hasStagedChanges(dir: string): Promise<boolean> {
  const matrix = await git.statusMatrix(repo(dir));
  // 行 = [filepath, head, workdir, stage]；stage 与 head 一致(均无/均同)即未暂存改动。
  return matrix.some(
    ([, head, , stageS]) => !((head === 1 && stageS === 1) || (head === 0 && stageS === 0)),
  );
}

export async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/** `auto: YYYY-MM-DD HH:MM:SS`（UTC）。 */
export function defaultAutoMessage(): string {
  const d = new Date();
  const p = (n: number, w = 2): string => String(n).padStart(w, "0");
  const ts = `${p(d.getUTCFullYear(), 4)}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(
    d.getUTCHours(),
  )}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
  return `auto: ${ts}`;
}

export { git };
