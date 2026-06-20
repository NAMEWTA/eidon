import {
  mkdtemp,
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { TemplateLayerSchema, type Level, type Node, type TemplateLayer } from "@shared/contracts";
import { createNodeId } from "@shared/utils/id";
import {
  createNode,
  listNodesUsingTemplate,
  upgradeNodeSchema,
  type NodeStore,
} from "@backend/domain/nodes";

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
    const abs = join(root, relPath);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, contents, "utf8");
  },
  async createDir(relPath) {
    await mkdir(join(root, relPath), { recursive: true });
  },
  async rename() {
    throw new Error("not needed");
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
  const root = await mkdtemp(join(tmpdir(), "eidon-node-upgrade-"));
  roots.push(root);
  return { root, store: fsStore(root) };
};

const layer = (
  templateId: string,
  level: Level,
  version: number,
  fields: TemplateLayer["fields"],
): TemplateLayer =>
  TemplateLayerSchema.parse({
    templateId,
    templateName: "项目",
    level,
    name: level === 1 ? "项目集" : level === 2 ? "项目" : "资料",
    version,
    schemaVersion: version,
    fields,
  });

const makeLayers = (templateId = createNodeId(), version = 1): Record<Level, TemplateLayer> => ({
  1: layer(templateId, 1, version, [{ key: "owner", label: "负责人", type: "text", required: false }]),
  2: layer(templateId, 2, version, [{ key: "status", label: "状态", type: "select", options: ["规划", "完成"], required: false }]),
  3: layer(templateId, 3, version, [
    { key: "title", label: "标题", type: "text", required: true },
    { key: "note", label: "备注", type: "textarea", required: false },
    { key: "pages", label: "页数", type: "number", required: false },
  ]),
});

const readNodeJson = async (root: string, dirPath: string): Promise<Node> =>
  JSON.parse(await readFile(join(root, dirPath, ".node/node.json"), "utf8")) as Node;

afterAll(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

describe("listNodesUsingTemplate", () => {
  it("lists nodes bound to a template across schema versions", async () => {
    const { store } = await newStore();
    const templateId = createNodeId();
    const layersV1 = makeLayers(templateId, 1);
    const other = makeLayers(createNodeId(), 1);

    await createNode(store, { parentPath: "", name: "工作", templateLayer: layersV1[1], fields: { owner: "Lin" } });
    await createNode(store, { parentPath: "工作", name: "EIDON", templateLayer: layersV1[2], fields: { status: "规划" } });
    await createNode(store, { parentPath: "", name: "其它", templateLayer: other[1], fields: { owner: "Other" } });

    const nodes = await listNodesUsingTemplate(store, templateId);

    expect(nodes.map((node) => node.path)).toEqual(["工作", "工作/EIDON"]);
    expect(nodes.every((node) => node.node.templateId === templateId)).toBe(true);
  });
});

describe("upgradeNodeSchema", () => {
  it("upgrades one node to a newer template layer while preserving compatible values", async () => {
    const { root, store } = await newStore();
    const templateId = createNodeId();
    const layersV1 = makeLayers(templateId, 1);
    const nextL3 = layer(templateId, 3, 2, [
      { key: "title", label: "标题", type: "text", required: true },
      { key: "pages", label: "页数", type: "number", required: false },
      { key: "reviewed", label: "已复核", type: "boolean", required: true },
    ]);

    await createNode(store, { parentPath: "", name: "工作", templateLayer: layersV1[1], fields: { owner: "Lin" } });
    await createNode(store, { parentPath: "工作", name: "EIDON", templateLayer: layersV1[2], fields: { status: "规划" } });
    await createNode(store, {
      parentPath: "工作/EIDON",
      name: "记录",
      templateLayer: layersV1[3],
      fields: { title: "旧标题", note: "旧备注", pages: 8 },
    });

    const upgraded = await upgradeNodeSchema(store, {
      path: "工作/EIDON/记录",
      templateLayer: nextL3,
    });

    expect(upgraded.node.schemaVersion).toBe(2);
    expect(upgraded.node.type).toBe("资料");
    expect(upgraded.node.fields).toEqual({
      title: "旧标题",
      pages: 8,
      reviewed: null,
    });
    expect(await readNodeJson(root, "工作/EIDON/记录")).toMatchObject({
      schemaVersion: 2,
      fields: { title: "旧标题", pages: 8, reviewed: null },
    });
  });

  it("rejects mismatched template ids or levels", async () => {
    const { store } = await newStore();
    const layersV1 = makeLayers();
    const other = makeLayers(createNodeId(), 2);

    await createNode(store, { parentPath: "", name: "工作", templateLayer: layersV1[1], fields: { owner: "Lin" } });

    await expect(
      upgradeNodeSchema(store, { path: "工作", templateLayer: other[1] }),
    ).rejects.toThrow(/template id/);

    await expect(
      upgradeNodeSchema(store, { path: "工作", templateLayer: layersV1[2] }),
    ).rejects.toThrow(/level/);
  });

  it("drops incompatible old values instead of writing invalid target fields", async () => {
    const { store } = await newStore();
    const templateId = createNodeId();
    const oldL1 = layer(templateId, 1, 1, [{ key: "status", label: "状态", type: "text", required: false }]);
    const newL1 = layer(templateId, 1, 2, [{ key: "status", label: "状态", type: "select", options: ["完成"], required: false }]);

    await createNode(store, { parentPath: "", name: "工作", templateLayer: oldL1, fields: { status: "规划" } });
    const upgraded = await upgradeNodeSchema(store, { path: "工作", templateLayer: newL1 });

    expect(upgraded.node.fields).toEqual({ status: null });
  });
});
