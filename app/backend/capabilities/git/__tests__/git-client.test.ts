import { describe, it, expect, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { relPath } from "../git-client";

describe("relPath", () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    for (const fn of cleanups.splice(0).reverse()) {
      await fn().catch(() => {});
    }
  });

  it("resolves relative path for a file under the workspace root", async () => {
    const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "eidon-git-rel-")));
    cleanups.push(() => fs.rm(root, { recursive: true, force: true }));

    const file = path.join(root, "222", "3", "4", "README.md");
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, "# test\n");

    expect(relPath(root, file)).toBe("222/3/4/README.md");
  });

  it("resolves when workspace root is a symlink alias", async () => {
    const realRoot = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "eidon-git-real-")));
    cleanups.push(() => fs.rm(realRoot, { recursive: true, force: true }));

    const linkRoot = path.join(os.tmpdir(), `eidon-git-link-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.symlink(realRoot, linkRoot);
    cleanups.push(() => fs.unlink(linkRoot));

    const file = path.join(realRoot, "222", "3", "4", "README.md");
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, "# test\n");

    expect(relPath(linkRoot, file)).toBe("222/3/4/README.md");
    expect(relPath(realRoot, path.join(linkRoot, "222/3/4/README.md"))).toBe("222/3/4/README.md");
  });

  it("returns null for paths outside the workspace", async () => {
    const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "eidon-git-out-")));
    cleanups.push(() => fs.rm(root, { recursive: true, force: true }));

    const outside = path.join(os.tmpdir(), `eidon-git-outside-${Date.now()}.md`);
    await fs.writeFile(outside, "x");
    cleanups.push(() => fs.unlink(outside));

    expect(relPath(root, outside)).toBeNull();
  });
});
