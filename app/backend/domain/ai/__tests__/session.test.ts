import { describe, expect, it } from "vitest";

import type { AgentSessionEvent } from "@earendil-works/pi-coding-agent";

import { projectEvent } from "../session";

// 用最小对象构造事件（只取 projectEvent 关心的字段）。
const ev = (e: unknown): AgentSessionEvent => e as AgentSessionEvent;

describe("projectEvent", () => {
  it("projects text/thinking deltas from message_update", () => {
    expect(
      projectEvent("s1", ev({ type: "message_update", assistantMessageEvent: { type: "text_delta", delta: "你好" } })),
    ).toEqual([{ kind: "text_delta", sessionId: "s1", delta: "你好" }]);

    expect(
      projectEvent("s1", ev({ type: "message_update", assistantMessageEvent: { type: "thinking_delta", delta: "思考" } })),
    ).toEqual([{ kind: "thinking_delta", sessionId: "s1", delta: "思考" }]);
  });

  it("ignores non-delta assistant sub-events", () => {
    expect(
      projectEvent("s1", ev({ type: "message_update", assistantMessageEvent: { type: "text_start" } })),
    ).toEqual([]);
  });

  it("projects tool lifecycle events", () => {
    expect(projectEvent("s1", ev({ type: "tool_execution_start", toolCallId: "t1", toolName: "read", args: {} }))).toEqual([
      { kind: "tool_start", sessionId: "s1", toolCallId: "t1", toolName: "read" },
    ]);
    expect(
      projectEvent("s1", ev({ type: "tool_execution_update", toolCallId: "t1", toolName: "read", args: {}, partialResult: "abc" })),
    ).toEqual([{ kind: "tool_update", sessionId: "s1", toolCallId: "t1", chunk: "abc" }]);
    expect(
      projectEvent("s1", ev({ type: "tool_execution_end", toolCallId: "t1", toolName: "read", result: {}, isError: true })),
    ).toEqual([{ kind: "tool_end", sessionId: "s1", toolCallId: "t1", isError: true }]);
  });

  it("projects message + agent lifecycle", () => {
    expect(projectEvent("s1", ev({ type: "message_start", message: {} }))).toEqual([
      { kind: "message_start", sessionId: "s1" },
    ]);
    expect(projectEvent("s1", ev({ type: "message_end", message: {} }))).toEqual([
      { kind: "message_end", sessionId: "s1" },
    ]);
    expect(projectEvent("s1", ev({ type: "agent_end", messages: [], willRetry: false }))).toEqual([
      { kind: "done", sessionId: "s1" },
    ]);
  });

  it("ignores unrelated events (turn_start/queue_update)", () => {
    expect(projectEvent("s1", ev({ type: "turn_start" }))).toEqual([]);
    expect(projectEvent("s1", ev({ type: "queue_update", steering: [], followUp: [] }))).toEqual([]);
  });

  it("stringifies non-string tool chunks", () => {
    expect(
      projectEvent("s1", ev({ type: "tool_execution_update", toolCallId: "t1", toolName: "x", args: {}, partialResult: { a: 1 } })),
    ).toEqual([{ kind: "tool_update", sessionId: "s1", toolCallId: "t1", chunk: '{"a":1}' }]);
  });
});
