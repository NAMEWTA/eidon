/**
 * 历史修剪 + 仓库体积。
 *
 * repoSize：`.git/` 字节数（递归累加，仅供显示）。
 * pruneHistory：保留最近 maxCommits 个提交——把第 max 新版本的树压成无父合成根，其上重建较新提交，
 * 再把当前分支指向新 tip（树 == 旧 HEAD 树，工作区不动）。随后尽力 `git gc` 回收磁盘（未装 git → gcRan:false）。
 * 历史重写用 isomorphic-git；gc 退化为「装了系统 git 才生效」（与现状 best-effort 一致）。
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { PruneResult } from "@shared/models";
import { git, repo, isInitialized, buildSignature } from "./git-client";

const execFileP = promisify(execFile);

// ── 体积 ────────────────────────────────────────────────────────────
export async function repoSize(folder: string): Promise<number> {
  const gitDir = path.join(folder, ".git");
  try {
    await fs.access(gitDir);
  } catch {
    return 0;
  }
  return dirSize(gitDir);
}

async function dirSize(dir: string): Promise<number> {
  let total = 0;
  let dirents;
  try {
    dirents = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const d of dirents) {
    const full = path.join(dir, d.name);
    if (d.isDirectory()) {
      total += await dirSize(full);
    } else if (d.isFile()) {
      try {
        total += (await fs.stat(full)).size;
      } catch {
        /* ignore */
      }
    }
  }
  return total;
}

// ── 修剪 ────────────────────────────────────────────────────────────
interface ChainEntry {
  oid: string;
  commit: Awaited<ReturnType<typeof git.readCommit>>["commit"];
}

export async function pruneHistory(folder: string, maxCommits: number): Promise<PruneResult> {
  if (!(await isInitialized(folder))) throw new Error(`git open failed: ${folder}`);
  const max = Math.max(maxCommits, 1);

  const headOid = await git.resolveRef({ ...repo(folder), ref: "HEAD" });

  // 沿一级父链收集（AutoGit 线性历史）：chain[0]=HEAD（最新）…越后越旧。
  const chain: ChainEntry[] = [];
  let curOid: string | undefined = headOid;
  while (curOid) {
    const { commit } = await git.readCommit({ ...repo(folder), oid: curOid });
    chain.push({ oid: curOid, commit });
    curOid = commit.parent[0];
    if (chain.length > 1_000_000) break; // 安全护栏
  }
  const commitsBefore = chain.length;

  if (commitsBefore <= max) {
    return {
      commitsBefore: commitsBefore,
      commitsAfter: commitsBefore,
      sizeAfter: await repoSize(folder),
      gcRan: false,
    };
  }

  // 第 max 新版本（chain[max-1]）的树 → 无父合成根；其上重建 chain[max-2..0]（共 max-1 个）。
  const baseTree = chain[max - 1].commit.tree;
  const sig = await buildSignature(folder);
  let parentOid = await git.writeCommit({
    ...repo(folder),
    commit: {
      message: "EIDON: history compacted (older versions pruned)",
      tree: baseTree,
      parent: [],
      author: sig,
      committer: sig,
    },
  });

  // 从旧到新重建被保留的较新提交，树/作者/消息与原提交一致。
  for (let i = max - 2; i >= 0; i--) {
    const orig = chain[i].commit;
    parentOid = await git.writeCommit({
      ...repo(folder),
      commit: {
        message: orig.message,
        tree: orig.tree,
        parent: [parentOid],
        author: orig.author,
        committer: orig.committer,
      },
    });
  }

  // 当前分支指向重写后的新 tip（树 == 旧 HEAD 树，工作区/索引保持一致）。
  const refname = await git.currentBranch({ ...repo(folder), fullname: true });
  if (!refname) throw new Error("head has no name (detached?)");
  await git.writeRef({
    ...repo(folder),
    ref: refname,
    value: parentOid,
    force: true,
  });

  const gcRan = await bestEffortGc(folder);
  return {
    commitsBefore: commitsBefore,
    commitsAfter: max,
    sizeAfter: await repoSize(folder),
    gcRan: gcRan,
  };
}

/** 尽力跑系统 git gc：先 expire reflog 让被重写提交不可达，再 gc --prune=now。未装/失败 → false。 */
async function bestEffortGc(folder: string): Promise<boolean> {
  try {
    await execFileP("git", ["-C", folder, "reflog", "expire", "--expire=now", "--all"]);
  } catch {
    return false;
  }
  try {
    await execFileP("git", ["-C", folder, "gc", "--prune=now", "--quiet"]);
    return true;
  } catch {
    return false;
  }
}
