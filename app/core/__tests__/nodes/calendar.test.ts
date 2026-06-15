import { mkdir, mkdtemp, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { TemplateLayerSchema, type Level, type TemplateLayer } from "../../contracts";
import { createNodeId } from "../../shared/id";
import {
  CALENDAR_ROOT,
  calendarMonthPath,
  calendarNotePath,
  calendarYearPath,
  ensureCalendarStructure,
  scanWorkspace,
  type NodeStore,
} from "../../nodes";

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
  const root = await mkdtemp(join(tmpdir(), "eidon-calendar-"));
  roots.push(root);
  return { root, store: fsStore(root) };
};

const makeLayers = (templateId = createNodeId(), version = 1): Record<Level, TemplateLayer> => ({
  1: TemplateLayerSchema.parse({ templateId, level: 1, name: "日历库", version, schemaVersion: version, fields: [] }),
  2: TemplateLayerSchema.parse({ templateId, level: 2, name: "年", version, schemaVersion: version, fields: [] }),
  3: TemplateLayerSchema.parse({ templateId, level: 3, name: "月", version, schemaVersion: version, fields: [] }),
});

afterAll(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

describe("calendar path helpers", () => {
  it("builds zero-padded year/month/note paths", () => {
    const d = new Date(2026, 5, 13); // 2026-06-13（月份从 0 起）
    expect(calendarYearPath(d)).toBe("_日历/2026");
    expect(calendarMonthPath(d)).toBe("_日历/2026/2026-06");
    expect(calendarNotePath(d)).toBe("_日历/2026/2026-06/2026-06-13.md");
  });

  it("handles year boundaries and single-digit days", () => {
    const d = new Date(2025, 0, 1); // 2025-01-01
    expect(calendarMonthPath(d)).toBe("_日历/2025/2025-01");
    expect(calendarNotePath(d)).toBe("_日历/2025/2025-01/2025-01-01.md");
  });
});

describe("ensureCalendarStructure", () => {
  it("creates L1 _日历 / L2 year / L3 month as structure nodes", async () => {
    const { store } = await newStore();
    const date = new Date(2026, 5, 13);

    const result = await ensureCalendarStructure(store, { templateLayers: makeLayers(), date });

    expect(result.monthPath).toBe("_日历/2026/2026-06");
    const tree = await scanWorkspace(store);
    expect(tree.nodes.map((node) => [node.path, node.node.level])).toEqual([
      ["_日历", 1],
      ["_日历/2026", 2],
      ["_日历/2026/2026-06", 3],
    ]);
  });

  it("is idempotent and reuses the existing chain across months/years", async () => {
    const { store } = await newStore();
    const layers = makeLayers();

    const june = await ensureCalendarStructure(store, { templateLayers: layers, date: new Date(2026, 5, 13) });
    const juneAgain = await ensureCalendarStructure(store, { templateLayers: layers, date: new Date(2026, 5, 30) });
    const december = await ensureCalendarStructure(store, { templateLayers: layers, date: new Date(2026, 11, 1) });
    const nextYear = await ensureCalendarStructure(store, { templateLayers: layers, date: new Date(2027, 0, 2) });

    // 同月重入：节点身份不变（不重建）
    expect(juneAgain.l3.node.id).toBe(june.l3.node.id);
    // 跨月/跨年共享同一 L1，年内共享同一 L2
    expect(december.l1.node.id).toBe(june.l1.node.id);
    expect(december.l2.node.id).toBe(june.l2.node.id);
    expect(nextYear.l1.node.id).toBe(june.l1.node.id);
    expect(nextYear.l2.node.id).not.toBe(june.l2.node.id);

    const tree = await scanWorkspace(store);
    expect(tree.nodes.map((node) => node.path)).toEqual([
      CALENDAR_ROOT,
      "_日历/2026",
      "_日历/2026/2026-06",
      "_日历/2026/2026-12",
      "_日历/2027",
      "_日历/2027/2027-01",
    ]);
  });

  it("promotes pre-existing plain folders without touching note files", async () => {
    const { store } = await newStore();
    const date = new Date(2026, 5, 13);
    await store.createDir("_日历/2026/2026-06");
    await store.writeFile("_日历/2026/2026-06/2026-06-01.md", "# 旧日记");

    await ensureCalendarStructure(store, { templateLayers: makeLayers(), date });

    await expect(store.readFile("_日历/2026/2026-06/2026-06-01.md")).resolves.toBe("# 旧日记");
    const tree = await scanWorkspace(store);
    expect(tree.pathToId.has("_日历/2026/2026-06")).toBe(true);
  });
});
