import { mkdir, mkdtemp, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { TemplateLayerSchema, type Level, type TemplateLayer } from "@shared/contracts";
import { createNodeId } from "@shared/utils/id";
import {
  DEFAULT_INBOX_PATH,
  ensureDefaultInboxStructure,
  scanWorkspace,
  type NodeStore,
} from "@backend/domain/nodes";

const normalizeRel = (path: string): string =>
  path.replace(/\\/g, "/").split("/").filter(Boolean).join("/");

const fsStore = (root: string): NodeStore => ({
  async listDir(relPath) {
    const entries = await readdir(relPath ? join(root, normalizeRel(relPath)) : root, { withFileTypes: true });
    return entries.map((entry) => ({ name: entry.name, isDir: entry.isDirectory() }));
  },
  async readFile(relPath) {
    return readFile(join(root, normalizeRel(relPath)), "utf8");
  },
  async writeFile(relPath, contents) {
    const abs = join(root, normalizeRel(relPath));
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, contents, "utf8");
  },
  async createDir(relPath) {
    const normalized = normalizeRel(relPath);
    if (!normalized) return;
    await mkdir(join(root, normalized), { recursive: true });
  },
  async rename(from, to) {
    const target = join(root, normalizeRel(to));
    await mkdir(dirname(target), { recursive: true });
    await rename(join(root, normalizeRel(from)), target);
  },
  async exists(relPath) {
    const normalized = normalizeRel(relPath);
    if (!normalized) return true;
    try {
      await stat(join(root, normalized));
      return true;
    } catch {
      return false;
    }
  },
});

const roots: string[] = [];
const newStore = async (): Promise<{ root: string; store: NodeStore }> => {
  const root = await mkdtemp(join(tmpdir(), "eidon-default-inbox-"));
  roots.push(root);
  return { root, store: fsStore(root) };
};

const makeLayers = (templateId = createNodeId(), version = 1): Record<Level, TemplateLayer> => ({
  1: TemplateLayerSchema.parse({ templateId, level: 1, name: "库", version, schemaVersion: version, fields: [] }),
  2: TemplateLayerSchema.parse({ templateId, level: 2, name: "组", version, schemaVersion: version, fields: [] }),
  3: TemplateLayerSchema.parse({ templateId, level: 3, name: "箱", version, schemaVersion: version, fields: [] }),
});

afterAll(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

describe("ensureDefaultInboxStructure", () => {
  it("creates the default physical inbox as L1/L2/L3 structure nodes", async () => {
    const { store } = await newStore();

    const result = await ensureDefaultInboxStructure(store, { templateLayers: makeLayers() });

    expect(result.inboxPath).toBe(DEFAULT_INBOX_PATH);
    const tree = await scanWorkspace(store);
    expect(tree.nodes.map((node) => [node.path, node.node.level])).toEqual([
      ["_整理箱", 1],
      ["_整理箱/未分类", 2],
      ["_整理箱/未分类/收件箱", 3],
    ]);
  });

  it("promotes existing plain folders without touching their contents", async () => {
    const { store } = await newStore();
    await store.createDir(DEFAULT_INBOX_PATH);
    await store.writeFile(`${DEFAULT_INBOX_PATH}/legacy.md`, "# legacy");

    await ensureDefaultInboxStructure(store, { templateLayers: makeLayers() });

    await expect(store.readFile(`${DEFAULT_INBOX_PATH}/legacy.md`)).resolves.toBe("# legacy");
    const tree = await scanWorkspace(store);
    expect(tree.pathToId.has(DEFAULT_INBOX_PATH)).toBe(true);
  });
});
