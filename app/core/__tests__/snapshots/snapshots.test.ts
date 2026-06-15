import { describe, expect, it, vi } from "vitest";

import {
  commitSnapshot,
  diffFileSnapshot,
  getSnapshotStatus,
  initSnapshotHistory,
  listFileSnapshots,
  readFileSnapshot,
  restoreFileSnapshot,
  type SnapshotGateway,
} from "../../snapshots";

const makeGateway = (): SnapshotGateway => ({
  workspaceStatus: vi.fn(async () => ({
    initialized: true,
    head_sha: "abc",
    head_message: "init",
    dirty: false,
    branch: "main",
  })),
  initWorkspace: vi.fn(async () => undefined),
  autoCommit: vi.fn(async () => "abcdef0"),
  fileHistory: vi.fn(async () => [{
    sha: "abcdef0",
    short_sha: "abcdef0",
    message: "save",
    author: "EIDON",
    time: 1,
  }]),
  fileDiff: vi.fn(async () => ({
    from_sha: "parent",
    to_sha: "abcdef0",
    hunks: [],
    unified: "",
  })),
  fileAtVersion: vi.fn(async () => "# restored"),
  rollbackFile: vi.fn(async () => undefined),
});

describe("core/snapshots", () => {
  it("maps EIDON snapshot API calls to the existing git gateway without adding snapshot semantics", async () => {
    const gateway = makeGateway();

    await expect(getSnapshotStatus("/workspace", gateway)).resolves.toMatchObject({ initialized: true });
    await initSnapshotHistory("/workspace", { initialMessage: "init: EIDON", excludeAssets: true }, gateway);
    await expect(commitSnapshot("/workspace", { filePath: "/workspace/a.md", message: "save" }, gateway)).resolves.toBe("abcdef0");
    await expect(listFileSnapshots("/workspace", "/workspace/a.md", 25, gateway)).resolves.toHaveLength(1);
    await expect(diffFileSnapshot("/workspace", "/workspace/a.md", "abcdef0", gateway)).resolves.toMatchObject({ to_sha: "abcdef0" });
    await expect(readFileSnapshot("/workspace", "/workspace/a.md", "abcdef0", gateway)).resolves.toBe("# restored");
    await restoreFileSnapshot("/workspace", "/workspace/a.md", "abcdef0", gateway);

    expect(gateway.initWorkspace).toHaveBeenCalledWith("/workspace", "init: EIDON", true);
    expect(gateway.autoCommit).toHaveBeenCalledWith("/workspace", "/workspace/a.md", "save");
    expect(gateway.fileHistory).toHaveBeenCalledWith("/workspace", "/workspace/a.md", 25);
    expect(gateway.rollbackFile).toHaveBeenCalledWith("/workspace", "/workspace/a.md", "abcdef0");
  });
});
