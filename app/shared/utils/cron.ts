/**
 * shared/utils/cron —— 定时任务下次触发时刻的纯计算（框架无关、可单测）。
 *
 * 支持三种调度（见 contracts/ai CronJobType）：
 *  - `at`    一次性：schedule = ISO 8601 时刻（固定，跑后由 store 置 enabled=false）。
 *  - `every` 周期：schedule = 间隔分钟数（字符串）。
 *  - `cron`  标准 5 段表达式（分 时 日 月 周），支持 通配、步长(slash-n)、范围(a-b)、列表(a,b,c)。
 */
import type { CronJobType } from "../contracts";

/** 解析单个 cron 字段为允许值集合。 */
function parseField(field: string, min: number, max: number): Set<number> {
  const out = new Set<number>();
  for (const part of field.split(",")) {
    let step = 1;
    let range = part;
    const slash = part.indexOf("/");
    if (slash >= 0) {
      step = Number(part.slice(slash + 1));
      range = part.slice(0, slash);
    }
    if (!Number.isFinite(step) || step <= 0) continue;
    let lo = min;
    let hi = max;
    if (range !== "*") {
      const dash = range.indexOf("-");
      if (dash >= 0) {
        lo = Number(range.slice(0, dash));
        hi = Number(range.slice(dash + 1));
      } else {
        lo = hi = Number(range);
      }
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) continue;
    for (let v = lo; v <= hi; v += step) {
      if (v >= min && v <= max) out.add(v);
    }
  }
  return out;
}

/** 下一个匹配 cron 表达式的分钟时刻（>from）；无效/一年内无匹配返回 null。 */
export function nextCronTime(expr: string, from: Date): Date | null {
  const fields = expr.trim().split(/\s+/);
  if (fields.length !== 5) return null;
  const [minF, hourF, domF, monF, dowF] = fields;
  const minutes = parseField(minF, 0, 59);
  const hours = parseField(hourF, 0, 23);
  const doms = parseField(domF, 1, 31);
  const mons = parseField(monF, 1, 12);
  const dows = parseField(dowF, 0, 6);
  if (![minutes, hours, doms, mons, dows].every((s) => s.size > 0)) return null;

  const domRestricted = domF !== "*";
  const dowRestricted = dowF !== "*";

  const d = new Date(from.getTime());
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() + 1);
  for (let i = 0; i < 366 * 24 * 60; i++) {
    const dayMatch =
      domRestricted && dowRestricted
        ? doms.has(d.getDate()) || dows.has(d.getDay())
        : (!domRestricted || doms.has(d.getDate())) && (!dowRestricted || dows.has(d.getDay()));
    if (
      minutes.has(d.getMinutes()) &&
      hours.has(d.getHours()) &&
      mons.has(d.getMonth() + 1) &&
      dayMatch
    ) {
      return new Date(d.getTime());
    }
    d.setMinutes(d.getMinutes() + 1);
  }
  return null;
}

/** 计算某任务在 `from` 之后的下次触发时刻（ISO）；无法计算返回 null。 */
export function computeNextRun(
  type: CronJobType,
  schedule: string,
  from: Date,
): string | null {
  if (type === "at") {
    const at = new Date(schedule);
    return Number.isNaN(at.getTime()) ? null : at.toISOString();
  }
  if (type === "every") {
    const minutes = Number(schedule);
    if (!Number.isFinite(minutes) || minutes <= 0) return null;
    return new Date(from.getTime() + minutes * 60_000).toISOString();
  }
  if (type === "cron") {
    const next = nextCronTime(schedule, from);
    return next ? next.toISOString() : null;
  }
  return null;
}
