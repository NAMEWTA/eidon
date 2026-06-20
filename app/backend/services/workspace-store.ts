/**
 * backend/services/workspace-store —— 把 domain 注入端口实现到能力层（capabilities/editor/file-ops）。
 *
 * domain（nodes/templates/todos/consistency）用 workspace 相对 POSIX 路径；此处转绝对路径后**直调
 * file-ops**（进程内，不经 IPC）。是渲染侧旧 src/ipc/file.ts `createWorkspaceFileStore` 的后端等价物
 * —— 业务逻辑回后端后，前端不再需要注入适配器（见 ADR-0025 / D1）。
 */
import * as fileOps from "../capabilities/editor/file-ops";
import type { DirEntry, NodeStore, TemplateStore } from "@shared/models";

/** 同时满足 NodeStore ∪ TemplateStore（并覆盖 TodoFileStore / ConsistencyReader 子集）。 */
export interface WorkspaceStore extends NodeStore, TemplateStore {}

const normalizeRelPath = (p: string): string =>
  p.replace(/\\/g, "/").split("/").filter(Boolean).join("/");

const splitRelPath = (p: string): string[] =>
  normalizeRelPath(p).split("/").filter(Boolean);

const dirname = (p: string): string => {
  const parts = splitRelPath(p);
  parts.pop();
  return parts.join("/");
};

const basename = (p: string): string => {
  const parts = splitRelPath(p);
  return parts[parts.length - 1] ?? "";
};

const joinWorkspacePath = (workspace: string, relPath: string): string => {
  const normalized = normalizeRelPath(relPath);
  if (!normalized) return workspace;
  const sep = workspace.includes("\\") && !workspace.includes("/") ? "\\" : "/";
  return `${workspace.replace(/[\\/]+$/, "")}${sep}${normalized.replace(/\//g, sep)}`;
};

/** 构造某 workspace 的注入 store。刻意保留 `.eidon`/`.node` 系统路径可访问（includeHidden:true）。 */
export const createWorkspaceStore = (workspace: string): WorkspaceStore => {
  const abs = (relPath: string): string => joinWorkspacePath(workspace, relPath);

  const listDir = async (relPath: string): Promise<DirEntry[]> => {
    try {
      const entries = await fileOps.listDir(abs(relPath), true);
      return entries
        .filter((entry) => entry.name !== "__eidon_truncated__")
        .map((entry) => ({ name: entry.name, isDir: entry.isDir }));
    } catch {
      return [];
    }
  };

  const readFile = async (relPath: string): Promise<string> => {
    const result = await fileOps.readFile(abs(relPath));
    return result.content;
  };

  const exists = async (relPath: string): Promise<boolean> => {
    const normalized = normalizeRelPath(relPath);
    if (!normalized) return true;
    try {
      await fileOps.listDir(abs(normalized), true);
      return true;
    } catch {
      // not a readable directory; try file next
    }
    try {
      await fileOps.readFile(abs(normalized));
      return true;
    } catch {
      // not a readable text file; fall back to parent listing
    }
    const siblings = await listDir(dirname(normalized));
    return siblings.some((entry) => entry.name === basename(normalized));
  };

  const createDir = async (relPath: string): Promise<void> => {
    const normalized = normalizeRelPath(relPath);
    if (!normalized || (await exists(normalized))) return;
    await fileOps.createDir(abs(normalized));
  };

  const writeFile = async (relPath: string, contents: string): Promise<void> => {
    const parent = dirname(relPath);
    if (parent) await createDir(parent);
    await fileOps.writeFile(abs(relPath), contents, "UTF-8");
  };

  const rename = async (from: string, to: string): Promise<void> => {
    const parent = dirname(to);
    if (parent) await createDir(parent);
    await fileOps.rename(abs(from), abs(to));
  };

  const remove = async (relPath: string): Promise<void> => {
    await fileOps.deletePath(abs(relPath));
  };

  return { listDir, readFile, writeFile, createDir, rename, remove, exists };
};
