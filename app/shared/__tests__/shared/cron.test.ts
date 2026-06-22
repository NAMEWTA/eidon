import { describe, expect, it } from "vitest";

import { computeNextRun, nextCronTime } from "@shared/utils";

describe("computeNextRun", () => {
  it("returns the fixed ISO time for 'at'", () => {
    expect(computeNextRun("at", "2026-07-01T09:00:00.000Z", new Date("2026-06-20T00:00:00Z"))).toBe(
      "2026-07-01T09:00:00.000Z",
    );
  });

  it("adds the interval for 'every'", () => {
    const from = new Date("2026-06-20T00:00:00.000Z");
    expect(computeNextRun("every", "30", from)).toBe("2026-06-20T00:30:00.000Z");
  });

  it("rejects bad 'every' intervals", () => {
    expect(computeNextRun("every", "0", new Date())).toBeNull();
    expect(computeNextRun("every", "abc", new Date())).toBeNull();
  });

  it("returns null for invalid 'at'", () => {
    expect(computeNextRun("at", "not-a-date", new Date())).toBeNull();
  });
});

describe("nextCronTime", () => {
  it("finds the next matching minute for a daily 9am job", () => {
    const from = new Date("2026-06-20T07:30:00.000Z");
    // 9 * * * * → next 09:00 same day (UTC env-dependent; assert it is at minute 0, hour 9 local)
    const next = nextCronTime("0 9 * * *", from);
    expect(next).not.toBeNull();
    expect(next!.getMinutes()).toBe(0);
    expect(next!.getHours()).toBe(9);
  });

  it("supports step and list fields", () => {
    const from = new Date("2026-06-20T00:00:00.000Z");
    const next = nextCronTime("*/15 * * * *", from);
    expect(next).not.toBeNull();
    expect([0, 15, 30, 45]).toContain(next!.getMinutes());
  });

  it("rejects malformed expressions", () => {
    expect(nextCronTime("* * *", new Date())).toBeNull();
    expect(nextCronTime("", new Date())).toBeNull();
  });
});
