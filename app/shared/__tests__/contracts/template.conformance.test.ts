import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  TemplateLayerSchema,
  parseTemplateLayerFileName,
  templateLayerFileName,
  templateLayerPath,
} from "@shared/contracts";

const fixture = resolve(
  import.meta.dirname,
  "../../../../fixtures/contracts/template.l1.档案.json",
);

describe("template layer contract", () => {
  it("accepts the golden L1 template layer fixture with all six field types", async () => {
    const raw = await readFile(fixture, "utf8");
    const parsed = TemplateLayerSchema.parse(JSON.parse(raw));

    expect(parsed.templateName).toBe("档案");
    expect(parsed.level).toBe(1);
    expect(parsed.name).toBe("档案");
    const types = parsed.fields.map((f) => f.type);
    expect(types).toEqual([
      "text",
      "textarea",
      "number",
      "date",
      "select",
      "boolean",
    ]);
    // select 字段携带选项
    const select = parsed.fields.find((f) => f.type === "select");
    expect(select?.options).toEqual(["进行中", "已完成", "搁置"]);
  });

  it("keeps old template layers without templateName readable", () => {
    const parsed = TemplateLayerSchema.parse({
      templateId: "01BX5ZZKBKACTAV9WEVGEMMVRZ",
      level: 1,
      name: "档案",
      version: 1,
      schemaVersion: 1,
      fields: [],
    });

    expect(parsed.templateName).toBeUndefined();
  });

  it("rejects a select field without options", () => {
    const bad = {
      templateId: "01BX5ZZKBKACTAV9WEVGEMMVRZ",
      level: 2,
      name: "项目",
      version: 1,
      schemaVersion: 1,
      fields: [{ key: "stage", label: "阶段", type: "select" }],
    };

    expect(() => TemplateLayerSchema.parse(bad)).toThrow();
  });

  it("builds and parses the L{n}.{name}.v{ver}.json layer file name", () => {
    const spec = { level: 1, name: "档案", version: 1 } as const;

    expect(templateLayerFileName(spec)).toBe("L1.档案.v1.json");
    expect(parseTemplateLayerFileName("L1.档案.v1.json")).toEqual(spec);
    expect(parseTemplateLayerFileName("not-a-layer.json")).toBeNull();
  });

  it("composes the .eidon templates path for a layer file", () => {
    const path = templateLayerPath("01BX5ZZKBKACTAV9WEVGEMMVRZ", {
      level: 3,
      name: "资料",
      version: 2,
    });

    expect(path).toBe(
      ".eidon/templates/01BX5ZZKBKACTAV9WEVGEMMVRZ/L3.资料.v2.json",
    );
  });
});
