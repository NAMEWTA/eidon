import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createNodeId } from "@shared/utils/id";
import { scanWorkspace, type WorkspaceReader } from "@backend/domain/nodes";

// node:fs 实现的 WorkspaceReader：生产环境由 backend 的 capabilities/editor 提供（不在本期范围）。
const fsReader = (root: string): WorkspaceReader => ({
  async listDir(relPath) {
    const abs = relPath ? join(root, relPath) : root;
    const entries = await readdir(abs, { withFileTypes: true });
    return entries.map((e) => ({ name: e.name, isDir: e.isDirectory() }));
  },
  async readFile(relPath) {
    return readFile(join(root, relPath), "utf8");
  },
});

// 在 dirPath 下写一个结构节点（.node/node.json）。
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
const baseNode = {
  templateId: createNodeId(),
  type: "node",
  schemaVersion: 1,
  createdAt: "2026-06-01T18:00:00.000Z",
  fields: {},
};

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "eidon-scan-"));

  // 合法三层：研究(L1) → 向量检索(L2) → 实验记录(L3)
  await writeNode(root, "研究", { ...baseNode, id: idL1, level: 1 });
  await writeNode(root, "研究/向量检索", { ...baseNode, id: idL2, level: 2 });
  await writeNode(root, "研究/向量检索/实验记录", {
    ...baseNode,
    id: idL3,
    level: 3,
  });
  // L3 下的内容文件 + 第 4 层自由文件夹（无身份）
  await writeFile(join(root, "研究/向量检索/实验记录/笔记.md"), "# 笔记", "utf8");
  await mkdir(join(root, "研究/向量检索/实验记录/附件"), { recursive: true });
  // 系统区（应被扫描忽略）
  await mkdir(join(root, ".eidon/templates/tid"), { recursive: true });
  await writeFile(join(root, ".eidon/templates/tid/L1.档案.v1.json"), "{}", "utf8");
  // 第 1 层普通文件夹（无 .node/，非节点）
  await mkdir(join(root, "草稿"), { recursive: true });
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("scanWorkspace", () => {
  it("builds the node tree from disk with depth-derived levels and id→path", async () => {
    const tree = await scanWorkspace(fsReader(root));

    expect(tree.nodes).toHaveLength(3);
    expect(tree.idToPath.get(idL1)).toBe("研究");
    expect(tree.idToPath.get(idL2)).toBe("研究/向量检索");
    expect(tree.idToPath.get(idL3)).toBe("研究/向量检索/实验记录");
    expect(tree.pathToId.get("研究/向量检索/实验记录")).toBe(idL3);

    // 深度=层级：物理深度即权威层级
    const l3 = tree.nodes.find((n) => n.path === "研究/向量检索/实验记录");
    expect(l3?.depth).toBe(3);
    expect(l3?.node.level).toBe(3);
    expect(l3?.node.id).toBe(idL3);
  });

  it("ignores system dirs, plain folders, and depth-4 free folders", async () => {
    const tree = await scanWorkspace(fsReader(root));
    const paths = tree.nodes.map((n) => n.path);

    expect(paths).not.toContain("草稿"); // 普通文件夹无身份
    expect(paths).not.toContain("研究/向量检索/实验记录/附件"); // 第 4 层自由文件夹
    expect(paths.some((p) => p.startsWith(".eidon"))).toBe(false); // 系统区忽略
  });
});
