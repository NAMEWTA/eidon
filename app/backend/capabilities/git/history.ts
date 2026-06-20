/**
 * 单文件历史/取版本/回滚。
 *
 * fileHistory：沿 HEAD 走 log，仅保留触及该文件的提交（新→旧），上限 limit（0→50）。
 * fileAtVersion：取某提交树里该文件 blob 内容。rollback：用旧版本覆盖工作副本。
 */
import { promises as fs } from "node:fs";
import type { CommitMeta } from "@shared/models";
import { git, repo, isInitialized, relPath } from "./git-client";

export async function fileHistory(
  folder: string,
  filePath: string,
  limit: number,
): Promise<CommitMeta[]> {
  if (!(await isInitialized(folder))) throw new Error(`git open failed: ${folder}`);
  const rel = relPath(folder, filePath);
  if (rel === null) throw new Error(`file is outside workspace: ${filePath}`);

  // 无 HEAD → 空历史。
  try {
    await git.resolveRef({ ...repo(folder), ref: "HEAD" });
  } catch {
    return [];
  }

  const cap = limit === 0 ? 50 : limit;
  // isomorphic-git 的 filepath 过滤：仅返回改动该文件的提交（含新增/删除），force 避免缺失抛错。
  const commits = await git.log({
    ...repo(folder),
    ref: "HEAD",
    filepath: rel,
    force: true,
  });

  const out: CommitMeta[] = [];
  for (const c of commits) {
    out.push(commitToMeta(c.oid, c.commit));
    if (out.length >= cap) break;
  }
  return out;
}

function commitToMeta(
  oid: string,
  commit: { message: string; author: { name: string; timestamp: number } },
): CommitMeta {
  return {
    sha: oid,
    shortSha: oid.length >= 7 ? oid.slice(0, 7) : oid,
    message: commit.message.split("\n")[0] ?? "",
    author: commit.author.name || "?",
    time: commit.author.timestamp,
  };
}

export async function fileAtVersion(
  folder: string,
  filePath: string,
  sha: string,
): Promise<string> {
  if (!(await isInitialized(folder))) throw new Error(`git open failed: ${folder}`);
  const rel = relPath(folder, filePath);
  if (rel === null) throw new Error(`file is outside workspace: ${filePath}`);
  try {
    const { blob } = await git.readBlob({ ...repo(folder), oid: sha, filepath: rel });
    return Buffer.from(blob).toString("utf8");
  } catch (e) {
    throw new Error(`file not in commit: ${(e as Error).message}`);
  }
}

export async function rollbackFile(
  folder: string,
  filePath: string,
  sha: string,
): Promise<void> {
  const content = await fileAtVersion(folder, filePath, sha);
  await fs.writeFile(filePath, content);
}
