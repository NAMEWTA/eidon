/**
 * backend/capabilities/ai/store —— 带 zod 校验的 JSON 读写（纯 node）。
 *
 * 读：缺文件 / 坏 JSON / 契约不符一律回退 `fallback`（与 todos/node 同范式，满足「可重建」铁律）。
 * 写：先 `.parse()` 校验，再「写临时文件 + rename」原子落盘（避免半截写坏文件）。
 */
import { promises as fs } from "node:fs";
import { dirname } from "node:path";
import type { z } from "zod";

/** 读 + 校验；任何失败回退 fallback（不抛）。 */
export async function readJson<T>(
  schema: z.ZodType<T>,
  path: string,
  fallback: T,
): Promise<T> {
  try {
    const raw = await fs.readFile(path, "utf8");
    const parsed = schema.safeParse(JSON.parse(raw));
    if (parsed.success) return parsed.data;
  } catch {
    // 缺文件 / 不可读 / 坏 JSON → fallback
  }
  return fallback;
}

/** 校验 + 原子写（临时文件 → rename）。`mode` 可设凭证文件权限（如 0o600）。 */
export async function writeJson<T>(
  schema: z.ZodType<T>,
  path: string,
  data: T,
  mode?: number,
): Promise<T> {
  const validated = schema.parse(data);
  await fs.mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tmp, JSON.stringify(validated, null, 2), mode ? { mode } : undefined);
  await fs.rename(tmp, path);
  return validated;
}
