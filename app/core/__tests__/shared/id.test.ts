import { describe, expect, it } from "vitest";

import { NodeIdSchema } from "../../contracts";
import { createNodeId, isNodeId } from "../../shared/id";

describe("node id (ULID)", () => {
  it("creates an id accepted by isNodeId and the node contract", () => {
    const id = createNodeId();

    expect(isNodeId(id)).toBe(true);
    // 与磁盘契约对齐：生成的身份必须能通过 NodeSchema 的 id 形状
    expect(NodeIdSchema.safeParse(id).success).toBe(true);
  });

  it("produces lexicographically sortable ids by creation order (monotonic)", () => {
    const first = createNodeId();
    const second = createNodeId();
    const third = createNodeId();

    // ULID 时间前缀 + 单调递增：字典序即创建顺序
    expect(first < second).toBe(true);
    expect(second < third).toBe(true);
  });

  it("rejects malformed ids", () => {
    expect(isNodeId("")).toBe(false);
    expect(isNodeId("too-short")).toBe(false);
    expect(isNodeId("01arz3ndektsv4rrffq69g5fav")).toBe(false); // 小写
    expect(isNodeId("01ARZ3NDEKTSV4RRFFQ69G5FA")).toBe(false); // 25 字符
    expect(isNodeId("0IARZ3NDEKTSV4RRFFQ69G5FAV")).toBe(false); // 含 Crockford 排除字符 I
  });
});
