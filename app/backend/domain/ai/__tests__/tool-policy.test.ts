import { describe, expect, it } from "vitest";

import { resolveToolNames } from "../tool-policy";

// 内置工具全集（与 ai-service 的 BUILTIN_TOOLS 顺序一致）。
const ALL = ["read", "grep", "find", "ls", "bash", "edit", "write"];

describe("resolveToolNames", () => {
  it("白名单为空时回退到全集（默认 Agent 拿到全部内置工具，含 edit/write/bash）", () => {
    expect(resolveToolNames(ALL, [], [])).toEqual(ALL);
  });

  it("per-agent 白名单非空时收窄到白名单", () => {
    expect(resolveToolNames(ALL, ["read", "edit"], [])).toEqual(["read", "edit"]);
  });

  it("禁用集从基准集中减去（全局禁用 + per-agent 禁用合并）", () => {
    expect(resolveToolNames(ALL, [], ["bash", "write"])).toEqual(["read", "grep", "find", "ls", "edit"]);
  });

  it("禁用同样作用于白名单分支", () => {
    expect(resolveToolNames(ALL, ["read", "bash", "edit"], ["bash"])).toEqual(["read", "edit"]);
  });

  it("禁用不存在的工具名不影响结果，且保持基准集顺序", () => {
    expect(resolveToolNames(ALL, [], ["nonexistent"])).toEqual(ALL);
  });
});
