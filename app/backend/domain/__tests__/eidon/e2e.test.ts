import {
  cp,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { EIDON_TEMPLATES_DIR, type Level } from "@shared/contracts";
import { createNode, scanWorkspace, type NodeStore } from "@backend/domain/nodes";
import {
  createTemplate,
  getTemplate,
  type TemplateInput,
  type TemplateStore,
} from "@backend/domain/templates";

type EidonTestStore = NodeStore & TemplateStore;

const normalizeRel = (path: string): string =>
  path.replace(/\\/g, "/").split("/").filter(Boolean).join("/");

const fsStore = (root: string): EidonTestStore => ({
  async listDir(relPath) {
    try {
      const abs = relPath ? join(root, normalizeRel(relPath)) : root;
      const entries = await readdir(abs, { withFileTypes: true });
      return entries.map((entry) => ({ name: entry.name, isDir: entry.isDirectory() }));
    } catch {
      return [];
    }
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
  async remove(relPath) {
    await rm(join(root, normalizeRel(relPath)), { recursive: true, force: true });
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

const makeWorkspace = async (label: string): Promise<{ root: string; store: EidonTestStore }> => {
  const root = await mkdtemp(join(tmpdir(), `eidon-e2e-${label}-`));
  roots.push(root);
  return { root, store: fsStore(root) };
};

const templateInput: TemplateInput = {
  layers: {
    1: {
      name: "研究域",
      fields: [{ key: "area", label: "领域", type: "text", required: true }],
    },
    2: {
      name: "课题",
      fields: [{ key: "status", label: "状态", type: "select", options: ["draft", "done"] }],
    },
    3: {
      name: "记录",
      fields: [
        { key: "title", label: "标题", type: "text", required: true },
        { key: "body", label: "正文", type: "textarea" },
        { key: "pages", label: "页数", type: "number" },
        { key: "reviewedAt", label: "复核日期", type: "date" },
        { key: "status", label: "状态", type: "select", options: ["draft", "done"] },
        { key: "archived", label: "归档", type: "boolean" },
      ],
    },
  },
};

afterAll(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

describe("EIDON node/template end-to-end rebuildability", () => {
  it("rebuilds templates, node identity, fields, and L3 content after cache deletion and workspace copy", async () => {
    const { root, store } = await makeWorkspace("source");
    const template = await createTemplate(store, templateInput);

    const l1 = await createNode(store, {
      parentPath: "",
      name: "研究",
      templateLayer: template.layers[1],
      fields: { area: "信息检索" },
      now: "2026-06-07T00:00:00.000Z",
    });
    await createNode(store, {
      parentPath: "研究",
      name: "向量检索",
      templateLayer: template.layers[2],
      fields: { status: "draft" },
      now: "2026-06-07T00:00:00.000Z",
    });
    const l3 = await createNode(store, {
      parentPath: "研究/向量检索",
      name: "实验记录",
      templateLayer: template.layers[3],
      fields: {
        title: "调研记录",
        body: "检索方案",
        pages: 12,
        reviewedAt: "2026-06-07",
        status: "done",
        archived: false,
      },
      now: "2026-06-07T00:00:00.000Z",
    });
    await store.writeFile("研究/向量检索/实验记录/note.md", "# 调研记录\n\nL3 content.");
    await store.writeFile(".eidon/index-cache.json", "{\"stale\":true}");

    await store.remove(".eidon/index-cache.json");
    const rebuilt = await scanWorkspace(store);
    expect(rebuilt.idToPath.get(l1.node.id)).toBe("研究");
    expect(rebuilt.idToPath.get(l3.node.id)).toBe("研究/向量检索/实验记录");
    expect(rebuilt.nodes.find((node) => node.node.id === l3.node.id)?.node.fields).toEqual(l3.node.fields);
    await expect(getTemplate(store, template.templateId, template.version)).resolves.toMatchObject({
      templateId: template.templateId,
      version: 1,
    });
    await expect(store.readFile("研究/向量检索/实验记录/note.md")).resolves.toContain("L3 content");

    const { root: copiedRoot, store: copiedStore } = await makeWorkspace("copy");
    await cp(root, copiedRoot, { recursive: true, force: true });
    const copied = await scanWorkspace(copiedStore);
    expect([...copied.idToPath.entries()]).toEqual([...rebuilt.idToPath.entries()]);
    expect([...copied.pathToId.entries()]).toEqual([...rebuilt.pathToId.entries()]);
    await expect(getTemplate(copiedStore, template.templateId, template.version)).resolves.toMatchObject({
      layers: {
        1: expect.objectContaining({ name: "研究域" }),
        2: expect.objectContaining({ name: "课题" }),
        3: expect.objectContaining({ name: "记录" }),
      } satisfies Partial<Record<Level, unknown>>,
    });
    await expect(copiedStore.exists(EIDON_TEMPLATES_DIR)).resolves.toBe(true);
    await expect(copiedStore.readFile("研究/向量检索/实验记录/note.md")).resolves.toContain("L3 content");
  });
});
