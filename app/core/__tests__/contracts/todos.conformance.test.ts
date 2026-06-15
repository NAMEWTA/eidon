import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { NodeTodoFileSchema } from "../../contracts";

// golden fixture 落仓库根 fixtures/contracts/（与 node/template 契约同处）
const fixture = resolve(
  import.meta.dirname,
  "../../../../fixtures/contracts/todos.l3.json",
);

describe("todos contract", () => {
  it("accepts the golden node todos fixture", async () => {
    const raw = await readFile(fixture, "utf8");
    const parsed = NodeTodoFileSchema.parse(JSON.parse(raw));

    expect(parsed.version).toBe(1);
    expect(parsed.nodeId).toBe("01ARZ3NDEKTSV4RRFFQ69G5FAV");
    expect(parsed.items).toHaveLength(2);
    // 第一项：一次性提醒 + 截止日
    expect(parsed.items[0].priority).toBe("high");
    expect(parsed.items[0].reminders[0].repeat).toBe("once");
    // 第二项：每日重复提醒、无截止日
    expect(parsed.items[1].due).toBeNull();
    expect(parsed.items[1].reminders[0].repeat).toBe("daily");
  });

  it("defaults optional item/reminder fields when absent", () => {
    // 最小 todos.json（删缓存/旧写入器/手改后可重建）：缺省字段取默认
    const parsed = NodeTodoFileSchema.parse({
      version: 1,
      nodeId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
      updatedAt: "2026-06-13T09:00:00.000Z",
      items: [
        {
          id: "01BX5ZZKBKACTAV9WEVGEMMVRZ",
          text: "裸待办",
          createdAt: "2026-06-13T08:00:00.000Z",
        },
      ],
    });

    const item = parsed.items[0];
    expect(item.done).toBe(false);
    expect(item.due).toBeNull();
    expect(item.priority).toBe("normal");
    expect(item.reminders).toEqual([]);
  });

  it("rejects a non-ULID item id", () => {
    expect(() =>
      NodeTodoFileSchema.parse({
        version: 1,
        nodeId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
        updatedAt: "2026-06-13T09:00:00.000Z",
        items: [{ id: "not-a-ulid", text: "x", createdAt: "2026-06-13T08:00:00.000Z" }],
      }),
    ).toThrow();
  });

  it("rejects an unknown repeat rule", () => {
    expect(() =>
      NodeTodoFileSchema.parse({
        version: 1,
        nodeId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
        updatedAt: "2026-06-13T09:00:00.000Z",
        items: [
          {
            id: "01BX5ZZKBKACTAV9WEVGEMMVRZ",
            text: "x",
            createdAt: "2026-06-13T08:00:00.000Z",
            reminders: [{ id: "01BX5ZZKBKACTAV9WEVGEMMVS0", fireAt: "2026-06-20T01:00:00.000Z", repeat: "yearly" }],
          },
        ],
      }),
    ).toThrow();
  });
});
