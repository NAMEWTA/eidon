import { describe, expect, it } from "vitest";

import type { ChatPartWire } from "@shared/models";

import { projectHistory } from "../session";

// 用最小结构伪造 SessionEntry（projectHistory 内部按结构读取，cast 即可）。
const entry = (message: unknown) => ({ type: "message", message }) as never;

describe("projectHistory", () => {
  it("user/assistant 文本 + 工具调用/结果投影为可渲染消息", () => {
    const entries = [
      entry({ role: "user", content: "你好" }),
      entry({
        role: "assistant",
        content: [
          { type: "thinking", thinking: "想一下" },
          { type: "text", text: "我来读文件" },
          { type: "toolCall", id: "t1", name: "read", arguments: { path: "a.md" } },
        ],
      }),
      entry({
        role: "toolResult",
        toolCallId: "t1",
        toolName: "read",
        content: [{ type: "text", text: "文件内容" }],
        isError: false,
      }),
    ];

    const msgs = projectHistory(entries);
    expect(msgs).toHaveLength(2);
    expect(msgs[0]).toMatchObject({ role: "user", parts: [{ type: "text", text: "你好" }] });
    expect(msgs[1].role).toBe("assistant");

    const toolPart = msgs[1].parts.find((p) => p.type === "tool") as Extract<ChatPartWire, { type: "tool" }>;
    expect(toolPart).toMatchObject({
      toolName: "read",
      args: { path: "a.md" },
      result: "文件内容",
      done: true,
      isError: false,
    });
  });

  it("非 message 条目被跳过；空 user 文本被忽略", () => {
    const entries = [
      { type: "model_change" } as never,
      entry({ role: "user", content: "" }),
      entry({ role: "user", content: [{ type: "text", text: "x" }] }),
    ];
    const msgs = projectHistory(entries);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].parts[0]).toEqual({ type: "text", text: "x" });
  });
});
