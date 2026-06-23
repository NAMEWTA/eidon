/**
 * capabilities/ai/bridge/telegram-adapter —— Telegram Bot 适配器（纯 node，raw Bot API + outboundFetch）。
 *
 * 参考 HanaAgent `lib/bridge/telegram-adapter.ts` 的能力集（getUpdates 长轮询、消息/附件提取、
 * 分段回发、typing、错误退避重启），但传输改用 EIDON 的 {@link outboundFetch}（net.fetch，代理感知）。
 *
 * 为什么不引入 `node-telegram-bot-api`：Telegram（`api.telegram.org`）在中国大陆被墙，**必须经代理**；
 * 该库自带网络栈难保证走系统/环境代理，而 EIDON 的 outboundFetch 天然跟随代理（见 capabilities/ai/net.ts）。
 *
 * 凭证：`deps.creds.token`（@BotFather 颁发的 Bot Token）。文本收发 + typing + 媒体收发（图片/文件）。
 */
import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import { join } from "node:path";

import { outboundFetch } from "../net";
import type {
  BridgeAdapter,
  BridgeAdapterDeps,
  BridgeInboundAttachment,
  BridgeRuntimeState,
} from "./types";

const API_BASE = "https://api.telegram.org";
const LONG_POLL_TIMEOUT_S = 30;
const REQUEST_TIMEOUT_MS = 40_000; // 略大于服务器长轮询 hold，避免误判超时
const MAX_CONSECUTIVE_FAILURES = 3;
const BACKOFF_DELAYS = [2000, 5000, 30_000];
const MSG_CHUNK_LIMIT = 4000; // Telegram 单条上限 4096，留余量
const MAX_MSG_SIZE = 100_000;

interface TgUser {
  id: number;
  first_name?: string;
  username?: string;
}
interface TgChat {
  id: number;
  type: string; // "private" | "group" | "supergroup" | "channel"
}
interface TgFileRef {
  file_id: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
  width?: number;
  height?: number;
}
interface TgMessage {
  message_id: number;
  from?: TgUser;
  chat: TgChat;
  text?: string;
  caption?: string;
  photo?: TgFileRef[];
  document?: TgFileRef;
  voice?: TgFileRef;
  video?: TgFileRef;
}
interface TgUpdate {
  update_id: number;
  message?: TgMessage;
}
interface TgResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

