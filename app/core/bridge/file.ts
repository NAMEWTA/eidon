import { invoke } from "@tauri-apps/api/core";

interface FileReadResult {
  content: string;
  encoding: string;
  language: string;
  had_bom: boolean;
}

interface FsDirEntry {
  name: string;
  path: string;
  is_dir: boolean;
}

interface WorkspaceStoreDirEntry {
  name: string;
  isDir: boolean;
}

export interface WorkspaceFileStore {
  listDir(relPath: string): Promise<WorkspaceStoreDirEntry[]>;
  readFile(relPath: string): Promise<string>;
  writeFile(relPath: string, contents: string): Promise<void>;
  createDir(relPath: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  remove(relPath: string): Promise<void>;
  exists(relPath: string): Promise<boolean>;
}

const normalizeRelPath = (path: string): string =>
  path
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .join("/");

const splitRelPath = (path: string): string[] =>
  normalizeRelPath(path).split("/").filter(Boolean);

const dirname = (path: string): string => {
  const parts = splitRelPath(path);
  parts.pop();
  return parts.join("/");
};

const basename = (path: string): string => {
  const parts = splitRelPath(path);
  return parts[parts.length - 1] ?? "";
};

const joinRelPath = (base: string, name: string): string =>
  normalizeRelPath(base) ? `${normalizeRelPath(base)}/${name}` : name;

const joinWorkspacePath = (workspace: string, relPath: string): string => {
  const normalized = normalizeRelPath(relPath);
  if (!normalized) return workspace;
  const sep = workspace.includes("\\") && !workspace.includes("/") ? "\\" : "/";
  return `${workspace.replace(/[\\/]+$/, "")}${sep}${normalized.replace(/\//g, sep)}`;
};

/**
 * Workspace-relative file store for EIDON data-layer modules.
 * It deliberately keeps system paths (`.eidon`, `.node`) accessible while the
 * existing FileTree command can continue hiding dot entries from navigation.
 */
export const createWorkspaceFileStore = (
  workspace: string,
): WorkspaceFileStore => {
  const abs = (relPath: string): string => joinWorkspacePath(workspace, relPath);

  const listDir = async (relPath: string) => {
    try {
      const entries = await invoke<FsDirEntry[]>("list_dir", {
        path: abs(relPath),
        includeHidden: true,
      });
      return entries
        .filter((entry) => entry.name !== "__eidon_truncated__")
        .map((entry) => ({ name: entry.name, isDir: entry.is_dir }));
    } catch {
      return [];
    }
  };

  const readFile = async (relPath: string): Promise<string> => {
    const result = await invoke<FileReadResult>("read_file", { path: abs(relPath) });
    return result.content;
  };

  const exists = async (relPath: string): Promise<boolean> => {
    const normalized = normalizeRelPath(relPath);
    if (!normalized) return true;

    try {
      await invoke<FsDirEntry[]>("list_dir", {
        path: abs(normalized),
        includeHidden: true,
      });
      return true;
    } catch {
      // not a readable directory; try file next
    }
    try {
      await readFile(normalized);
      return true;
    } catch {
      // not a readable text file; fall back to parent listing for visible entries
    }

    const parent = dirname(normalized);
    const name = basename(normalized);
    const siblings = await listDir(parent);
    return siblings.some((entry) => entry.name === name);
  };

  const createDir = async (relPath: string): Promise<void> => {
    const normalized = normalizeRelPath(relPath);
    if (!normalized || (await exists(normalized))) return;
    await invoke("fs_create_dir", { path: abs(normalized) });
  };

  const writeFile = async (relPath: string, contents: string): Promise<void> => {
    const parent = dirname(relPath);
    if (parent) await createDir(parent);
    await invoke("write_file", {
      path: abs(relPath),
      content: contents,
      encoding: "UTF-8",
    });
  };

  return {
    listDir,
    readFile,
    writeFile,
    createDir,
    async rename(from, to) {
      const parent = dirname(to);
      if (parent) await createDir(parent);
      await invoke("fs_rename", { from: abs(from), to: abs(to) });
    },
    async remove(relPath) {
      await invoke("fs_delete", { path: abs(relPath) });
    },
    exists,
  };
};

export const absoluteWorkspacePath = joinWorkspacePath;
export const relativeWorkspacePath = (workspace: string, absolutePath: string): string => {
  const workspaceParts = workspace.replace(/\\/g, "/").replace(/\/+$/, "");
  const absoluteParts = absolutePath.replace(/\\/g, "/");
  if (absoluteParts === workspaceParts) return "";
  if (!absoluteParts.startsWith(`${workspaceParts}/`)) return normalizeRelPath(absolutePath);
  return absoluteParts.slice(workspaceParts.length + 1);
};

export const childWorkspacePath = joinRelPath;
