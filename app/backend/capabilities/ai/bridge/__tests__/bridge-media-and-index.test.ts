import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { setRuntimePaths } from "../../../runtime-paths";
import { agentSessionsDir } from "../../paths";
import {
  getBridgeSessionFile,
  reconcileBridgeIndex,
  setBridgeSessionFile,
} from "../bridge-session-index";
import {
  createIlinkMediaAesKey,
  decodeIlinkMediaAesKey,
  encodeIlinkMediaAesKey,
} from "../wechat-media-crypto";

let home: string;
const AGENT = "01ARZ3NDEKTSV4RRFFQ69G5FAV";

beforeAll(async () => {
  home = await mkdtemp(join(tmpdir(), "eidon-bridge-"));
  setRuntimePaths({ userData: "", userConfig: "", dicts: "", aiHome: home });
});

afterAll(async () => {
  await rm(home, { recursive: true, force: true });
});

describe("wechat-media-crypto", () => {
  it("round-trips a hex aes key through protocol encoding", () => {
    const { aesKeyHex } = createIlinkMediaAesKey();
    const decoded = decodeIlinkMediaAesKey(encodeIlinkMediaAesKey(aesKeyHex));
    expect(decoded.toString("hex")).toBe(aesKeyHex);
    expect(decoded.length).toBe(16);
  });

  it("decodes a raw 16-byte key form", () => {
    const raw = Buffer.from("00112233445566778899aabbccddeeff", "hex");
    const decoded = decodeIlinkMediaAesKey(raw.toString("base64"));
    expect(decoded.equals(raw)).toBe(true);
  });

  it("rejects invalid key lengths", () => {
    expect(() => decodeIlinkMediaAesKey(Buffer.from("short").toString("base64"))).toThrow(/length/);
  });
});

describe("bridge-session-index", () => {
  it("records and resolves a session file that exists on disk", async () => {
    const dir = agentSessionsDir(AGENT);
    await mkdir(dir, { recursive: true });
    const file = join(dir, "sess-1.jsonl");
    await writeFile(file, "{}\n");
    const key = `wechat_dm_u1@${AGENT}`;
    setBridgeSessionFile(AGENT, key, file, { senderName: "u1" });
    expect(getBridgeSessionFile(AGENT, key)).toBe(file);
  });

  it("returns null and reconciles away an entry whose file is gone", async () => {
    const dir = agentSessionsDir(AGENT);
    await mkdir(dir, { recursive: true });
    const file = join(dir, "sess-2.jsonl");
    await writeFile(file, "{}\n");
    const key = `wechat_dm_u2@${AGENT}`;
    setBridgeSessionFile(AGENT, key, file);
    await rm(file);
    expect(getBridgeSessionFile(AGENT, key)).toBeNull();
    reconcileBridgeIndex(AGENT); // 不抛 + 清理孤儿
    expect(getBridgeSessionFile(AGENT, key)).toBeNull();
  });

  it("ignores files outside the agent sessions dir (path-escape guard)", () => {
    const key = `wechat_dm_evil@${AGENT}`;
    setBridgeSessionFile(AGENT, key, join(home, "outside.jsonl"));
    expect(getBridgeSessionFile(AGENT, key)).toBeNull();
  });
});
