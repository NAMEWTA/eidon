import { NodeSchema, type Level, type TemplateLayer } from "@shared/contracts";
import type {
  ConsistencyReader,
  ConsistencyReport,
  DirEntry,
  NodeStore,
  NormalizationOptions,
  NormalizationResult,
  StructureViolation,
} from "@shared/models";
import { createNode, promoteFolderToNode } from "./nodes";

const MAX_NODE_DEPTH = 3;
const ORGANIZER_DEPTHS = new Set([1, 2]);
const ORGANIZER_FILE_ALLOWLIST = new Set(["README.md", "AGENTS.md"]);
const ROOT_FILE_ALLOWLIST = new Set(["README.md", "AGENTS.md"]);

const joinPath = (base: string, name: string): string =>
  base ? `${base}/${name}` : name;

const normalizePath = (path: string): string =>
  path.replace(/\\/g, "/").split("/").filter(Boolean).join("/");

const splitPath = (path: string): string[] =>
  normalizePath(path).split("/").filter(Boolean);

const basenameOf = (path: string): string => {
  const parts = splitPath(path);
  return parts[parts.length - 1] ?? "";
};

const nodeJsonPath = (dirPath: string): string => joinPath(dirPath, ".node/node.json");

const toLevel = (depth: number): Level | null =>
  depth === 1 || depth === 2 || depth === 3 ? depth : null;

const isHiddenSystemDir = (name: string): boolean => name.startsWith(".");

const isHiddenSystemFile = (name: string): boolean => name.startsWith(".");

const isAncestorPath = (ancestor: string, path: string): boolean => {
  const a = normalizePath(ancestor);
  const p = normalizePath(path);
  return !!a && p.startsWith(`${a}/`);
};

const readNodeState = async (
  reader: ConsistencyReader,
  dirPath: string,
  entries: DirEntry[],
): Promise<{ state: "valid"; level: Level } | { state: "invalid" } | { state: "missing" }> => {
  const nodeDir = entries.find((entry) => entry.name === ".node" && entry.isDir);
  if (!nodeDir) return { state: "missing" };

  try {
    const raw = await reader.readFile(nodeJsonPath(dirPath));
    const parsed = NodeSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return { state: "invalid" };
    return { state: "valid", level: parsed.data.level };
  } catch {
    return { state: "invalid" };
  }
};

const pushViolation = (
  violations: StructureViolation[],
  violation: StructureViolation,
): void => {
  violations.push(violation);
};

/**
 * 只读检测三层【节点】结构违规（见 ADR-0016）。
 * 不写 `.node/node.json`，不移动文件，也不补全系统文件；整改由 UI 中用户点击触发。
 */
export const detectStructureViolations = async (
  reader: ConsistencyReader,
): Promise<ConsistencyReport> => {
  const violations: StructureViolation[] = [];

  const walk = async (dirPath: string, depth: number): Promise<void> => {
    const entries = await reader.listDir(dirPath);

    if (depth === 0) {
      for (const entry of entries) {
        if (entry.isDir || isHiddenSystemFile(entry.name) || ROOT_FILE_ALLOWLIST.has(entry.name)) continue;
        pushViolation(violations, {
          kind: "content-file-at-root",
          path: joinPath(dirPath, entry.name),
          depth,
          message: "Workspace root contains a content file",
        });
      }
    }

    if (ORGANIZER_DEPTHS.has(depth)) {
      for (const entry of entries) {
        if (entry.isDir || isHiddenSystemFile(entry.name) || ORGANIZER_FILE_ALLOWLIST.has(entry.name)) continue;
        pushViolation(violations, {
          kind: "content-file-in-organizer",
          path: joinPath(dirPath, entry.name),
          depth,
          message: `L${depth} organizer contains a content file`,
        });
      }
    }

    if (depth >= MAX_NODE_DEPTH) return;

    const childDirs = entries
      .filter((entry) => entry.isDir && !isHiddenSystemDir(entry.name))
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const dir of childDirs) {
      const childPath = joinPath(dirPath, dir.name);
      const childDepth = depth + 1;
      const childLevel = toLevel(childDepth);
      if (!childLevel) continue;

      const childEntries = await reader.listDir(childPath);
      const nodeState = await readNodeState(reader, childPath, childEntries);

      if (nodeState.state === "missing") {
        pushViolation(violations, {
          kind: "plain-folder-in-node-zone",
          path: childPath,
          depth: childDepth,
          message: `Plain folder appears in L${childDepth} node zone`,
        });
      } else if (nodeState.state === "invalid") {
        pushViolation(violations, {
          kind: "node-metadata-invalid",
          path: childPath,
          depth: childDepth,
          message: `.node/node.json is missing or invalid`,
        });
      } else if (nodeState.level !== childDepth) {
        pushViolation(violations, {
          kind: "level-mismatch",
          path: childPath,
          depth: childDepth,
          message: `node.json declares L${nodeState.level} at physical depth L${childDepth}`,
        });
      }

      await walk(childPath, childDepth);
    }
  };

  await walk("", 0);

  const byPath = new Map<string, StructureViolation[]>();
  for (const violation of violations) {
    byPath.set(violation.path, [...(byPath.get(violation.path) ?? []), violation]);
  }

  return { violations, byPath };
};

