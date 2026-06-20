/**
 * 路径工具。
 *
 * documentDir/tempDir 经 shell:osPaths（main 用 app.getPath 解析），结果缓存一次。
 * sep 固定 '/'（Electron/Node 在三平台都接受正斜杠路径）；join 走简单 POSIX 拼接。
 */
import { eidonInvoke } from "./client";

let cached: { documents: string; temp: string; home: string } | null = null;

async function osPaths(): Promise<{ documents: string; temp: string; home: string }> {
  if (!cached) cached = await eidonInvoke("shell:osPaths", {});
  return cached;
}

export async function documentDir(): Promise<string> {
  return (await osPaths()).documents;
}

export async function tempDir(): Promise<string> {
  return (await osPaths()).temp;
}

export function sep(): string {
  return "/";
}

export async function join(...parts: string[]): Promise<string> {
  const joined = parts
    .filter((p) => p !== "" && p != null)
    .join("/")
    .replace(/\\/g, "/")
    .replace(/\/{2,}/g, "/");
  return joined;
}
