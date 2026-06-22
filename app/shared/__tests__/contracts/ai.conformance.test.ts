import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  AgentConfigSchema,
  ProvidersFileSchema,
  CronJobsFileSchema,
  ChannelsFileSchema,
  BridgeBindingsFileSchema,
} from "@shared/contracts";

// golden fixtures 落仓库根 fixtures/contracts/（与 node/template/todos 契约同处）。
const fixturesDir = resolve(import.meta.dirname, "../../../../fixtures/contracts");
const readFixture = async (name: string) =>
  JSON.parse(await readFile(resolve(fixturesDir, name), "utf8"));

describe("agent config contract", () => {
  it("accepts the golden agent fixture", async () => {
    const parsed = AgentConfigSchema.parse(await readFixture("agent.json"));
    expect(parsed.version).toBe(1);
    expect(parsed.id).toBe("01ARZ3NDEKTSV4RRFFQ69G5FAV");
    expect(parsed.model).toEqual({ provider: "anthropic", id: "claude-sonnet-4-6" });
    expect(parsed.visibility).toBe("public");
    expect(parsed.activatableByAgents).toBe(true);
    expect(parsed.skills.enabled).toContain("pi-sdk");
    expect(parsed.experience.enabled).toBe(true);
    expect(parsed.yuan).toBe("default");
  });

  it("defaults optional fields when absent (minimal agent)", () => {
    const parsed = AgentConfigSchema.parse({
      version: 1,
      id: "01BX5ZZKBKACTAV9WEVGEMMVRZ",
      name: "裸 Agent",
      createdAt: "2026-06-20T08:00:00.000Z",
      updatedAt: "2026-06-20T08:00:00.000Z",
    });
    expect(parsed.description).toBe("");
    expect(parsed.avatar).toBeNull();
    expect(parsed.model).toBeNull();
    expect(parsed.params.thinkingLevel).toBe("medium");
    expect(parsed.params.temperature).toBeNull();
    expect(parsed.tools).toEqual({ enabled: [], disabled: [] });
    expect(parsed.visibility).toBe("private");
    expect(parsed.activatableByAgents).toBe(false);
    expect(parsed.channelsEnabled).toBe(false);
    expect(parsed.experience).toEqual({ enabled: false });
    expect(parsed.yuan).toBeNull();
  });

  it("rejects a non-ULID agent id", () => {
    expect(() =>
      AgentConfigSchema.parse({
        version: 1,
        id: "not-a-ulid",
        name: "x",
        createdAt: "2026-06-20T08:00:00.000Z",
        updatedAt: "2026-06-20T08:00:00.000Z",
      }),
    ).toThrow();
  });

  it("rejects an unknown thinking level", () => {
    expect(() =>
      AgentConfigSchema.parse({
        version: 1,
        id: "01BX5ZZKBKACTAV9WEVGEMMVRZ",
        name: "x",
        params: { thinkingLevel: "turbo" },
        createdAt: "2026-06-20T08:00:00.000Z",
        updatedAt: "2026-06-20T08:00:00.000Z",
      }),
    ).toThrow();
  });
});

describe("providers contract", () => {
  it("accepts the golden providers fixture", async () => {
    const parsed = ProvidersFileSchema.parse(await readFixture("providers.json"));
    expect(parsed.version).toBe(1);
    expect(parsed.defaultModel).toEqual({ provider: "anthropic", id: "claude-sonnet-4-6" });
    expect(parsed.providers.anthropic.enabled).toBe(true);
    expect(parsed.providers.openai.enabled).toBe(false);
    expect(parsed.providers.anthropic.headers).toEqual({ "x-proxy-auth": "token-123" });
    expect(parsed.providers.anthropic.api).toBe("anthropic-messages");
    expect(parsed.providers.openai.api).toBeNull();
    expect(parsed.providers.anthropic.models["claude-sonnet-4-6"].displayName).toBe("Sonnet 4.6");
    expect(parsed.providers.anthropic.models["claude-sonnet-4-6"].context).toBe(200000);
    expect(parsed.providers.anthropic.models["claude-sonnet-4-6"].reasoning).toBe(true);
  });

  it("defaults to an empty provider map", () => {
    const parsed = ProvidersFileSchema.parse({ version: 1 });
    expect(parsed.defaultModel).toBeNull();
    expect(parsed.providers).toEqual({});
  });

  it("defaults provider headers/models to empty when absent", () => {
    const parsed = ProvidersFileSchema.parse({
      version: 1,
      providers: { ollama: { baseUrl: "http://localhost:11434/v1" } },
    });
    expect(parsed.providers.ollama.enabled).toBe(true);
    expect(parsed.providers.ollama.headers).toEqual({});
    expect(parsed.providers.ollama.models).toEqual({});
  });
});

describe("cron + channels contracts", () => {
  it("accepts a per-agent cron jobs file with defaults", () => {
    const parsed = CronJobsFileSchema.parse({
      version: 1,
      agentId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
      jobs: [
        {
          id: "01BX5ZZKBKACTAV9WEVGEMMVRZ",
          type: "every",
          schedule: "60",
          prompt: "回顾今天的待办并给出建议",
          createdAt: "2026-06-20T08:00:00.000Z",
        },
      ],
    });
    expect(parsed.jobs[0].enabled).toBe(true);
    expect(parsed.jobs[0].nextRunAt).toBeNull();
    expect(parsed.jobs[0].type).toBe("every");
  });

  it("rejects an unknown cron job type", () => {
    expect(() =>
      CronJobsFileSchema.parse({
        version: 1,
        agentId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
        jobs: [
          {
            id: "01BX5ZZKBKACTAV9WEVGEMMVRZ",
            type: "hourly",
            schedule: "x",
            prompt: "y",
            createdAt: "2026-06-20T08:00:00.000Z",
          },
        ],
      }),
    ).toThrow();
  });

  it("accepts a channels file", () => {
    const parsed = ChannelsFileSchema.parse({
      version: 1,
      channels: [
        {
          id: "01BX5ZZKBKACTAV9WEVGEMMVRZ",
          name: "研究小组",
          members: ["01ARZ3NDEKTSV4RRFFQ69G5FAV"],
          createdAt: "2026-06-20T08:00:00.000Z",
        },
      ],
    });
    expect(parsed.channels[0].members).toHaveLength(1);
  });
});

describe("bridge bindings contract", () => {
  it("accepts the golden bridge fixture", async () => {
    const parsed = BridgeBindingsFileSchema.parse(await readFixture("bridge.json"));
    expect(parsed.version).toBe(1);
    const feishu = parsed.bindings.find((b) => b.platform === "feishu");
    expect(feishu?.agentId).toBe("01ARZ3NDEKTSV4RRFFQ69G5FAV");
    expect(feishu?.enabled).toBe(true);
    const wechat = parsed.bindings.find((b) => b.platform === "wechat");
    expect(wechat?.agentId).toBeNull();
    expect(wechat?.enabled).toBe(false);
  });

  it("defaults binding fields and rejects unknown platform", () => {
    const parsed = BridgeBindingsFileSchema.parse({
      version: 1,
      bindings: [{ platform: "feishu" }],
    });
    expect(parsed.bindings[0].agentId).toBeNull();
    expect(parsed.bindings[0].enabled).toBe(false);
    expect(parsed.bindings[0].label).toBe("");

    expect(() =>
      BridgeBindingsFileSchema.parse({
        version: 1,
        bindings: [{ platform: "discord" }],
      }),
    ).toThrow();
  });
});
