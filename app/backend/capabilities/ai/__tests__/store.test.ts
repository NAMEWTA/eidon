import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { setRuntimePaths } from "../../runtime-paths";
import {
  configuredProviders,
  readAuth,
  readProviders,
  removeModelMeta,
  setApiKey,
  setModelMeta,
  setProviderConfig,
  writeProviders,
} from "../providers-store";
import {
  deleteAgent,
  listAgentIds,
  readAgentConfig,
  readExperience,
  readIdentity,
  readIshiki,
  readPinned,
  writeAgentConfig,
  writeExperience,
  writeIdentity,
  writeIshiki,
  writePinned,
} from "../agent-store";
import type { AgentConfig } from "@shared/contracts";

let home: string;

beforeAll(async () => {
  home = await mkdtemp(join(tmpdir(), "eidon-ai-"));
  setRuntimePaths({ userData: "", userConfig: "", dicts: "", aiHome: home });
});

afterAll(async () => {
  await rm(home, { recursive: true, force: true });
});

const makeAgent = (id: string, name: string): AgentConfig => ({
  version: 1,
  id,
  name,
  description: "",
  avatar: null,
  model: { provider: "anthropic", id: "claude-sonnet-4-6" },
  params: { thinkingLevel: "medium", temperature: null },
  tools: { enabled: [], disabled: [] },
  skills: { enabled: [] },
  commands: { enabled: [] },
  visibility: "private",
  activatableByAgents: false,
  channelsEnabled: false,
  experience: { enabled: false },
  yuan: null,
  createdAt: "2026-06-20T08:00:00.000Z",
  updatedAt: "2026-06-20T08:00:00.000Z",
});

describe("providers-store", () => {
  it("returns empty defaults before any write", async () => {
    const providers = await readProviders();
    expect(providers.version).toBe(1);
    expect(providers.providers).toEqual({});
  });

  it("round-trips providers + default model", async () => {
    await writeProviders({
      version: 1,
      defaultModel: { provider: "anthropic", id: "claude-sonnet-4-6" },
      providers: { anthropic: { enabled: true, baseUrl: null, api: null, headers: {}, models: {} } },
    });
    const back = await readProviders();
    expect(back.defaultModel).toEqual({ provider: "anthropic", id: "claude-sonnet-4-6" });
    expect(back.providers.anthropic.enabled).toBe(true);
  });

  it("merges provider config (baseUrl/headers) and per-model metadata", async () => {
    await setProviderConfig("ollama", {
      baseUrl: "http://localhost:11434/v1",
      headers: { "x-proxy": "p" },
    });
    await setModelMeta("ollama", "qwen3", {
      displayName: "Qwen3",
      context: 32768,
      maxOutput: null,
      image: false,
      video: false,
      audio: false,
      reasoning: true,
    });
    const back = await readProviders();
    expect(back.providers.ollama.baseUrl).toBe("http://localhost:11434/v1");
    expect(back.providers.ollama.headers).toEqual({ "x-proxy": "p" });
    expect(back.providers.ollama.models.qwen3.displayName).toBe("Qwen3");
    expect(back.providers.ollama.models.qwen3.reasoning).toBe(true);
    // 合并语义：再设 enabled 不应抹掉已存的 models/headers。
    await setProviderConfig("ollama", { enabled: false });
    const back2 = await readProviders();
    expect(back2.providers.ollama.enabled).toBe(false);
    expect(back2.providers.ollama.models.qwen3.context).toBe(32768);
    // api 覆盖可写入并合并保留。
    await setProviderConfig("ollama", { api: "openai-completions" });
    expect((await readProviders()).providers.ollama.api).toBe("openai-completions");
    // removeModelMeta 删单个已添加模型，其余配置不动。
    await removeModelMeta("ollama", "qwen3");
    const back3 = await readProviders();
    expect(back3.providers.ollama.models.qwen3).toBeUndefined();
    expect(back3.providers.ollama.api).toBe("openai-completions");
  });

  it("sets and clears api keys, restricts auth file mode", async () => {
    await setApiKey("anthropic", "sk-test-123");
    expect([...(await configuredProviders())]).toEqual(["anthropic"]);
    const auth = await readAuth();
    expect(auth.keys.anthropic).toBe("sk-test-123");

    // auth.json 应为 0o600（仅属主读写）。
    const info = await stat(join(home, "auth.json"));
    expect(info.mode & 0o777).toBe(0o600);

    await setApiKey("anthropic", "");
    expect([...(await configuredProviders())]).toEqual([]);
  });
});

describe("agent-store", () => {
  const id = "01ARZ3NDEKTSV4RRFFQ69G5FAV";

  it("writes, lists, and reads an agent config", async () => {
    await writeAgentConfig(makeAgent(id, "测试助手"));
    expect(await listAgentIds()).toContain(id);
    const back = await readAgentConfig(id);
    expect(back?.name).toBe("测试助手");
    expect(back?.model).toEqual({ provider: "anthropic", id: "claude-sonnet-4-6" });
  });

  it("round-trips identity.md", async () => {
    await writeIdentity(id, "# 你是一个测试助手\n");
    expect(await readIdentity(id)).toContain("测试助手");
  });

  it("round-trips ishiki / experience / pinned docs", async () => {
    await writeIshiki(id, "# 意识\n温暖而克制。\n");
    await writeExperience(id, "# 写作\n1. 先列提纲\n");
    await writePinned(id, "- 用户生日 1 月 1 日\n");
    expect(await readIshiki(id)).toContain("温暖而克制");
    expect(await readExperience(id)).toContain("先列提纲");
    expect(await readPinned(id)).toContain("用户生日");
    // 未写过的 agent 文档应为 null。
    expect(await readIshiki("01BX5ZZKBKACTAV9WEVGEMMVRZ")).toBeNull();
  });

  it("rejects unsafe ids", async () => {
    await expect(readAgentConfig("../escape")).rejects.toThrow(/unsafe/);
  });

  it("deletes an agent folder", async () => {
    await deleteAgent(id);
    expect(await listAgentIds()).not.toContain(id);
    expect(await readAgentConfig(id)).toBeNull();
  });
});
