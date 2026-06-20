import { describe, expect, it } from "vitest";

import type { AggregatedTodo, TodoFileStore } from "@backend/domain/todos";
import {
  collectDue,
  earliestFireAt,
  emptyTodoFile,
  nextFireTime,
  readNodeTodos,
  scanTodos,
  todosRelPath,
  writeNodeTodos,
} from "@backend/domain/todos";
import type { Reminder, TodoItem } from "@shared/contracts";

const reminder = (over: Partial<Reminder> = {}): Reminder => ({
  id: "01BX5ZZKBKACTAV9WEVGEMMVS0",
  fireAt: "2026-06-20T01:00:00.000Z",
  repeat: "once",
  notified: false,
  ...over,
});

const item = (over: Partial<TodoItem> = {}): TodoItem => ({
  id: "01BX5ZZKBKACTAV9WEVGEMMVRZ",
  text: "task",
  done: false,
  createdAt: "2026-06-13T08:00:00.000Z",
  due: null,
  priority: "normal",
  reminders: [],
  ...over,
});

const agg = (it: TodoItem): AggregatedTodo => ({
  nodeId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
  nodePath: "项目/子项/笔记",
  item: it,
});

// 内存文件 store（测试用，键=workspace 相对路径）。
const memStore = (seed: Record<string, string> = {}): TodoFileStore & { files: Map<string, string> } => {
  const files = new Map(Object.entries(seed));
  return {
    files,
    async readFile(p) {
      const v = files.get(p);
      if (v === undefined) throw new Error(`ENOENT ${p}`);
      return v;
    },
    async writeFile(p, c) {
      files.set(p, c);
    },
  };
};

describe("nextFireTime", () => {
  it("returns null for one-off reminders", () => {
    expect(nextFireTime(reminder({ repeat: "once" }), new Date("2026-06-21T00:00:00.000Z"))).toBeNull();
  });

  it("advances daily strictly past now, skipping missed cycles", () => {
    const r = reminder({ repeat: "daily", fireAt: "2026-06-01T09:00:00.000Z" });
    const next = nextFireTime(r, new Date("2026-06-05T10:00:00.000Z"));
    // 下一个晚于 now 的每日时刻 = 6/6 09:00
    expect(next).toBe(new Date("2026-06-06T09:00:00.000Z").toISOString());
  });

  it("advances weekly", () => {
    const r = reminder({ repeat: "weekly", fireAt: "2026-06-01T09:00:00.000Z" });
    const next = nextFireTime(r, new Date("2026-06-02T00:00:00.000Z"));
    expect(next).toBe(new Date("2026-06-08T09:00:00.000Z").toISOString());
  });

  it("clamps monthly day overflow", () => {
    const r = reminder({ repeat: "monthly", fireAt: "2026-01-31T09:00:00.000Z" });
    const next = nextFireTime(r, new Date("2026-02-01T00:00:00.000Z"));
    // 1/31 + 1 月 → 钳到 2 月最后一日（按本地墙钟）
    const d = new Date(next!);
    expect(d.getMonth()).toBe(1); // February
  });
});

describe("collectDue", () => {
  const now = new Date("2026-06-20T02:00:00.000Z");

  it("collects past-due, pending reminders with node context", () => {
    const due = collectDue([agg(item({ reminders: [reminder({ fireAt: "2026-06-20T01:00:00.000Z" })] }))], now);
    expect(due).toHaveLength(1);
    expect(due[0].nodePath).toBe("项目/子项/笔记");
    expect(due[0].text).toBe("task");
  });

  it("ignores future, notified, and done reminders", () => {
    const future = agg(item({ reminders: [reminder({ fireAt: "2026-06-21T00:00:00.000Z" })] }));
    const notified = agg(item({ reminders: [reminder({ notified: true })] }));
    const done = agg(item({ done: true, reminders: [reminder()] }));
    expect(collectDue([future, notified, done], now)).toHaveLength(0);
  });
});

describe("earliestFireAt", () => {
  it("returns the minimum pending fireAt timestamp", () => {
    const a = agg(item({ id: "01BX5ZZKBKACTAV9WEVGEMMVR1", reminders: [reminder({ fireAt: "2026-06-25T00:00:00.000Z" })] }));
    const b = agg(item({ id: "01BX5ZZKBKACTAV9WEVGEMMVR2", reminders: [reminder({ id: "01BX5ZZKBKACTAV9WEVGEMMVS1", fireAt: "2026-06-22T00:00:00.000Z" })] }));
    expect(earliestFireAt([a, b])).toBe(new Date("2026-06-22T00:00:00.000Z").getTime());
  });

  it("returns null when nothing is pending", () => {
    expect(earliestFireAt([agg(item({ done: true, reminders: [reminder()] }))])).toBeNull();
  });
});

describe("disk IO", () => {
  it("reads back an empty file when none exists", async () => {
    const store = memStore();
    const file = await readNodeTodos(store, "项目/子项/笔记", "01ARZ3NDEKTSV4RRFFQ69G5FAV");
    expect(file.items).toEqual([]);
    expect(file.nodeId).toBe("01ARZ3NDEKTSV4RRFFQ69G5FAV");
  });

  it("round-trips write → read at the .node/todos.json path", async () => {
    const store = memStore();
    const path = "项目/子项/笔记";
    await writeNodeTodos(store, path, {
      ...emptyTodoFile("01ARZ3NDEKTSV4RRFFQ69G5FAV"),
      items: [item({ reminders: [reminder()] })],
    });
    expect(store.files.has(todosRelPath(path))).toBe(true);
    const back = await readNodeTodos(store, path, "01ARZ3NDEKTSV4RRFFQ69G5FAV");
    expect(back.items).toHaveLength(1);
    expect(back.items[0].reminders[0].fireAt).toBe("2026-06-20T01:00:00.000Z");
  });

  it("falls back to empty on corrupt JSON", async () => {
    const path = "项目/子项/笔记";
    const store = memStore({ [todosRelPath(path)]: "{not json" });
    const file = await readNodeTodos(store, path, "01ARZ3NDEKTSV4RRFFQ69G5FAV");
    expect(file.items).toEqual([]);
  });

  it("scanTodos flattens across nodes", async () => {
    const p1 = "a/b/c";
    const p2 = "x/y/z";
    const store = memStore({
      [todosRelPath(p1)]: JSON.stringify({ ...emptyTodoFile("01ARZ3NDEKTSV4RRFFQ69G5FAV"), items: [item()] }),
      [todosRelPath(p2)]: JSON.stringify({ ...emptyTodoFile("01BX5ZZKBKACTAV9WEVGEMMVRZ"), items: [item({ id: "01BX5ZZKBKACTAV9WEVGEMMVR2" }), item({ id: "01BX5ZZKBKACTAV9WEVGEMMVR3" })] }),
    });
    const flat = await scanTodos(store, [
      { nodeId: "01ARZ3NDEKTSV4RRFFQ69G5FAV", nodePath: p1 },
      { nodeId: "01BX5ZZKBKACTAV9WEVGEMMVRZ", nodePath: p2 },
    ]);
    expect(flat).toHaveLength(3);
    expect(flat.map((f) => f.nodePath)).toEqual([p1, p2, p2]);
  });
});
