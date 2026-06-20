/**
 * 云盘探测 + 跨设备会话。
 *
 * cloudDetect：纯路径字符串分析（不碰文件系统），判定 iCloud/Dropbox/OneDrive/GoogleDrive。
 * deviceId：`~/.eidon-device-id` 持久 UUID（缺失则 crypto.randomUUID 生成并落盘）。
 * session*：`<workspace>/.eidon-sync/session.<deviceId>.json` 存开页 + 光标；云盘自行同步。
 * provider 取值与 renderer stores/cloudSync.ts 字面量一致：none/icloud/dropbox/onedrive/google_drive。
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import type {
  CloudFolderInfo,
  CloudProvider,
  SessionPayload,
  SiblingSession,
} from "@shared/models";

const DEVICE_ID_FILE = ".eidon-device-id";
const SESSIONS_DIR = ".eidon-sync";

// ── 云盘探测 ────────────────────────────────────────────────────────
export function cloudDetect(folder: string): CloudFolderInfo {
  const s = folder.toLowerCase();
  const has = (...needles: string[]): boolean => needles.some((n) => s.includes(n));

  if (has("/library/mobile documents/", "\\library\\mobile documents\\")) {
    return { provider: "icloud", label: "iCloud Drive" };
  }
  if (has("/dropbox/", "/dropbox (", "\\dropbox\\", "\\dropbox (")) {
    return { provider: "dropbox", label: "Dropbox" };
  }
  if (has("/onedrive/", "/onedrive - ", "\\onedrive\\", "\\onedrive - ")) {
    return { provider: "onedrive", label: "OneDrive" };
  }
  if (
    has(
      "/cloudstorage/googledrive-",
      "\\cloudstorage\\googledrive-",
      "/google drive/",
      "\\google drive\\",
      ":\\my drive\\",
    )
  ) {
    return { provider: "google_drive", label: "Google Drive" };
  }
  return { provider: "none" satisfies CloudProvider, label: "" };
}

// ── 设备 ID ─────────────────────────────────────────────────────────
function deviceIdPath(): string | null {
  const home = process.env.HOME || process.env.USERPROFILE || os.homedir();
  return home ? path.join(home, DEVICE_ID_FILE) : null;
}

export async function deviceIdGetOrCreate(): Promise<string> {
  const p = deviceIdPath();
  if (!p) throw new Error("no HOME directory");
  try {
    const existing = (await fs.readFile(p, "utf8")).trim();
    if (existing) return existing;
  } catch {
    /* 不存在 → 新建 */
  }
  const id = crypto.randomUUID();
  await fs.writeFile(p, id);
  return id;
}

// ── 会话 ────────────────────────────────────────────────────────────
function sessionsDir(workspace: string): string {
  return path.join(workspace, SESSIONS_DIR);
}

function sessionPath(workspace: string, deviceId: string): string {
  return path.join(sessionsDir(workspace), `session.${deviceId}.json`);
}

export async function sessionSave(folder: string, payload: SessionPayload): Promise<void> {
  await fs.mkdir(sessionsDir(folder), { recursive: true });
  await fs.writeFile(
    sessionPath(folder, payload.deviceId),
    JSON.stringify(payload, null, 2),
  );
}

export async function sessionLoad(
  folder: string,
  deviceId: string,
): Promise<SessionPayload | null> {
  const target = sessionPath(folder, deviceId);
  try {
    const raw = await fs.readFile(target, "utf8");
    return JSON.parse(raw) as SessionPayload;
  } catch {
    return null;
  }
}

export async function sessionListOthers(
  folder: string,
  ourDeviceId: string,
): Promise<SiblingSession[]> {
  const dir = sessionsDir(folder);
  let dirents;
  try {
    dirents = await fs.readdir(dir);
  } catch {
    return [];
  }
  const out: SiblingSession[] = [];
  for (const name of dirents) {
    const id = name.startsWith("session.") && name.endsWith(".json")
      ? name.slice("session.".length, name.length - ".json".length)
      : null;
    if (!id || id === ourDeviceId) continue;
    let session: SessionPayload;
    try {
      session = JSON.parse(await fs.readFile(path.join(dir, name), "utf8")) as SessionPayload;
    } catch {
      continue;
    }
    out.push({
      deviceId: id,
      deviceLabel: session.deviceLabel,
      savedAt: session.savedAt,
      tabCount: session.tabs.length,
    });
  }
  out.sort((a, b) => b.savedAt - a.savedAt);
  return out;
}
