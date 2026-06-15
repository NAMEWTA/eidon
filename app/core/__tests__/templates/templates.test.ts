import { mkdtemp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { isNodeId } from "../../shared/id";
import {
  createTemplate,
  deleteTemplate,
  editTemplate,
  getTemplate,
  initWorkspaceTemplates,
  listInvalidTemplates,
  listTemplates,
  listTemplateVersions,
  type TemplateStore,
} from "../../templates";

// node:fs 实现的可写 TemplateStore：生产环境由 core/bridge 经 editor/file_ops 提供（不在本期范围）。
const fsStore = (root: string): TemplateStore => ({
  async listDir(relPath) {
    const abs = relPath ? join(root, relPath) : root;
    try {
      const entries = await readdir(abs, { withFileTypes: true });
      return entries.map((e) => ({ name: e.name, isDir: e.isDirectory() }));
    } catch {
      return []; // 目录不存在视为空（初始化前 .eidon/templates/ 尚无）
    }
  },
  async readFile(relPath) {
    return readFile(join(root, relPath), "utf8");
  },
  async writeFile(relPath, contents) {
    const abs = join(root, relPath);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, contents, "utf8");
  },
  async remove(relPath) {
    await rm(join(root, relPath), { recursive: true, force: true });
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
const newStore = async (): Promise<TemplateStore> => {
  const root = await mkdtemp(join(tmpdir(), "eidon-tpl-"));
  roots.push(root);
  return fsStore(root);
};

// 一套覆盖全部 6 类字段的合法资料模板输入
const materialInput = () => ({
  templateName: "学术资料",
  layers: {
    1: { name: "学科", fields: [{ key: "area", label: "领域", type: "text" as const }] },
    2: { name: "专题", fields: [{ key: "tags", label: "标签", type: "textarea" as const }] },
    3: {
      name: "资料",
      fields: [
        { key: "title", label: "标题", type: "text" as const, required: true },
        { key: "summary", label: "摘要", type: "textarea" as const },
        { key: "year", label: "年份", type: "number" as const },
        { key: "date", label: "日期", type: "date" as const },
        { key: "status", label: "状态", type: "select" as const, options: ["新", "旧"] },
        { key: "star", label: "星标", type: "boolean" as const },
      ],
    },
  },
});

const minimalInput = (l1: string) => ({
  layers: {
    1: { name: l1, fields: [] },
    2: { name: `${l1}-2`, fields: [] },
    3: { name: `${l1}-3`, fields: [] },
  },
});

afterAll(async () => {
  await Promise.all(roots.map((r) => rm(r, { recursive: true, force: true })));
});

describe("createTemplate / listTemplates", () => {
  it("creates a custom template and lists it back with all six field types", async () => {
    const store = await newStore();

    const created = await createTemplate(store, materialInput());
    expect(isNodeId(created.templateId)).toBe(true);
    expect(created.templateName).toBe("学术资料");
    expect(created.layers[1].templateName).toBe("学术资料");
    expect(created.version).toBe(1);

    const list = await listTemplates(store);
    expect(list).toHaveLength(1);
    expect(list[0].templateName).toBe("学术资料");
    expect(list[0].layers[1].name).toBe("学科");
    expect(list[0].layers[3].name).toBe("资料");
    expect(list[0].layers[3].fields.map((f) => f.type)).toEqual([
      "text",
      "textarea",
      "number",
      "date",
      "select",
      "boolean",
    ]);
  });

  it("keeps multiple templates side by side", async () => {
    const store = await newStore();

    await createTemplate(store, minimalInput("甲"));
    await createTemplate(store, minimalInput("乙"));

    const list = await listTemplates(store);
    expect(list).toHaveLength(2);
    // 顺序无关：两套并存即可
    expect(new Set(list.map((t) => t.layers[1].name))).toEqual(
      new Set(["甲", "乙"]),
    );
  });

  it("falls back to level names when reading old templates without templateName", async () => {
    const store = await newStore();
    const templateId = "legacy-template";

    await store.writeFile(
      `.eidon/templates/${templateId}/L1.库.v1.json`,
      JSON.stringify({ templateId, level: 1, name: "库", version: 1, schemaVersion: 1, fields: [] }),
    );
    await store.writeFile(
      `.eidon/templates/${templateId}/L2.组.v1.json`,
      JSON.stringify({ templateId, level: 2, name: "组", version: 1, schemaVersion: 1, fields: [] }),
    );
    await store.writeFile(
      `.eidon/templates/${templateId}/L3.条目.v1.json`,
      JSON.stringify({ templateId, level: 3, name: "条目", version: 1, schemaVersion: 1, fields: [] }),
    );

    const list = await listTemplates(store);
    expect(list[0].templateName).toBe("库 / 组 / 条目");
  });

  it("rejects a select field without options and writes nothing", async () => {
    const store = await newStore();

    await expect(
      createTemplate(store, {
        layers: {
          1: { name: "x", fields: [] },
          2: { name: "y", fields: [] },
          3: {
            name: "z",
            fields: [{ key: "s", label: "S", type: "select" as const }],
          },
        },
      }),
    ).rejects.toThrow();

    // 校验失败应原子失败，不留半套文件
    expect(await listTemplates(store)).toHaveLength(0);
  });

  it("skips invalid template directories and reports them for recovery", async () => {
    const store = await newStore();
    await createTemplate(store, minimalInput("有效"));

    await store.writeFile(
      ".eidon/templates/bad-template/L1.Bad.v1.json",
      JSON.stringify({ templateId: "bad-template", level: 1, name: "Bad", version: 1, fields: [] }),
    );

    const list = await listTemplates(store);
    expect(list).toHaveLength(1);
    expect(list[0].layers[1].name).toBe("有效");

    const invalid = await listInvalidTemplates(store);
    expect(invalid).toContainEqual({
      templateId: "bad-template",
      reason: "latest version is incomplete or invalid",
    });
  });
});

describe("initWorkspaceTemplates", () => {
  it("seeds the three built-in templates on first use", async () => {
    const store = await newStore();

    const result = await initWorkspaceTemplates(store);
    expect(result.initialized).toBe(true);
    expect(result.templateIds).toHaveLength(3);

    const list = await listTemplates(store);
    expect(list).toHaveLength(3);
    expect(new Set(list.map((t) => t.templateName))).toEqual(
      new Set(["档案", "项目", "资料"]),
    );
    expect(new Set(list.map((t) => t.layers[1].name))).toEqual(
      new Set(["档案库", "项目集", "资料库"]),
    );

    const archive = list.find((t) => t.layers[1].name === "档案库");
    expect(archive?.layers[2].name).toBe("案卷");
    expect(archive?.layers[3].name).toBe("文件");
    expect(archive?.layers[2].fields.map((field) => field.key)).toEqual([
      "category",
      "date",
      "status",
    ]);
    expect(archive?.layers[3].fields.map((field) => field.key)).toEqual([
      "summary",
      "source",
    ]);

    const project = list.find((t) => t.layers[1].name === "项目集");
    expect(project?.layers[2].name).toBe("项目");
    expect(project?.layers[3].name).toBe("资料");
    expect(project?.layers[2].fields.map((field) => field.key)).toEqual([
      "owner",
      "progress",
      "deadline",
      "budget",
    ]);
    expect(project?.layers[3].fields.map((field) => field.key)).toEqual([
      "kind",
      "note",
    ]);

    const material = list.find((t) => t.layers[1].name === "资料库");
    expect(material?.layers[2].name).toBe("主题");
    expect(material?.layers[3].name).toBe("条目");
    expect(material?.layers[2].fields.map((field) => field.key)).toEqual([
      "domain",
      "importance",
    ]);
    expect(material?.layers[3].fields.map((field) => field.key)).toEqual([
      "tags",
      "read",
    ]);
  });

  it("is a no-op on second use (write-once)", async () => {
    const store = await newStore();

    await initWorkspaceTemplates(store);
    const idsBefore = (await listTemplates(store)).map((t) => t.templateId);

    const second = await initWorkspaceTemplates(store);
    expect(second.initialized).toBe(false);

    const idsAfter = (await listTemplates(store)).map((t) => t.templateId);
    expect(idsAfter).toHaveLength(3); // 没有重复播种成 6 套
    expect(new Set(idsAfter)).toEqual(new Set(idsBefore)); // 身份未变、未重写
  });
});

describe("deleteTemplate", () => {
  it("removes a template so it no longer lists", async () => {
    const store = await newStore();
    const removed = await createTemplate(store, minimalInput("甲"));
    await createTemplate(store, minimalInput("乙"));

    await deleteTemplate(store, removed.templateId);

    const list = await listTemplates(store);
    expect(list).toHaveLength(1);
    expect(list.map((t) => t.templateId)).not.toContain(removed.templateId);
  });

  it("does not resurrect a deleted built-in on re-init", async () => {
    const store = await newStore();
    await initWorkspaceTemplates(store);

    const archive = (await listTemplates(store)).find(
      (t) => t.layers[1].name === "档案库",
    );
    if (!archive) throw new Error("内置种子 档案 缺失");
    await deleteTemplate(store, archive.templateId);

    const reinit = await initWorkspaceTemplates(store);
    expect(reinit.initialized).toBe(false); // 已初始化，不再播种

    const list = await listTemplates(store);
    expect(list).toHaveLength(2);
    expect(list.map((t) => t.layers[1].name)).not.toContain("档案库");
  });
});

describe("editTemplate / getTemplate", () => {
  it("creates a new version while leaving the old version intact", async () => {
    const store = await newStore();
    const v1 = await createTemplate(store, {
      templateName: "甲模板",
      layers: {
        1: { name: "甲", fields: [{ key: "a", label: "A", type: "text" }] },
        2: { name: "甲2", fields: [] },
        3: { name: "甲3", fields: [] },
      },
    });
    expect(v1.version).toBe(1);

    const v2 = await editTemplate(store, v1.templateId, {
      templateName: "甲新版",
      layers: {
        1: {
          name: "甲改",
          fields: [
            { key: "a", label: "A", type: "text" },
            { key: "b", label: "B", type: "number" },
          ],
        },
        2: { name: "甲2", fields: [] },
        3: { name: "甲3", fields: [] },
      },
    });
    expect(v2.version).toBe(2);

    // 最新版 = v2（改后）
    const latest = await getTemplate(store, v1.templateId);
    expect(latest?.version).toBe(2);
    expect(latest?.templateName).toBe("甲新版");
    expect(latest?.layers[1].name).toBe("甲改");
    expect(latest?.layers[1].fields).toHaveLength(2);

    // 旧版 v1 原样保留（旧节点按其 schemaVersion 继续有效）
    const old = await getTemplate(store, v1.templateId, 1);
    expect(old?.version).toBe(1);
    expect(old?.templateName).toBe("甲模板");
    expect(old?.layers[1].name).toBe("甲");
    expect(old?.layers[1].fields).toHaveLength(1);

    // 列出仍只一套（取最新版，不重复计数）
    expect(await listTemplates(store)).toHaveLength(1);
  });

  it("returns null when getting a template that does not exist", async () => {
    const store = await newStore();
    expect(
      await getTemplate(store, "01ARZ3NDEKTSV4RRFFQ69G5FAV"),
    ).toBeNull();
  });

  it("preserves the previous templateName when editing without an explicit templateName", async () => {
    const store = await newStore();
    const v1 = await createTemplate(store, {
      templateName: "研究资料",
      layers: {
        1: { name: "研究", fields: [] },
        2: { name: "课题", fields: [] },
        3: { name: "记录", fields: [] },
      },
    });

    const v2 = await editTemplate(store, v1.templateId, {
      layers: {
        1: { name: "研究域", fields: [] },
        2: { name: "课题", fields: [] },
        3: { name: "记录", fields: [] },
      },
    });

    expect(v2.templateName).toBe("研究资料");
    expect(v2.layers[1].templateName).toBe("研究资料");
  });
});

describe("阶段1 端到端验收", () => {
  it("init 内置 → 自建并存 → 编辑(旧版不乱) → 删除 → 再开不复活", async () => {
    const store = await newStore();

    // 1. 首次初始化内置三套
    expect((await initWorkspaceTemplates(store)).initialized).toBe(true);
    expect(await listTemplates(store)).toHaveLength(3);

    // 2. 自建一套，与内置平级共存 → 4 套
    await createTemplate(store, {
      layers: {
        1: { name: "研究", fields: [{ key: "field", label: "领域", type: "text" }] },
        2: { name: "课题", fields: [] },
        3: { name: "记录", fields: [{ key: "note", label: "笔记", type: "textarea" }] },
      },
    });
    expect(await listTemplates(store)).toHaveLength(4);

    // 3. 编辑内置 档案 → v2；旧版 v1 原样（老数据不乱）
    const archive = (await listTemplates(store)).find(
      (t) => t.layers[1].name === "档案库",
    );
    if (!archive) throw new Error("内置 档案 缺失");
    const archiveV2 = await editTemplate(store, archive.templateId, {
      layers: {
        1: {
          name: "档案库",
          fields: [
            { key: "domain", label: "领域", type: "text" },
            { key: "tag", label: "标签", type: "text" },
          ],
        },
        2: { name: "案卷", fields: [] },
        3: {
          name: "文件",
          fields: [{ key: "title", label: "标题", type: "text", required: true }],
        },
      },
    });
    expect(archiveV2.version).toBe(2);
    const archiveV1 = await getTemplate(store, archive.templateId, 1);
    expect(archiveV1?.layers[1].fields).toHaveLength(0);
    expect(archiveV1?.layers[2].fields.map((field) => field.key)).toEqual([
      "category",
      "date",
      "status",
    ]);
    expect(archiveV1?.layers[3].fields.map((field) => field.key)).toEqual([
      "summary",
      "source",
    ]);
    expect((await getTemplate(store, archive.templateId))?.layers[1].fields).toHaveLength(2);
    expect(await listTemplateVersions(store, archive.templateId)).toEqual([1, 2]);

    // 4. 删除内置 项目
    const project = (await listTemplates(store)).find(
      (t) => t.layers[1].name === "项目集",
    );
    if (!project) throw new Error("内置 项目 缺失");
    await deleteTemplate(store, project.templateId);
    expect(await listTemplates(store)).toHaveLength(3);

    // 5. 再开：重复 init 不再播种、删过的 项目 不复活
    expect((await initWorkspaceTemplates(store)).initialized).toBe(false);
    const finalNames = (await listTemplates(store)).map((t) => t.layers[1].name);
    expect(new Set(finalNames)).toEqual(new Set(["档案库", "资料库", "研究"]));
    expect(finalNames).not.toContain("项目集");
  });
});
