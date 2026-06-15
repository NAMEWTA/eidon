import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createNodeId } from "../../shared/id";
import { scanWorkspace, type WorkspaceReader } from "../../nodes";

// 可选反序枚举的 fs reader：用于证明扫描结果与目录枚举顺序无关。
const fsReader = (
  root: string,
  opts?: { reverse?: boolean },
): WorkspaceReader => ({
  async listDir(relPath) {
    const abs = relPath ? join(root, relPath) : root;
    const entries = await readdir(abs, { withFileTypes: true });
    const mapped = entries.map((e) => ({ name: e.name, isDir: e.isDirectory() }));
    return opts?.reverse ? mapped.reverse() : mapped;
  },
  async readFile(relPath) {
    return readFile(join(root, relPath), "utf8");
  },
});

const writeNode = async (
  root: string,
  dirPath: string,
  node: Record<string, unknown>,
): Promise<void> => {
  await mkdir(join(root, dirPath, ".node"), { recursive: true });
  await writeFile(
    join(root, dirPath, ".node", "node.json"),
    JSON.stringify(node, null, 2),
    "utf8",
  );
};

let root: string;
const idL1 = createNodeId();
const idL2 = createNodeId();
const idL3 = createNodeId();
const templateId = createNodeId();

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "eidon-rebuild-"));
  const base = { templateId, type: "node", schemaVersion: 1, createdAt: "2026-06-01T18:00:00.000Z" };

  await writeNode(root, "研究", { ...base, id: idL1, level: 1, fields: { 领域: "信息检索" } });
  await writeNode(root, "研究/向量检索", { ...base, id: idL2, level: 2, fields: {} });
  await writeNode(root, "研究/向量检索/实验记录", {
    ...base,
    id: idL3,
    level: 3,
    fields: { 标题: "向量检索调研", 字数: 1200, 已归档: false },
  });
  // 运行时索引缓存 + 模板渲染信息（删除后应不影响节点树重建）
  await mkdir(join(root, ".eidon/templates/tid"), { recursive: true });
  await writeFile(join(root, ".eidon/index-cache.json"), '{"stale":true}', "utf8");
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("rebuildability (AX-1/AX-4)", () => {
  it("rebuilds an identical node tree from .node/ after the .eidon cache is deleted", async () => {
    const before = await scanWorkspace(fsReader(root));

    // 模拟删运行时索引缓存：整块删除 .eidon（含 templates 渲染信息）
    await rm(join(root, ".eidon"), { recursive: true, force: true });

    // 反序 reader 重扫：重建只依赖磁盘 .node/，且与枚举顺序无关
    const after = await scanWorkspace(fsReader(root, { reverse: true }));

    // 节点树/身份/层级/字段 100% 一致
    expect(after.nodes).toEqual(before.nodes);
    // id→path 与 path→id 映射逐项一致
    expect([...after.idToPath.entries()]).toEqual([...before.idToPath.entries()]);
    expect([...after.pathToId.entries()]).toEqual([...before.pathToId.entries()]);

    // 字段值确实从 .node/node.json 重建出来
    const l3 = after.nodes.find((n) => n.node.id === idL3);
    expect(l3?.node.fields).toEqual({ 标题: "向量检索调研", 字数: 1200, 已归档: false });
  });
});
