import { describe, expect, it } from "vitest";

import { classifyToolPermission } from "../tool-gate";

describe("classifyToolPermission", () => {
  const MODES = ["operate", "auto", "ask", "read_only"] as const;

  it("信息类工具在任何权限档恒放行", () => {
    for (const mode of MODES) {
      for (const tool of ["read", "grep", "find", "ls", "search_kb", "read_node"]) {
        expect(classifyToolPermission(mode, tool).action).toBe("allow");
      }
    }
  });

  it("完整权限：副作用工具直接放行", () => {
    for (const tool of ["bash", "edit", "write", "notify", "subagent"]) {
      expect(classifyToolPermission("operate", tool).action).toBe("allow");
    }
  });

  it("自动审核：副作用工具自动放行（呈现交给 UI）", () => {
    for (const tool of ["bash", "edit", "write"]) {
      expect(classifyToolPermission("auto", tool).action).toBe("allow");
    }
  });

  it("操作前询问：副作用工具需人工批准", () => {
    for (const tool of ["bash", "edit", "write", "notify", "subagent"]) {
      expect(classifyToolPermission("ask", tool).action).toBe("prompt");
    }
  });

  it("只读模式：副作用工具被拒绝并附解锁原因", () => {
    const d = classifyToolPermission("read_only", "bash");
    expect(d.action).toBe("deny");
    expect(d.reason).toContain("只读模式");
  });

  it("只读模式下信息类工具仍放行（可查不可改）", () => {
    expect(classifyToolPermission("read_only", "read").action).toBe("allow");
  });

  it("未知工具默认按副作用从严处理", () => {
    expect(classifyToolPermission("ask", "some_unknown_tool").action).toBe("prompt");
    expect(classifyToolPermission("read_only", "some_unknown_tool").action).toBe("deny");
    expect(classifyToolPermission("operate", "some_unknown_tool").action).toBe("allow");
  });
});
