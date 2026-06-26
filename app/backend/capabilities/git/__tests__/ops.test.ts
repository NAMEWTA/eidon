import { describe, it, expect, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { autoCommit, initWorkspace } from "../ops";

describe("autoCommit", () => {
  let root: string;

  afterEach(async () => {
    if (root) await fs.rm(root, { recursive: true, force: true }).catch(() => {});
  });

  it("does not throw when filePath is outside the workspace snapshot root", async () => {
    root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "eidon-git-ops-")));
    await initWorkspace(root, "init test", false);

    const inside = path.join(root, "note.md");
    await fs.writeFile(inside, "hello\n");

    const outside = path.join(os.tmpdir(), `eidon-git-outside-${Date.now()}.md`);
    await fs.writeFile(outside, "outside\n");

    await expect(autoCommit(root, outside, "save")).resolves.toBeTruthy();

    await fs.unlink(outside);
  });

  it("commits a specific inside file when relPath resolves", async () => {
    root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "eidon-git-ops2-")));
    await initWorkspace(root, "init test", false);

    const inside = path.join(root, "222", "3", "4", "README.md");
    await fs.mkdir(path.dirname(inside), { recursive: true });
    await fs.writeFile(inside, "updated\n");

    await expect(autoCommit(root, inside, "save")).resolves.toBeTruthy();
  });
});
