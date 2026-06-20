/**
 * watcher 自写抑制测试（基于内容哈希，与时序无关）。
 *
 * 锁定回归：本应用自写（writeFile→markSelfWrite）触发的 watcher 回声事件**不得**上报
 * `eidon:file-changed`（否则保存即误报「文件已被外部修改」）；真正的外部内容变更**必须**上报一次。
 * chokidar 与 emit 出口被 mock：直接驱动被捕获的事件回调，配合真实临时文件验证内容比对逻辑。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

// 捕获 chokidar 注册的事件回调，供测试直接驱动。
const cap = vi.hoisted(() => ({
  handlers: {} as Record<string, (p: string) => void>,
  added: [] as string[],
}));

vi.mock("chokidar", () => ({
  watch: () => ({
    on(ev: string, cb: (p: string) => void) {
      cap.handlers[ev] = cb;
      return this;
    },
    add(p: string) {
      cap.added.push(p);
    },
    unwatch() {},
  }),
}));

// 捕获 emit 出口。
const emit = vi.hoisted(() => ({ fn: vi.fn() }));
vi.mock("../../../ipc/emit", () => ({ emitEvent: emit.fn }));

import { watchFile, unwatchFile, markSelfWrite } from "../watcher";

/** 等待 evaluateChange 内的异步 readFile/hash 落定。 */
const tick = () => new Promise((r) => setTimeout(r, 20));

let dir: string;
let file: string;

beforeEach(async () => {
  emit.fn.mockClear();
  // realpath 规整：macOS 的 os.tmpdir() 是 /var→/private/var 符号链接，且文件删除后 realpath 无法
  // 解析符号链接；预先 canonical 化目录，使测试反映普通（非符号链接）路径的真实行为。
  dir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "eidon-watcher-")));
  file = path.join(dir, "README.md");
  await fs.writeFile(file, "initial\n");
});

afterEach(async () => {
  unwatchFile(file);
  await fs.rm(dir, { recursive: true, force: true });
});

describe("watcher 自写抑制（内容哈希）", () => {
  it("自写回声不上报 file-changed", async () => {
    watchFile(file);
    await tick(); // 等待 watchFile 的初始哈希落库

    // 模拟一次自写：写盘 + 登记所写字节，再触发 watcher 的 change 回声。
    const bytes = Buffer.from("edited by app\n", "utf8");
    await fs.writeFile(file, bytes);
    markSelfWrite(file, bytes);
    cap.handlers.change(file);
    await tick();

    expect(emit.fn).not.toHaveBeenCalled();
  });

  it("真实外部内容变更上报一次", async () => {
    watchFile(file);
    await tick();

    // 外部程序改写内容（未登记自写）→ 应上报一次，回传原始路径。
    await fs.writeFile(file, "changed by another program\n");
    cap.handlers.change(file);
    await tick();

    expect(emit.fn).toHaveBeenCalledTimes(1);
    expect(emit.fn).toHaveBeenCalledWith("eidon:file-changed", file);
  });

  it("同一外部内容的重复事件只上报一次", async () => {
    watchFile(file);
    await tick();

    await fs.writeFile(file, "external\n");
    cap.handlers.change(file);
    await tick();
    cap.handlers.change(file); // 内容未再变 → 不应二次上报
    await tick();

    expect(emit.fn).toHaveBeenCalledTimes(1);
  });

  it("外部删除文件上报", async () => {
    watchFile(file);
    await tick();

    await fs.rm(file, { force: true });
    cap.handlers.unlink(file);
    await tick();

    expect(emit.fn).toHaveBeenCalledTimes(1);
    expect(emit.fn).toHaveBeenCalledWith("eidon:file-changed", file);
  });
});
