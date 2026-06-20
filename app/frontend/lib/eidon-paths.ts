const ORGANIZER_FILE_ALLOWLIST = new Set(["README.md", "AGENTS.md"]);
const EIDON_SYSTEM_PATH_SEGMENTS = new Set([".eidon", ".eidon-sync", ".eidon-encrypted", ".node", ".git"]);

function normalizeRelativePath(path: string): string {
  return path.replace(/\\/g, "/").split("/").filter(Boolean).join("/");
}

export function normalizeWorkspacePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+$/, "");
}

export function relativeToWorkspace(workspace: string, absolutePath: string): string | null {
  const root = normalizeWorkspacePath(workspace);
  const path = absolutePath.replace(/\\/g, "/");
  if (path === root) return "";
  if (!path.startsWith(`${root}/`)) return null;
  return path.slice(root.length + 1).split("/").filter(Boolean).join("/");
}

export function canWriteContentFileInEidonWorkspace(relativePath: string): boolean {
  const parts = normalizeRelativePath(relativePath).split("/").filter(Boolean);
  if (parts.length === 0) return false;
  if (parts.some((part) => EIDON_SYSTEM_PATH_SEGMENTS.has(part))) return true;

  const fileName = parts[parts.length - 1];
  const fileDepth = parts.length;

  if (fileDepth <= 1) return false;
  if (fileDepth === 2 || fileDepth === 3) return ORGANIZER_FILE_ALLOWLIST.has(fileName);
  return true;
}

export function canCreateContentInScannedL3(
  relativeDirPath: string,
  l3NodePaths: Iterable<string>,
): boolean {
  const target = normalizeRelativePath(relativeDirPath);
  if (!target) return false;

  for (const l3Path of l3NodePaths) {
    const normalizedL3 = normalizeRelativePath(l3Path);
    if (!normalizedL3) continue;
    if (target === normalizedL3 || target.startsWith(`${normalizedL3}/`)) return true;
  }
  return false;
}

/**
 * 求某相对路径所属（最近的）L3 节点路径——即最长匹配的 L3 前缀；不在任何 L3 内返回 null。
 * 用于「在当前激活文件/文件夹所在 L3 下新建内容」。
 */
export function findEnclosingL3Path(
  relativePath: string,
  l3NodePaths: Iterable<string>,
): string | null {
  const target = normalizeRelativePath(relativePath);
  if (!target) return null;
  let best: string | null = null;
  for (const l3Path of l3NodePaths) {
    const normalizedL3 = normalizeRelativePath(l3Path);
    if (!normalizedL3) continue;
    if (target === normalizedL3 || target.startsWith(`${normalizedL3}/`)) {
      if (best === null || normalizedL3.length > best.length) best = normalizedL3;
    }
  }
  return best;
}

export function canWriteContentFileInScannedL3(
  relativeFilePath: string,
  l3NodePaths: Iterable<string>,
): boolean {
  const parts = normalizeRelativePath(relativeFilePath).split("/").filter(Boolean);
  if (parts.length === 0) return false;
  if (parts.some((part) => EIDON_SYSTEM_PATH_SEGMENTS.has(part))) return true;

  const fileName = parts[parts.length - 1];
  if (ORGANIZER_FILE_ALLOWLIST.has(fileName) && parts.length <= 3) return true;

  parts.pop();
  return canCreateContentInScannedL3(parts.join("/"), l3NodePaths);
}

export function validateEidonWorkspaceContentPath(
  workspace: string | null | undefined,
  absolutePath: string,
  l3NodePaths?: Iterable<string>,
): { ok: true } | { ok: false; relativePath: string; reason: string } {
  if (!workspace) return { ok: true };
  const relativePath = relativeToWorkspace(workspace, absolutePath);
  if (relativePath === null) return { ok: true };
  const ok = l3NodePaths
    ? canWriteContentFileInScannedL3(relativePath, l3NodePaths)
    : canWriteContentFileInEidonWorkspace(relativePath);
  if (ok) return { ok: true };
  return {
    ok: false,
    relativePath,
    reason: "Content files in an EIDON workspace must live inside an L3 node or a free folder below it.",
  };
}