const uniqueTargetPath = async (
  store: NodeStore,
  targetDir: string,
  name: string,
  reserved: Set<string>,
): Promise<string> => {
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  let candidate = joinPath(targetDir, name);
  let i = 2;
  while (reserved.has(candidate) || await store.exists(candidate)) {
    candidate = joinPath(targetDir, `${stem} ${i}${ext}`);
    i += 1;
  }
  reserved.add(candidate);
  return candidate;
};

const ensureFallbackNode = async (
  store: NodeStore,
  path: string,
  parentPath: string,
  name: string,
  templateLayer: TemplateLayer,
  now: string | Date | undefined,
  createdNodes: string[],
): Promise<void> => {
  let entries: DirEntry[] = [];
  try {
    entries = await store.listDir(path);
  } catch {
    entries = [];
  }
  const nodeState = await readNodeState(store, path, entries);
  if (nodeState.state === "valid" && nodeState.level === templateLayer.level) return;

  if (await store.exists(path)) {
    await promoteFolderToNode(store, {
      path,
      templateLayer,
      now,
    });
  } else {
    await createNode(store, {
      parentPath,
      name,
      templateLayer,
      now,
    });
  }
  createdNodes.push(path);
};

/**
 * 用户显式点击触发的一键 workspace 迁移。
 * 自动动作只做最小结构收敛：创建兜底 L1/L2/L3，原地提升前三层普通文件夹，
 * 并把根/L1/L2 中仍不合法的内容文件移动到兜底 L3 下。
 */
export const normalizeWorkspaceStructure = async (
  store: NodeStore,
  options: NormalizationOptions,
): Promise<NormalizationResult> => {
  const fallbackNames = {
    l1: options.fallbackNames?.l1 ?? "_整理箱",
    l2: options.fallbackNames?.l2 ?? "未分类",
    l3: options.fallbackNames?.l3 ?? "收件箱",
  };
  const fallbackL1Path = fallbackNames.l1;
  const fallbackL2Path = joinPath(fallbackL1Path, fallbackNames.l2);
  const fallbackL3Path = joinPath(fallbackL2Path, fallbackNames.l3);
  const createdNodes: string[] = [];
  const moved: Array<{ from: string; to: string }> = [];
  const skipped: Array<{ path: string; reason: string }> = [];

  await ensureFallbackNode(store, fallbackL1Path, "", fallbackNames.l1, options.templateLayers[1], options.now, createdNodes);
  await ensureFallbackNode(store, fallbackL2Path, fallbackL1Path, fallbackNames.l2, options.templateLayers[2], options.now, createdNodes);
  await ensureFallbackNode(store, fallbackL3Path, fallbackL2Path, fallbackNames.l3, options.templateLayers[3], options.now, createdNodes);

  const report = await detectStructureViolations(store);
  const plainDirs = report.violations
    .filter((violation) => violation.kind === "plain-folder-in-node-zone")
    .filter((violation) => violation.path !== fallbackL1Path && violation.path !== fallbackL2Path && violation.path !== fallbackL3Path)
    .sort((a, b) => a.depth - b.depth || a.path.localeCompare(b.path));

  for (const violation of plainDirs) {
    const level = toLevel(violation.depth);
    if (!level) continue;
    try {
      await promoteFolderToNode(store, {
        path: violation.path,
        templateLayer: options.templateLayers[level],
        now: options.now,
      });
      createdNodes.push(violation.path);
    } catch (error) {
      skipped.push({ path: violation.path, reason: String(error) });
    }
  }

  const afterPromote = await detectStructureViolations(store);
  const reserved = new Set<string>();
  const fileViolations = afterPromote.violations
    .filter((violation) => (
      violation.kind === "content-file-at-root" ||
      violation.kind === "content-file-in-organizer"
    ))
    .map((violation) => violation.path)
    .filter((path) => !isAncestorPath(fallbackL3Path, path))
    .sort((a, b) => a.localeCompare(b));

  for (const file of fileViolations) {
    try {
      const target = await uniqueTargetPath(store, fallbackL3Path, basenameOf(file), reserved);
      await store.rename(file, target);
      moved.push({ from: file, to: target });
    } catch (error) {
      skipped.push({ path: file, reason: String(error) });
    }
  }

  const finalReport = await detectStructureViolations(store);
  for (const violation of finalReport.violations) {
    if (
      violation.kind === "plain-folder-in-node-zone" ||
      violation.kind === "level-mismatch" ||
      violation.kind === "node-metadata-invalid"
    ) {
      if (violation.path !== fallbackL1Path && violation.path !== fallbackL2Path && violation.path !== fallbackL3Path) {
        skipped.push({ path: violation.path, reason: violation.message });
      }
    }
  }

  return { fallbackL3Path, createdNodes, moved, skipped };
};

// 便捷再导出：一致性域类型事实源在 @shared/models。
export type {
  ConsistencyReader,
  ConsistencyReport,
  StructureViolation,
  StructureViolationKind,
  NormalizationOptions,
  NormalizationResult,
} from "@shared/models";
