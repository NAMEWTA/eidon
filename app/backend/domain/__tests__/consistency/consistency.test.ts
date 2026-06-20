import { mkdir, mkdtemp, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { createNodeId } from "@shared/utils/id";
import { TemplateLayerSchema, type Level, type TemplateLayer } from "@shared/contracts";
import {
  detectStructureViolations,
  normalizeWorkspaceStructure,
  type ConsistencyReader,
  type StructureViolationKind,
} from "@backend/domain/consistency";
import type { NodeStore } from "@backend/domain/nodes";

const fsReader = (root: string): ConsistencyReader => ({
  async listDir(relPath) {
    const abs = relPath ? join(root, relPath) : root;
    const entries = await readdir(abs, { withFileTypes: true });
    return entries.map((entry) => ({ name: entry.name, isDir: entry.isDirectory() }));
  },
  async readFile(relPath) {
    return readFile(join(root, relPath), "utf8");
  },
});

const fsStore = (root: string): NodeStore => ({
  async listDir(relPath) {
    const abs = relPath ? join(root, relPath) : root;
    const entries = await readdir(abs, { withFileTypes: true });
    return entries.map((entry) => ({ name: entry.name, isDir: entry.isDirectory() }));
  },
  async readFile(relPath) {
    return readFile(join(root, relPath), "utf8");
  },
  async writeFile(relPath, contents) {
    await writeText(root, relPath, contents);
  },
  async createDir(relPath) {
    await mkdir(join(root, relPath), { recursive: true });
  },
  async rename(from, to) {
    await mkdir(dirname(join(root, to)), { recursive: true });
    await rename(join(root, from), join(root, to));
  },
  async exists(relPath) {
    try {
      await stat(join(root, relPath));
      return true;
    } catch {
      return false;
    }
  },
});

const writeText = async (root: string, relPath: string, content: string): Promise<void> => {
  const abs = join(root, relPath);
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, content, "utf8");
};

const writeNode = async (
  root: string,
  dirPath: string,
  level: 1 | 2 | 3,
  extra: Record<string, unknown> = {},
): Promise<void> => {
  await writeText(root, `${dirPath}/.node/node.json`, JSON.stringify({
    id: createNodeId(),
    templateId: "01BX5ZZKBKACTAV9WEVGEMMVRZ",
    level,
    type: `L${level}`,
    schemaVersion: 1,
    createdAt: "2026-06-07T00:00:00.000Z",
    fields: {},
    references: [],
    flags: {},
    ...extra,
  }, null, 2));
};

