/**
 * git 基础操作。
 *
 * status / init / autoCommit / dirty / 分支增删切换。全部经 isomorphic-git，纯 JS 不依赖系统 git。
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import type { WorkspaceStatus } from "@shared/models";
import {
  git,
  repo,
  isInitialized,
  buildSignature,
  relPath,
  stage,
  commitStaged,
  defaultAutoMessage,
} from "./git-client";

// ── status ──────────────────────────────────────────────────────────
export async function workspaceStatus(folder: string): Promise<WorkspaceStatus> {
  const empty: WorkspaceStatus = {
    initialized: false,
    headSha: null,
    headMessage: null,
    dirty: false,
    branch: null,
  };
  if (!folder || !(await isInitialized(folder))) return empty;

  let headSha: string | null = null;
  let headMessage: string | null = null;
  try {
    const oid = await git.resolveRef({ ...repo(folder), ref: "HEAD" });
    const { commit } = await git.readCommit({ ...repo(folder), oid });
    headSha = oid;
    headMessage = firstLine(commit.message);
  } catch {
    /* 未出生 HEAD */
  }
  let branch: string | null = null;
  try {
    branch = (await git.currentBranch({ ...repo(folder), fullname: false })) ?? null;
  } catch {
    /* detached / none */
  }
  return {
    initialized: true,
    headSha: headSha,
    headMessage: headMessage,
    dirty: await workspaceIsDirty(folder),
    branch,
  };
}

/** status.dirty：仅看 .md/.markdown/.txt（避开庞大 _assets/），对齐 workspace_is_dirty。 */
async function workspaceIsDirty(dir: string): Promise<boolean> {
  let matrix: Awaited<ReturnType<typeof git.statusMatrix>>;
  try {
    matrix = await git.statusMatrix(repo(dir));
  } catch {
    return false;
  }
  for (const [filepath, head, workdir, stageS] of matrix) {
    const lower = filepath.toLowerCase();
    if (!(lower.endsWith(".md") || lower.endsWith(".markdown") || lower.endsWith(".txt"))) continue;
    if (!(head === 1 && workdir === 1 && stageS === 1)) return true;
  }
  return false;
}

// ── init ────────────────────────────────────────────────────────────
export async function initWorkspace(
  folder: string,
  initialMessage: string | null,
  excludeAssets: boolean,
): Promise<void> {
  const st = await statSafe(folder);
  if (!st) {
    await fs.mkdir(folder, { recursive: true });
  } else if (!st.isDirectory()) {
    throw new Error(`not a folder: ${folder}`);
  }
  if (!(await isInitialized(folder))) {
    await git.init({ ...repo(folder), defaultBranch: "main" });
  }
  await writeDefaultGitignore(folder, excludeAssets);
  await stage(folder, null);
  const sig = await buildSignature(folder);
  await commitStaged(folder, sig, initialMessage ?? "init: EIDON workspace");
}

async function writeDefaultGitignore(folder: string, excludeAssets: boolean): Promise<void> {
  const gi = path.join(folder, ".gitignore");
  if (await statSafe(gi)) return;
  let body =
    "# EIDON AutoGit defaults\n" +
    ".DS_Store\n" +
    "Thumbs.db\n" +
    "desktop.ini\n" +
    "node_modules/\n" +
    ".obsidian/workspace*\n" +
    ".obsidian/cache\n" +
    ".vscode/\n" +
    "*.tmp\n" +
    "*~\n";
  if (excludeAssets) body += "_assets/\n";
  await fs.writeFile(gi, body);
}

// ── autoCommit ──────────────────────────────────────────────────────
export async function autoCommit(
  folder: string,
  filePath: string | null,
  message: string | null,
): Promise<string | null> {
  if (!(await isInitialized(folder))) throw new Error(`git open failed: ${folder}`);
  let pathspec: string | null = null;
  if (filePath) {
    const rel = relPath(folder, filePath);
    if (rel === null) throw new Error(`file is outside workspace: ${filePath}`);
    pathspec = rel;
  }
  await stage(folder, pathspec);
  const sig = await buildSignature(folder);
  return commitStaged(folder, sig, message ?? defaultAutoMessage());
}

// ── 分支 ────────────────────────────────────────────────────────────
export async function hasDirtyChanges(workspace: string): Promise<boolean> {
  let matrix: Awaited<ReturnType<typeof git.statusMatrix>>;
  try {
    matrix = await git.statusMatrix(repo(workspace));
  } catch {
    return false;
  }
  return matrix.some(([, head, workdir, stageS]) => !(head === 1 && workdir === 1 && stageS === 1));
}

export async function createBranch(workspace: string, branch: string): Promise<void> {
  await git.branch({ ...repo(workspace), ref: branch, checkout: false });
}

export async function checkout(workspace: string, branch: string): Promise<string> {
  let prev = "main";
  try {
    prev = (await git.currentBranch({ ...repo(workspace), fullname: false })) ?? "main";
  } catch {
    /* default main */
  }
  await git.checkout({ ...repo(workspace), ref: branch });
  return prev;
}

export async function restoreHead(workspace: string, branch: string): Promise<void> {
  await git.checkout({ ...repo(workspace), ref: branch });
}

export async function deleteBranch(workspace: string, branch: string): Promise<void> {
  await git.deleteBranch({ ...repo(workspace), ref: branch });
}

// ── 工具 ────────────────────────────────────────────────────────────
function firstLine(msg: string): string {
  return msg.split("\n")[0] ?? "";
}

async function statSafe(p: string): Promise<import("node:fs").Stats | null> {
  try {
    return await fs.stat(p);
  } catch {
    return null;
  }
}
