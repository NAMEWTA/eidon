/**
 * file-ops + encoding 能力测试。覆盖编码检测保真（编码检测保真）
 * 与文件树编辑行为（拒绝覆盖 / 幂等删除 / .assets 跟随 + 引用改写 / 隐藏过滤 + 目录优先排序）。
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { detectAndDecode, encodeContent } from "../encoding";
import * as fileOps from "../file-ops";

describe("encoding round-trip", () => {
  it("UTF-8 文本编码后能正确探测解码", () => {
    const text = "héllo 世界 — café ☕";
    const r = detectAndDecode(encodeContent(text, "UTF-8"));
    expect(r.content).toBe(text);
  });

  it("GBK 中文段落读→写→读保真", () => {
    // 给足信号以稳定探测：多句中文。
    const text =
      "这是一段用于编码检测的中文文本，包含常用汉字、标点符号，以及足够的长度来提升 jschardet 的判定置信度。";
    const buf = encodeContent(text, "GBK");
    const r = detectAndDecode(buf);
    expect(r.content).toBe(text);
    expect(r.encoding).toBe("GBK");
  });

  it("UTF-8 BOM 被识别且剥离", () => {
    const buf = Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from("# 标题", "utf8"),
    ]);
    const r = detectAndDecode(buf);
    expect(r.content).toBe("# 标题");
    expect(r.hadBom).toBe(true);
    expect(r.encoding).toBe("UTF-8");
  });

  it("UTF-16LE BOM 被识别且正确解码", () => {
    const buf = Buffer.concat([
      Buffer.from([0xff, 0xfe]),
      Buffer.from("hi 世界", "utf16le"),
    ]);
    const r = detectAndDecode(buf);
    expect(r.content).toBe("hi 世界");
    expect(r.hadBom).toBe(true);
    expect(r.encoding).toBe("UTF-16LE");
  });
});

describe("file-ops", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "eidon-fo-"));
  });
  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  const read = (p: string) => fs.readFile(p, "utf8");
  const there = async (p: string) =>
    fs.access(p).then(
      () => true,
      () => false,
    );

  it("create / read / 拒绝覆盖", async () => {
    const f = path.join(dir, "note.md");
    await fileOps.createFile(f, "# hi");
    const r = await fileOps.readFile(f);
    expect(r.content).toBe("# hi");
    expect(r.language).toBe("markdown");
    await expect(fileOps.createFile(f, "x")).rejects.toThrow(/already exists/);
  });

  it("listDir 隐藏过滤 + 目录优先排序 + 截断哨兵不在普通列表", async () => {
    await fileOps.createDir(path.join(dir, "zsub"));
    await fileOps.createFile(path.join(dir, "a.md"), "a");
    await fs.writeFile(path.join(dir, ".hidden"), "x");

    const visible = await fileOps.listDir(dir, false);
    expect(visible.some((e) => e.name === ".hidden")).toBe(false);
    expect(visible[0]?.isDir).toBe(true); // 目录优先
    expect(visible.some((e) => e.name === "__eidon_truncated__")).toBe(false);

    const all = await fileOps.listDir(dir, true);
    expect(all.some((e) => e.name === ".hidden")).toBe(true);
  });

  it("delete 幂等", async () => {
    const f = path.join(dir, "gone.md");
    await fileOps.createFile(f, "x");
    await fileOps.deletePath(f);
    await expect(fileOps.deletePath(f)).resolves.toBeUndefined(); // 再删不报错
  });

  it("rename 跟随 .assets 目录并改写正文引用", async () => {
    const f = path.join(dir, "doc.md");
    await fileOps.createFile(f, "见 ![](doc.assets/img.png) 此图");
    await fileOps.createDir(path.join(dir, "doc.assets"));
    await fs.writeFile(path.join(dir, "doc.assets", "img.png"), "png");

    await fileOps.rename(f, path.join(dir, "renamed.md"));

    expect(await there(path.join(dir, "renamed.assets", "img.png"))).toBe(true);
    expect(await there(path.join(dir, "doc.assets"))).toBe(false);
    const body = await read(path.join(dir, "renamed.md"));
    expect(body).toContain("renamed.assets/img.png");
    expect(body).not.toContain("doc.assets/");
  });

  it("rename 拒绝覆盖已存在目标", async () => {
    await fileOps.createFile(path.join(dir, "a.md"), "a");
    await fileOps.createFile(path.join(dir, "b.md"), "b");
    await expect(
      fileOps.rename(path.join(dir, "a.md"), path.join(dir, "b.md")),
    ).rejects.toThrow(/already exists/);
  });
});
