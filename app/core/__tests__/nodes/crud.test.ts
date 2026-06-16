import {
  mkdtemp,
  mkdir,
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

import { TemplateLayerSchema, type Level, type Node, type TemplateLayer } from "../../contracts";
import { createNodeId } from "../../shared/id";
import {
  createNode,
  moveNode,
  promoteFolderToNode,
  renameNode,
  scanWorkspace,
  updateNodeFields,
  type NodeStore,
} from "../../nodes";

const fsStore = (root: string): NodeStore => ({
  async listDir(relPath) {
    const abs = relPath ? join(root, relPath) : root;
    const entries = await readdir(abs, { withFileTypes: true });
    return entries.map((e) => ({ name: e.name, isDir: e.isDirectory() }));
  },
  async readFile(relPath) {
    return readFile(join(root, relPath), "utf8");
  },
  async writeFile(relPath, contents) {
    const abs = join(root, relPath);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, contents, "utf8");
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

const roots: string[] = [];
const newStore = async (): Promise<{ root: string; store: NodeStore }> => {
  const root = await mkdtemp(join(tmpdir(), "eidon-node-crud-"));
  roots.push(root);
  return { root, store: fsStore(root) };
};

const makeLayers = (templateId = createNodeId(), version = 2): Record<Level, TemplateLayer> => ({
  1: TemplateLayerSchema.parse({
    templateId,
    level: 1,
    name: "研究域",
    version,
    schemaVersion: version,
    fields: [{ key: "area", label: "领域", type: "text" }],
  }),
  2: TemplateLayerSchema.parse({
    templateId,
    level: 2,
    name: "课题",
    version,
    schemaVersion: version,
    fields: [{ key: "category", label: "分类", type: "text" }],
  }),
  3: TemplateLayerSchema.parse({
    templateId,
    level: 3,
    name: "记录",
    version,
    schemaVersion: version,
    fields: [
      { key: "title", label: "标题", type: "text", required: true },
      { key: "body", label: "正文", type: "textarea" },
      { key: "pages", label: "页数", type: "number" },
      { key: "reviewedAt", label: "复核日期", type: "date" },
      { key: "status", label: "状态", type: "select", options: ["draft", "done"] },
      { key: "archived", label: "归档", type: "boolean" },
    ],
  }),
});

const readNodeJson = async (root: string, dirPath: string): Promise<Node> =>
  JSON.parse(await readFile(join(root, dirPath, ".node/node.json"), "utf8")) as Node;

afterAll(async () => {
  await Promise.all(roots.map((r) => rm(r, { recursive: true, force: true })));
});

describe("createNode", () => {
  it("creates L1 → L2 → L3 nodes and rebuilds id→path from disk", async () => {
    const { root, store } = await newStore();
    const layers = makeLayers();
    const now = "2026-06-06T00:00:00.000Z";

    const l1 = await createNode(store, {
      parentPath: "",
      name: "研究",
      templateLayer: layers[1],
      fields: { area: "信息检索" },
      now,
    });
    const l2 = await createNode(store, {
      parentPath: "研究",
      name: "向量检索",
      templateLayer: layers[2],
      fields: { category: "实验" },
      now,
    });
    const l3 = await createNode(store, {
      parentPath: "研究/向量检索",
      name: "实验记录",
      templateLayer: layers[3],
      fields: { title: "向量检索调研", pages: 1200, status: "draft", archived: false },
      now,
    });

    // 创建节点不再生成 README.md；AGENTS.md 写入本节点的 L1/L2/L3 层级结构内容。
    expect(await store.exists("研究/README.md")).toBe(false);
    expect(await store.exists("研究/向量检索/实验记录/README.md")).toBe(false);
    const l1Agents = await readFile(join(root, "研究/AGENTS.md"), "utf8");
    expect(l1Agents).toContain("# 研究");
    expect(l1Agents).toContain("结构路径：L1 研究");
    const l3Agents = await readFile(join(root, "研究/向量检索/实验记录/AGENTS.md"), "utf8");
    expect(l3Agents).toContain("# 实验记录");
    expect(l3Agents).toContain("结构路径：L1 研究 / L2 向量检索 / L3 实验记录");

    expect(l1.node.level).toBe(1);
    expect(l1.node.type).toBe("研究域");
    expect(l2.node.templateId).toBe(l1.node.templateId);
    expect(l2.node.schemaVersion).toBe(l1.node.schemaVersion);
    expect(l2.node.type).toBe("课题");
    expect(l3.node.fields).toEqual({
      title: "向量检索调研",
      body: null,
      pages: 1200,
      reviewedAt: null,
      status: "draft",
      archived: false,
    });

    const tree = await scanWorkspace(store);
    expect(tree.nodes).toHaveLength(3);
    expect(tree.idToPath.get(l1.node.id)).toBe("研究");
    expect(tree.idToPath.get(l2.node.id)).toBe("研究/向量检索");
    expect(tree.idToPath.get(l3.node.id)).toBe("研究/向量检索/实验记录");

    await expect(
      createNode(store, {
        parentPath: "研究/向量检索/实验记录",
        name: "非法结构节点",
        templateLayer: layers[3],
      }),
    ).rejects.toThrow(/L3/);
  });

  it("rejects skip-level creation and mismatched parent/template chains", async () => {
    const { store } = await newStore();
    const layers = makeLayers();
    const other = makeLayers(createNodeId(), 1);

    await expect(
      createNode(store, { parentPath: "", name: "跳级", templateLayer: layers[2] }),
    ).rejects.toThrow(/template layer level/);

    await store.createDir("普通文件夹");
    await expect(
      createNode(store, { parentPath: "普通文件夹", name: "子节点", templateLayer: layers[2] }),
    ).rejects.toThrow(/parent node/);

    await createNode(store, { parentPath: "", name: "研究", templateLayer: layers[1] });
    await expect(
      createNode(store, { parentPath: "研究", name: "错模板", templateLayer: other[2] }),
    ).rejects.toThrow(/template chain/);
  });
});

describe("updateNodeFields", () => {
  it("writes six field types by schemaVersion and rejects invalid fields", async () => {
    const { root, store } = await newStore();
    const layers = makeLayers();
    await createNode(store, { parentPath: "", name: "研究", templateLayer: layers[1] });
    await createNode(store, { parentPath: "研究", name: "向量检索", templateLayer: layers[2] });
    await createNode(store, {
      parentPath: "研究/向量检索",
      name: "实验记录",
      templateLayer: layers[3],
      fields: { title: "初始记录" },
    });

    await updateNodeFields(store, {
      path: "研究/向量检索/实验记录",
      templateLayer: layers[3],
      fields: {
        title: "调研",
        body: "正文",
        pages: 12,
        reviewedAt: "2026-06-06",
        status: "done",
        archived: true,
      },
    });
    const after = await readNodeJson(root, "研究/向量检索/实验记录");
    expect(after.fields).toEqual({
      title: "调研",
      body: "正文",
      pages: 12,
      reviewedAt: "2026-06-06",
      status: "done",
      archived: true,
    });

    await expect(
      updateNodeFields(store, {
        path: "研究/向量检索/实验记录",
        templateLayer: layers[3],
        fields: { title: "x", unknown: "nope" },
      }),
    ).rejects.toThrow(/unknown field/);

    await expect(
      updateNodeFields(store, {
        path: "研究/向量检索/实验记录",
        templateLayer: layers[3],
        fields: { title: "x", status: "invalid" },
      }),
    ).rejects.toThrow(/select option/);

    await expect(
      updateNodeFields(store, {
        path: "研究/向量检索/实验记录",
        templateLayer: layers[3],
        fields: { title: "x", pages: "many" },
      }),
    ).rejects.toThrow(/number/);

    await expect(
      updateNodeFields(store, {
        path: "研究/向量检索/实验记录",
        templateLayer: layers[3],
        fields: { pages: 1 },
      }),
    ).rejects.toThrow(/required/);

    await expect(
      updateNodeFields(store, {
        path: "研究/向量检索/实验记录",
        templateLayer: layers[3],
        fields: { title: "x", pages: Number.NaN },
      }),
    ).rejects.toThrow(/finite number/);
  });
});

describe("renameNode / moveNode", () => {
  it("keeps node ID stable while updating the rebuilt id→path mapping", async () => {
    const { root, store } = await newStore();
    const layers = makeLayers();
    const otherLayers = makeLayers(createNodeId(), 1);

    await createNode(store, { parentPath: "", name: "研究", templateLayer: layers[1] });
    await createNode(store, { parentPath: "研究", name: "A", templateLayer: layers[2] });
    await createNode(store, { parentPath: "研究", name: "B", templateLayer: layers[2] });
    const l3 = await createNode(store, {
      parentPath: "研究/A",
      name: "记录",
      templateLayer: layers[3],
      fields: { title: "记录" },
    });

    await renameNode(store, { path: "研究/A/记录", newName: "记录改名" });
    expect((await readNodeJson(root, "研究/A/记录改名")).id).toBe(l3.node.id);
    expect((await scanWorkspace(store)).idToPath.get(l3.node.id)).toBe("研究/A/记录改名");

    await moveNode(store, { path: "研究/A/记录改名", newParentPath: "研究/B" });
    expect((await readNodeJson(root, "研究/B/记录改名")).id).toBe(l3.node.id);
    expect((await scanWorkspace(store)).idToPath.get(l3.node.id)).toBe("研究/B/记录改名");

    await createNode(store, { parentPath: "", name: "其他", templateLayer: otherLayers[1] });
    await createNode(store, { parentPath: "其他", name: "C", templateLayer: otherLayers[2] });
    await expect(
      moveNode(store, { path: "研究/B/记录改名", newParentPath: "其他/C" }),
    ).rejects.toThrow(/template chain/);
  });
});

describe("promoteFolderToNode", () => {
  it("promotes existing plain folders by current physical depth without moving content", async () => {
    const { root, store } = await newStore();
    const layers = makeLayers();

    await store.createDir("Inbox/Topic/Entry/Free");
    await store.writeFile("Inbox/legacy.md", "# legacy");
    await store.writeFile("Inbox/README.md", "# Existing readme");

    const l1 = await promoteFolderToNode(store, {
      path: "Inbox",
      templateLayer: layers[1],
      fields: { area: "migration" },
    });
    expect(l1.node.level).toBe(1);
    expect(await readFile(join(root, "Inbox/legacy.md"), "utf8")).toBe("# legacy");
    // 既有 README.md 保持不动（不再创建、也不覆盖）；AGENTS.md 写入层级结构内容。
    expect(await readFile(join(root, "Inbox/README.md"), "utf8")).toBe("# Existing readme");
    expect(await readFile(join(root, "Inbox/AGENTS.md"), "utf8")).toContain("# Inbox");

    const l2 = await promoteFolderToNode(store, { path: "Inbox/Topic", templateLayer: layers[2] });
    const l3 = await promoteFolderToNode(store, {
      path: "Inbox/Topic/Entry",
      templateLayer: layers[3],
      fields: { title: "Entry" },
    });
    expect(l2.node.templateId).toBe(l1.node.templateId);
    expect(l3.node.level).toBe(3);
    expect((await scanWorkspace(store)).idToPath.get(l3.node.id)).toBe("Inbox/Topic/Entry");

    await expect(
      promoteFolderToNode(store, { path: "Inbox/Topic/Entry/Free", templateLayer: layers[3] }),
    ).rejects.toThrow(/first three physical depths/);
    await expect(
      promoteFolderToNode(store, { path: "Inbox", templateLayer: layers[1] }),
    ).rejects.toThrow(/already a node/);
  });
});