const snapshotFiles = async (root: string): Promise<Record<string, string>> => {
  const out: Record<string, string> = {};
  const walk = async (relPath: string): Promise<void> => {
    const entries = await readdir(relPath ? join(root, relPath) : root, { withFileTypes: true });
    for (const entry of entries) {
      const child = relPath ? `${relPath}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(child);
      } else {
        out[child] = await readFile(join(root, child), "utf8");
      }
    }
  };
  await walk("");
  return out;
};

const roots: string[] = [];

const makeTemplateLayers = (templateId = createNodeId()): Record<Level, TemplateLayer> => ({
  1: TemplateLayerSchema.parse({
    templateId,
    level: 1,
    name: "整理箱",
    version: 1,
    schemaVersion: 1,
    fields: [],
  }),
  2: TemplateLayerSchema.parse({
    templateId,
    level: 2,
    name: "分类",
    version: 1,
    schemaVersion: 1,
    fields: [],
  }),
  3: TemplateLayerSchema.parse({
    templateId,
    level: 3,
    name: "收件",
    version: 1,
    schemaVersion: 1,
    fields: [],
  }),
});

afterAll(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

describe("detectStructureViolations", () => {
  it("detects structure violation kinds and remains read-only", async () => {
    const root = await mkdtemp(join(tmpdir(), "eidon-consistency-"));
    roots.push(root);

    await writeNode(root, "Research", 1);
    await writeText(root, "loose.md", "# loose at root");
    await writeText(root, "Research/README.md", "# Research");
    await writeText(root, "Research/illegal.md", "# illegal at L1");

    await mkdir(join(root, "PlainL1"), { recursive: true });
    await mkdir(join(root, "Research/PlainL2"), { recursive: true });
    await writeText(root, "Research/PlainL2/raw.md", "# illegal at L2");

    await writeNode(root, "Research/WrongLevel", 3);
    await writeText(root, "Broken/.node/node.json", "{not json");

    await writeNode(root, "Research/Topic", 2);
    await writeNode(root, "Research/Topic/Entry", 3);
    await writeText(root, "Research/Topic/Entry/content.md", "# allowed at L3");
    await mkdir(join(root, "Research/Topic/Entry/FreeFolder"), { recursive: true });
    await writeText(root, "Research/Topic/Entry/FreeFolder/deep.md", "# ignored at depth 4");
    await mkdir(join(root, ".eidon/templates"), { recursive: true });

    const before = await snapshotFiles(root);
    const report = await detectStructureViolations(fsReader(root));
    const after = await snapshotFiles(root);

    expect(after).toEqual(before);

    const byPath = new Map(report.violations.map((violation) => [violation.path, violation]));
    expect(byPath.get("loose.md")?.kind).toBe("content-file-at-root");
    expect(byPath.get("PlainL1")?.kind).toBe("plain-folder-in-node-zone");
    expect(byPath.get("Research/PlainL2")?.kind).toBe("plain-folder-in-node-zone");
    expect(byPath.get("Research/illegal.md")?.kind).toBe("content-file-in-organizer");
    expect(byPath.get("Research/PlainL2/raw.md")?.kind).toBe("content-file-in-organizer");
    expect(byPath.get("Research/WrongLevel")?.kind).toBe("level-mismatch");
    expect(byPath.get("Broken")?.kind).toBe("node-metadata-invalid");

    const kinds = new Set(report.violations.map((violation) => violation.kind));
    expect(kinds).toEqual(new Set<StructureViolationKind>([
      "content-file-at-root",
      "plain-folder-in-node-zone",
      "content-file-in-organizer",
      "level-mismatch",
      "node-metadata-invalid",
    ]));

    expect(report.violations.some((violation) => violation.path.includes("FreeFolder"))).toBe(false);
    expect(report.byPath.get("Research/illegal.md")?.[0].kind).toBe("content-file-in-organizer");
  });
});

describe("normalizeWorkspaceStructure", () => {
  it("promotes a legacy first-three-depth folder hierarchy in place during workspace migration", async () => {
    const root = await mkdtemp(join(tmpdir(), "eidon-promote-workspace-"));
    roots.push(root);
    const store = fsStore(root);
    const layers = makeTemplateLayers();

    await mkdir(join(root, "Legacy/Topic/Entry"), { recursive: true });
    await writeText(root, "Legacy/Topic/Entry/note.md", "# legacy note");

    const result = await normalizeWorkspaceStructure(store, {
      templateLayers: layers,
      now: "2026-06-08T00:00:00.000Z",
    });

    expect(result.createdNodes).toEqual([
      "_整理箱",
      "_整理箱/未分类",
      "_整理箱/未分类/收件箱",
      "Legacy",
      "Legacy/Topic",
      "Legacy/Topic/Entry",
    ]);
    expect(result.moved).toEqual([]);
    expect(await readFile(join(root, "Legacy/.node/node.json"), "utf8")).toContain('"level": 1');
    expect(await readFile(join(root, "Legacy/Topic/.node/node.json"), "utf8")).toContain('"level": 2');
    expect(await readFile(join(root, "Legacy/Topic/Entry/.node/node.json"), "utf8")).toContain('"level": 3');
    expect(await readFile(join(root, "Legacy/Topic/Entry/note.md"), "utf8")).toBe("# legacy note");

    const after = await detectStructureViolations(store);
    expect(after.violations.some((violation) => violation.kind === "plain-folder-in-node-zone")).toBe(false);
  });

  it("creates fallback nodes, promotes plain node-zone folders, and moves loose content without overwriting", async () => {
    const root = await mkdtemp(join(tmpdir(), "eidon-normalize-"));
    roots.push(root);
    const store = fsStore(root);
    const layers = makeTemplateLayers();

    await writeText(root, "loose.md", "# root");
    await writeText(root, "Research/illegal.md", "# L1");
    await mkdir(join(root, "Research/PlainL2"), { recursive: true });
    await writeText(root, "Research/PlainL2/raw.md", "# raw");
    await mkdir(join(root, "PlainL1"), { recursive: true });
    await writeText(root, "PlainL1/note.md", "# note");
    await writeText(root, "_整理箱/未分类/收件箱/loose.md", "# existing");
    await writeNode(root, "Research", 1, { templateId: layers[1].templateId });

    const result = await normalizeWorkspaceStructure(store, {
      templateLayers: layers,
      now: "2026-06-07T00:00:00.000Z",
    });

    expect(result.fallbackL3Path).toBe("_整理箱/未分类/收件箱");
    expect(result.createdNodes).toEqual([
      "_整理箱",
      "_整理箱/未分类",
      "_整理箱/未分类/收件箱",
      "PlainL1",
      "Research/PlainL2",
    ]);
    expect(await readFile(join(root, "_整理箱/.node/node.json"), "utf8")).toContain('"level": 1');
    expect(await readFile(join(root, "_整理箱/未分类/.node/node.json"), "utf8")).toContain('"level": 2');
    expect(await readFile(join(root, "_整理箱/未分类/收件箱/.node/node.json"), "utf8")).toContain('"level": 3');

    expect(await readFile(join(root, "_整理箱/未分类/收件箱/loose.md"), "utf8")).toBe("# existing");
    expect(await readFile(join(root, "_整理箱/未分类/收件箱/loose 2.md"), "utf8")).toBe("# root");
    expect(await readFile(join(root, "_整理箱/未分类/收件箱/illegal.md"), "utf8")).toBe("# L1");
    expect(await readFile(join(root, "_整理箱/未分类/收件箱/note.md"), "utf8")).toBe("# note");
    expect(await readFile(join(root, "_整理箱/未分类/收件箱/raw.md"), "utf8")).toBe("# raw");
    expect(await readFile(join(root, "PlainL1/.node/node.json"), "utf8")).toContain('"level": 1');
    expect(await readFile(join(root, "Research/PlainL2/.node/node.json"), "utf8")).toContain('"level": 2');

    expect(result.skipped).toEqual([]);
    const after = await detectStructureViolations(store);
    expect(after.violations.some((violation) => (
      violation.kind === "content-file-at-root" ||
      violation.kind === "content-file-in-organizer" ||
      violation.kind === "plain-folder-in-node-zone"
    ))).toBe(false);
  });
});
