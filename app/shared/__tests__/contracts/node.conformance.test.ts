import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { NodeSchema } from "@shared/contracts";

// golden fixture 落仓库根 fixtures/contracts/（与旧 AI 契约同处）
const fixture = resolve(
  import.meta.dirname,
  "../../../../fixtures/contracts/node.l3.json",
);

describe("node contract", () => {
  it("accepts the golden L3 node fixture", async () => {
    const raw = await readFile(fixture, "utf8");
    const parsed = NodeSchema.parse(JSON.parse(raw));

    // 物理深度=层级：这是一份 L3 内容节点
    expect(parsed.level).toBe(3);
    // 身份为 26 字符 Crockford base32 ULID
    expect(parsed.id).toBe("01ARZ3NDEKTSV4RRFFQ69G5FAV");
    // 扩展字段：模板定义的字段值随节点落盘
    expect(parsed.fields["标题"]).toBe("向量检索调研");
    expect(parsed.fields["字数"]).toBe(1200);
    expect(parsed.fields["已归档"]).toBe(false);
  });

  it("defaults references and flags when absent", () => {
    // 缺前向预留字段的最小节点仍应解析（删缓存/旧写入器/手改后可重建）
    const parsed = NodeSchema.parse({
      id: "01BX5ZZKBKACTAV9WEVGEMMVRZ",
      templateId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
      level: 1,
      type: "node",
      schemaVersion: 1,
      createdAt: "2026-06-01T18:00:00.000Z",
      fields: {},
    });

    expect(parsed.references).toEqual([]);
    expect(parsed.flags).toEqual({});
  });

  it("rejects an out-of-range level", () => {
    const bad = {
      id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
      templateId: "01BX5ZZKBKACTAV9WEVGEMMVRZ",
      level: 4,
      type: "node",
      schemaVersion: 1,
      createdAt: "2026-06-01T18:00:00.000Z",
      fields: {},
    };

    expect(() => NodeSchema.parse(bad)).toThrow();
  });
});