export function createTelegramAdapter(deps: BridgeAdapterDeps): BridgeAdapter {
  const token = deps.creds.token?.trim() ?? "";
  const dir = join(deps.dataDir, "telegram");
  const offsetPath = join(dir, `offset-${crypto.createHash("sha256").update(token).digest("hex").slice(0, 8)}.json`);

  let generation = 0;
  let abort = new AbortController();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let offset = 0;
  let lastState: BridgeRuntimeState | null = null;
  let lastError: string | null = null;

  function report(state: BridgeRuntimeState, error?: string): void {
    const err = error ?? null;
    if (lastState === state && lastError === err) return;
    lastState = state;
    lastError = err;
    deps.onStatus(state, err ?? undefined);
  }

  /** Bot API JSON 调用（POST）。失败（HTTP 或 ok:false）统一抛错。 */
  async function api<T>(method: string, body: unknown = {}, timeoutMs = 15_000): Promise<T> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const onParentAbort = () => ctrl.abort();
    abort.signal.addEventListener("abort", onParentAbort, { once: true });
    try {
      const res = await outboundFetch(`${API_BASE}/bot${token}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      const json = JSON.parse(await res.text()) as TgResponse<T>;
      if (!res.ok || !json.ok) {
        throw new Error(`${method} 失败: ${json.description || `HTTP ${res.status}`}`);
      }
      return json.result as T;
    } finally {
      clearTimeout(timer);
      abort.signal.removeEventListener("abort", onParentAbort);
    }
  }

  /** Bot API multipart 调用（发媒体）；不手动设 Content-Type，由 FormData 自带 boundary。 */
  async function apiForm<T>(method: string, form: FormData, timeoutMs = 30_000): Promise<T> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const onParentAbort = () => ctrl.abort();
    abort.signal.addEventListener("abort", onParentAbort, { once: true });
    try {
      const res = await outboundFetch(`${API_BASE}/bot${token}/${method}`, {
        method: "POST",
        body: form,
        signal: ctrl.signal,
      });
      const json = JSON.parse(await res.text()) as TgResponse<T>;
      if (!res.ok || !json.ok) {
        throw new Error(`${method} 失败: ${json.description || `HTTP ${res.status}`}`);
      }
      return json.result as T;
    } finally {
      clearTimeout(timer);
      abort.signal.removeEventListener("abort", onParentAbort);
    }
  }

  function guardedSleep(ms: number, myGen: number): Promise<boolean> {
    return new Promise((resolve) => {
      const id = setTimeout(() => {
        timers.delete(id);
        resolve(myGen === generation);
      }, ms);
      timers.add(id);
    });
  }

  /** file_id → 下载字节（getFile 取 file_path，再经 file/ 端点取内容）。 */
  async function downloadFile(fileId: string): Promise<Buffer> {
    const file = await api<{ file_path?: string }>("getFile", { file_id: fileId }, 15_000);
    if (!file.file_path) throw new Error("Telegram: getFile 未返回 file_path");
    const res = await outboundFetch(`${API_BASE}/file/bot${token}/${file.file_path}`, { signal: abort.signal });
    if (!res.ok) throw new Error(`Telegram: 文件下载失败 ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }

  /** 抽取入站附件（platformRef = file_id，留待 downloadMedia 解析）。EIDON 附件类型仅 image/file/video。 */
  function extractAttachments(msg: TgMessage): BridgeInboundAttachment[] {
    const out: BridgeInboundAttachment[] = [];
    if (msg.photo?.length) {
      const best = msg.photo[msg.photo.length - 1]; // 取最大尺寸
      out.push({ type: "image", platformRef: best.file_id, mimeType: "image/jpeg" });
    }
    if (msg.document) {
      out.push({
        type: "file",
        platformRef: msg.document.file_id,
        filename: msg.document.file_name,
        mimeType: msg.document.mime_type,
        size: msg.document.file_size,
      });
    }
    if (msg.video) {
      out.push({
        type: "video",
        platformRef: msg.video.file_id,
        filename: msg.video.file_name,
        mimeType: msg.video.mime_type,
      });
    }
    if (msg.voice) {
      out.push({ type: "file", platformRef: msg.voice.file_id, filename: "voice.ogg", mimeType: msg.voice.mime_type });
    }
    return out;
  }

  function handleUpdate(update: TgUpdate): void {
    offset = Math.max(offset, update.update_id + 1);
    const msg = update.message;
    if (!msg?.chat || !msg.from) return;
    let text = msg.text || msg.caption || "";
    if (text.length > MAX_MSG_SIZE) text = text.slice(0, MAX_MSG_SIZE);
    const attachments = extractAttachments(msg);
    if (!text && attachments.length === 0) return;
    deps.onMessage({
      platform: "telegram",
      chatId: String(msg.chat.id),
      userId: String(msg.from.id),
      senderName: msg.from.first_name || msg.from.username || "User",
      text,
      isGroup: msg.chat.type !== "private",
      ...(attachments.length ? { attachments } : {}),
    });
  }

  async function pollLoop(): Promise<void> {
    const myGen = generation;
    let failures = 0;
    while (myGen === generation) {
      try {
        const updates = await api<TgUpdate[]>(
          "getUpdates",
          { offset, timeout: LONG_POLL_TIMEOUT_S, allowed_updates: ["message"] },
          REQUEST_TIMEOUT_MS,
        );
        failures = 0;
        report("online");
        for (const u of updates) {
          try {
            handleUpdate(u);
          } catch {
            // 单条入站失败不阻断轮询。
          }
        }
        if (updates.length) {
          void fs.writeFile(offsetPath, JSON.stringify({ offset })).catch(() => {});
        }
      } catch (err) {
        if (myGen !== generation) return;
        if (err instanceof Error && err.name === "AbortError") continue; // 长轮询超时，正常
        failures++;
        if (failures >= MAX_CONSECUTIVE_FAILURES) {
          report("error", err instanceof Error ? err.message : String(err));
        }
        const delay = BACKOFF_DELAYS[Math.min(failures - 1, BACKOFF_DELAYS.length - 1)];
        if (!(await guardedSleep(delay, myGen))) return;
      }
    }
  }

  return {
    async start() {
      if (!token) throw new Error("Telegram: 缺少 Bot Token，请先在 @BotFather 创建 Bot 并填入");
      generation++;
      abort = new AbortController();
      report("connecting");
      await fs.mkdir(dir, { recursive: true });
      try {
        offset = (JSON.parse(await fs.readFile(offsetPath, "utf8")) as { offset?: number }).offset || 0;
      } catch {
        offset = 0;
      }
      // 快速校验 token：失败则推「错误」状态而非抛出（避免 bind 看起来像崩溃；用户改 token 重连）。
      try {
        await api<TgUser>("getMe", {}, 10_000);
      } catch (err) {
        report("error", err instanceof Error ? err.message : String(err));
        return;
      }
      void pollLoop().catch((err) => report("error", err instanceof Error ? err.message : String(err)));
    },

    async stop() {
      generation++;
      abort.abort();
      abort = new AbortController();
      for (const t of timers) clearTimeout(t);
      timers.clear();
      report("disconnected");
    },

    async sendText(chatId: string, text: string) {
      // 纯文本发送（不带 parse_mode），避免未转义的 Markdown/HTML 被 Telegram 拒收。
      for (let i = 0; i < text.length; i += MSG_CHUNK_LIMIT) {
        await api("sendMessage", { chat_id: chatId, text: text.slice(i, i + MSG_CHUNK_LIMIT) });
      }
    },

    canReply() {
      // Telegram 无微信式 24h 回复窗口：只要有 chatId 即可回。
      return true;
    },

    async sendTyping(chatId: string) {
      await api("sendChatAction", { chat_id: chatId, action: "typing" }, 10_000);
    },
    // 不实现 clearTyping：Telegram typing ~5s 自动消失，无显式清除接口。

    async downloadMedia(platformRef: string) {
      return downloadFile(platformRef);
    },

    async sendMedia(chatId: string, data: Buffer, opts: { mime?: string; filename?: string }) {
      const isImage = opts.mime?.startsWith("image/") ?? false;
      const method = isImage ? "sendPhoto" : "sendDocument";
      const field = isImage ? "photo" : "document";
      const form = new FormData();
      form.append("chat_id", chatId);
      form.append(
        field,
        new Blob([new Uint8Array(data)], { type: opts.mime || "application/octet-stream" }),
        opts.filename || (isImage ? "image.jpg" : "file"),
      );
      await apiForm(method, form);
    },
  };
}
