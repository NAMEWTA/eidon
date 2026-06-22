/**
 * capabilities/ai/bridge/wechat-adapter —— 微信官方 iLink Bridge 适配器（纯 node，文本优先）。
 *
 * 移植自 HanaAgent `lib/bridge/wechat-adapter.ts`（腾讯 iLink 协议 `ilinkai.weixin.qq.com`）：
 * 长轮询 getupdates 收消息 → sendmessage 回发；per-chat `context_token`（24h）才能回复。
 * 文本收发 + cursor/context 持久化 + 媒体收发（图片/文件，AES-128-ECB + CDN 上下行）。
 */
import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import { join } from "node:path";

import { outboundFetch } from "../net";
import {
  createIlinkMediaAesKey,
  decodeIlinkMediaAesKey,
  encodeIlinkMediaAesKey,
} from "./wechat-media-crypto";

import type {
  BridgeAdapter,
  BridgeAdapterDeps,
  BridgeInboundAttachment,
  BridgeRuntimeState,
} from "./types";

const DEFAULT_BASE_URL = "https://ilinkai.weixin.qq.com";
const CDN_BASE_URL = "https://novac2c.cdn.weixin.qq.com/c2c";
const LONG_POLL_TIMEOUT_MS = 40_000;
const MAX_CONSECUTIVE_FAILURES = 3;
const BACKOFF_DELAYS = [2000, 5000, 30_000];
const CONTEXT_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const MSG_CHUNK_LIMIT = 4000;

// iLink 消息项/类型常量。
const ItemType = { TEXT: 1, IMAGE: 2, VOICE: 3, FILE: 4, VIDEO: 5 } as const;
const MessageType = { USER: 1, BOT: 2 } as const;
const MessageState = { FINISH: 2 } as const;
const UploadMediaType = { IMAGE: 1, VIDEO: 2, FILE: 3 } as const;

interface IlinkMedia {
  encrypt_query_param?: string;
  aes_key?: string;
  encrypt_type?: number;
}
interface IlinkItem {
  type: number;
  text_item?: { text?: string };
  voice_item?: { text?: string };
  image_item?: { media?: IlinkMedia; aeskey?: string; mid_size?: number };
  file_item?: { media?: IlinkMedia; file_name?: string; len?: string };
  video_item?: { media?: IlinkMedia };
}
interface IlinkMessage {
  from_user_id?: string;
  context_token?: string;
  item_list?: IlinkItem[];
}
interface IlinkResponse {
  ret?: number;
  errcode?: number;
  errmsg?: string;
  get_updates_buf?: string;
  msgs?: IlinkMessage[];
  typing_ticket?: string;
  upload_param?: string;
}

// ── 媒体 AES-128-ECB 加解密 + CDN URL ──
function encryptAesEcb(plaintext: Buffer, key: Buffer): Buffer {
  const cipher = crypto.createCipheriv("aes-128-ecb", key, null);
  return Buffer.concat([cipher.update(plaintext), cipher.final()]);
}
function decryptAesEcb(ciphertext: Buffer, key: Buffer): Buffer {
  const decipher = crypto.createDecipheriv("aes-128-ecb", key, null);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
function aesEcbPaddedSize(plaintextSize: number): number {
  return Math.ceil((plaintextSize + 1) / 16) * 16;
}
function buildCdnDownloadUrl(encryptedQueryParam: string): string {
  return `${CDN_BASE_URL}/download?encrypted_query_param=${encodeURIComponent(encryptedQueryParam)}`;
}
function buildCdnUploadUrl(uploadParam: string, filekey: string): string {
  return `${CDN_BASE_URL}/upload?encrypted_query_param=${encodeURIComponent(uploadParam)}&filekey=${encodeURIComponent(filekey)}`;
}

/** 从一条 iLink 消息项里抽出媒体附件（platformRef 留待 downloadMedia 解析）。 */
function extractAttachments(items: IlinkItem[] | undefined): BridgeInboundAttachment[] {
  const attachments: BridgeInboundAttachment[] = [];
  for (const item of items ?? []) {
    if (item.type === ItemType.IMAGE && item.image_item?.media?.encrypt_query_param) {
      const aesKey = item.image_item.aeskey
        ? encodeIlinkMediaAesKey(item.image_item.aeskey)
        : item.image_item.media.aes_key;
      attachments.push({
        type: "image",
        platformRef: JSON.stringify({ encrypt_query_param: item.image_item.media.encrypt_query_param, aes_key: aesKey }),
        mimeType: "image/jpeg",
      });
    } else if (item.type === ItemType.FILE && item.file_item?.media?.encrypt_query_param) {
      attachments.push({
        type: "file",
        platformRef: JSON.stringify({ encrypt_query_param: item.file_item.media.encrypt_query_param, aes_key: item.file_item.media.aes_key }),
        filename: item.file_item.file_name,
        size: Number.isFinite(Number(item.file_item.len)) ? Number(item.file_item.len) : undefined,
        mimeType: "application/octet-stream",
      });
    } else if (item.type === ItemType.VIDEO && item.video_item?.media?.encrypt_query_param) {
      attachments.push({
        type: "video",
        platformRef: JSON.stringify({ encrypt_query_param: item.video_item.media.encrypt_query_param, aes_key: item.video_item.media.aes_key }),
        mimeType: "video/mp4",
      });
    }
  }
  return attachments;
}

/** X-WECHAT-UIN：随机 uint32 → 十进制字符串 → base64（防重放）。 */
function randomWechatUin(): string {
  const uint32 = crypto.randomBytes(4).readUInt32BE(0);
  return Buffer.from(String(uint32), "utf-8").toString("base64");
}

function buildHeaders(token: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    AuthorizationType: "ilink_bot_token",
    "X-WECHAT-UIN": randomWechatUin(),
    Authorization: `Bearer ${token}`,
  };
}

function isSessionExpired(err: unknown): boolean {
  return /(?:ret|errcode)=-14\b/.test(String(err instanceof Error ? err.message : err));
}

function extractText(items: IlinkItem[] | undefined): string {
  for (const item of items ?? []) {
    if (item.type === ItemType.TEXT && item.text_item?.text != null) return String(item.text_item.text);
    if (item.type === ItemType.VOICE && item.voice_item?.text) return item.voice_item.text;
  }
  return "";
}

export function createWechatAdapter(deps: BridgeAdapterDeps): BridgeAdapter {
  const botToken = deps.creds.botToken ?? "";
  const baseUrl = deps.creds.baseUrl?.trim() || DEFAULT_BASE_URL;
  const dir = join(deps.dataDir, "wechat");
  const cursorPath = join(dir, `sync-${crypto.createHash("sha256").update(botToken).digest("hex").slice(0, 8)}.json`);

  let generation = 0;
  let abort = new AbortController();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let getUpdatesBuf = "";
  let lastState: BridgeRuntimeState | null = null;
  let lastError: string | null = null;
  const contextTokens = new Map<string, { token: string; ts: number }>();
  // typing_ticket（getconfig 颁发）按 chatId+contextToken 缓存：context 变化即失效重取。
  const typingTickets = new Map<string, { contextToken: string; ticket: string }>();

  function report(state: BridgeRuntimeState, error?: string): void {
    const err = error ?? null;
    if (lastState === state && lastError === err) return;
    lastState = state;
    lastError = err;
    deps.onStatus(state, err ?? undefined);
  }

  async function api<T = IlinkResponse>(endpoint: string, body: unknown, timeoutMs = 15_000): Promise<T> {
    const url = new URL(endpoint, baseUrl.endsWith("/") ? baseUrl : baseUrl + "/");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const onParentAbort = () => ctrl.abort();
    abort.signal.addEventListener("abort", onParentAbort, { once: true });
    try {
      const res = await outboundFetch(url.toString(), {
        method: "POST",
        headers: buildHeaders(botToken),
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`${endpoint} HTTP ${res.status}: ${text}`);
      const json = JSON.parse(text) as IlinkResponse;
      if (json.ret !== undefined && json.ret !== 0) {
        throw new Error(`${endpoint} ret=${json.ret} errcode=${json.errcode ?? ""} errmsg=${json.errmsg ?? ""}`);
      }
      return json as T;
    } finally {
      clearTimeout(timer);
      abort.signal.removeEventListener("abort", onParentAbort);
    }
  }

  function setContextToken(chatId: string, token: string): void {
    contextTokens.set(chatId, { token, ts: Date.now() });
  }
  function getContextToken(chatId: string): string | null {
    const e = contextTokens.get(chatId);
    if (!e) return null;
    if (Date.now() - e.ts > CONTEXT_TOKEN_TTL_MS) {
      contextTokens.delete(chatId);
      return null;
    }
    return e.token;
  }

  // ── 「正在输入」状态（iLink typing_ticket）：getconfig 取票 → sendtyping ──
  async function getTypingTicket(chatId: string): Promise<string> {
    const contextToken = getContextToken(chatId);
    if (!contextToken) throw new Error("微信: 无 context_token，无法获取 typing_ticket");
    const cached = typingTickets.get(chatId);
    if (cached?.contextToken === contextToken && cached.ticket) return cached.ticket;
    const resp = await api<IlinkResponse>(
      "ilink/bot/getconfig",
      { ilink_user_id: chatId, context_token: contextToken, base_info: { channel_version: "1.0.0" } },
      10_000,
    );
    if (!resp.typing_ticket) throw new Error("微信: getconfig 未返回 typing_ticket");
    typingTickets.set(chatId, { contextToken, ticket: resp.typing_ticket });
    return resp.typing_ticket;
  }

  /** status: 1=正在输入，2=停止。 */
  async function sendTypingStatus(chatId: string, status: 1 | 2): Promise<void> {
    const ticket = await getTypingTicket(chatId);
    await api(
      "ilink/bot/sendtyping",
      { ilink_user_id: chatId, typing_ticket: ticket, status, base_info: { channel_version: "1.0.0" } },
      10_000,
    );
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

  function handleInbound(msg: IlinkMessage): void {
    const fromUserId = msg.from_user_id || "";
    if (!fromUserId || fromUserId.endsWith("@im.bot")) return;
    if (msg.context_token) setContextToken(fromUserId, msg.context_token);
    const text = extractText(msg.item_list);
    const attachments = extractAttachments(msg.item_list);
    if (!text && attachments.length === 0) return;
    deps.onMessage({
      platform: "wechat",
      chatId: fromUserId,
      userId: fromUserId,
      senderName: fromUserId.split("@")[0] || "微信用户",
      text,
      isGroup: false,
      ...(attachments.length ? { attachments } : {}),
    });
  }

  // ── 媒体收发（CDN + AES-128-ECB）──
  async function downloadEncryptedMedia(platformRef: string): Promise<Buffer> {
    const { encrypt_query_param, aes_key } = JSON.parse(platformRef) as {
      encrypt_query_param?: string;
      aes_key?: string;
    };
    if (!encrypt_query_param) throw new Error("微信: 媒体引用缺少 encrypt_query_param");
    const res = await outboundFetch(buildCdnDownloadUrl(encrypt_query_param), { signal: abort.signal });
    if (!res.ok) throw new Error(`微信: CDN 下载失败 ${res.status}`);
    const encrypted = Buffer.from(await res.arrayBuffer());
    if (!aes_key) return encrypted;
    return decryptAesEcb(encrypted, decodeIlinkMediaAesKey(aes_key));
  }

  interface UploadedMedia {
    downloadParam: string;
    aesKeyHex: string;
    fileSize: number;
    fileSizeCiphertext: number;
  }

  async function uploadMedia(buffer: Buffer, toUserId: string, mediaType: number): Promise<UploadedMedia> {
    const rawsize = buffer.length;
    const filesize = aesEcbPaddedSize(rawsize);
    const filekey = crypto.randomBytes(16).toString("hex");
    const { rawKey, aesKeyHex } = createIlinkMediaAesKey();
    const uploadResp = await api<IlinkResponse>("ilink/bot/getuploadurl", {
      filekey,
      media_type: mediaType,
      to_user_id: toUserId,
      rawsize,
      rawfilemd5: crypto.createHash("md5").update(buffer).digest("hex"),
      filesize,
      no_need_thumb: true,
      aeskey: aesKeyHex,
      base_info: { channel_version: "1.0.0" },
    });
    if (!uploadResp.upload_param) throw new Error("微信: getuploadurl 未返回 upload_param");
    const ciphertext = encryptAesEcb(buffer, rawKey);
    const cdnRes = await outboundFetch(buildCdnUploadUrl(uploadResp.upload_param, filekey), {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: new Uint8Array(ciphertext),
      signal: abort.signal,
    });
    if (!cdnRes.ok) throw new Error(`微信: CDN 上传失败 ${cdnRes.status}`);
    const downloadParam = cdnRes.headers.get("x-encrypted-param");
    if (!downloadParam) throw new Error("微信: CDN 未返回 x-encrypted-param");
    return { downloadParam, aesKeyHex, fileSize: rawsize, fileSizeCiphertext: filesize };
  }

  async function sendImageMessage(chatId: string, uploaded: UploadedMedia, contextToken: string): Promise<void> {
    await api("ilink/bot/sendmessage", {
      msg: {
        from_user_id: "",
        to_user_id: chatId,
        client_id: crypto.randomUUID(),
        message_type: MessageType.BOT,
        message_state: MessageState.FINISH,
        item_list: [{
          type: ItemType.IMAGE,
          image_item: {
            media: { encrypt_query_param: uploaded.downloadParam, aes_key: encodeIlinkMediaAesKey(uploaded.aesKeyHex), encrypt_type: 1 },
            mid_size: uploaded.fileSizeCiphertext,
          },
        }],
        context_token: contextToken,
      },
      base_info: { channel_version: "1.0.0" },
    });
  }

  async function sendFileMessage(chatId: string, uploaded: UploadedMedia, contextToken: string, filename: string): Promise<void> {
    await api("ilink/bot/sendmessage", {
      msg: {
        from_user_id: "",
        to_user_id: chatId,
        client_id: crypto.randomUUID(),
        message_type: MessageType.BOT,
        message_state: MessageState.FINISH,
        item_list: [{
          type: ItemType.FILE,
          file_item: {
            media: { encrypt_query_param: uploaded.downloadParam, aes_key: encodeIlinkMediaAesKey(uploaded.aesKeyHex), encrypt_type: 1 },
            file_name: filename,
            len: String(uploaded.fileSize),
          },
        }],
        context_token: contextToken,
      },
      base_info: { channel_version: "1.0.0" },
    });
  }

  async function pollLoop(): Promise<void> {
    const myGen = generation;
    let failures = 0;
    while (myGen === generation) {
      try {
        const resp = await api<IlinkResponse>(
          "ilink/bot/getupdates",
          { get_updates_buf: getUpdatesBuf, base_info: { channel_version: "1.0.0" } },
          LONG_POLL_TIMEOUT_MS,
        );
        failures = 0;
        report("online");
        if (resp.get_updates_buf) {
          getUpdatesBuf = resp.get_updates_buf;
          void fs.writeFile(cursorPath, JSON.stringify({ get_updates_buf: getUpdatesBuf })).catch(() => {});
        }
        for (const msg of resp.msgs ?? []) {
          try {
            handleInbound(msg);
          } catch {
            // 单条入站失败不阻断轮询。
          }
        }
      } catch (err) {
        if (myGen !== generation) return;
        if (err instanceof Error && err.name === "AbortError") continue; // 长轮询超时，正常
        if (isSessionExpired(err)) {
          report("error", "登录已失效，请重新扫码");
          return;
        }
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
      if (!botToken) throw new Error("微信: 缺少 botToken，请先扫码登录");
      generation++;
      abort = new AbortController();
      report("connecting");
      await fs.mkdir(dir, { recursive: true });
      try {
        const raw = await fs.readFile(cursorPath, "utf8");
        getUpdatesBuf = (JSON.parse(raw) as { get_updates_buf?: string }).get_updates_buf || "";
      } catch {
        getUpdatesBuf = "";
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
      const ctx = getContextToken(chatId);
      if (!ctx) throw new Error("微信: 需要对方最近发过消息才能回复（24h 窗口）");
      for (let i = 0; i < text.length; i += MSG_CHUNK_LIMIT) {
        await api("ilink/bot/sendmessage", {
          msg: {
            from_user_id: "",
            to_user_id: chatId,
            client_id: crypto.randomUUID(),
            message_type: MessageType.BOT,
            message_state: MessageState.FINISH,
            item_list: [{ type: ItemType.TEXT, text_item: { text: text.slice(i, i + MSG_CHUNK_LIMIT) } }],
            context_token: ctx,
          },
          base_info: { channel_version: "1.0.0" },
        });
      }
    },

    canReply(chatId: string) {
      return !!getContextToken(chatId);
    },

    async sendTyping(chatId: string) {
      await sendTypingStatus(chatId, 1);
    },

    async clearTyping(chatId: string) {
      await sendTypingStatus(chatId, 2);
    },

    async downloadMedia(platformRef: string) {
      return downloadEncryptedMedia(platformRef);
    },

    async sendMedia(chatId: string, data: Buffer, opts: { mime?: string; filename?: string }) {
      const ctx = getContextToken(chatId);
      if (!ctx) throw new Error("微信: 需要对方最近发过消息才能回复（24h 窗口）");
      const isImage = opts.mime?.startsWith("image/") ?? false;
      const uploaded = await uploadMedia(data, chatId, isImage ? UploadMediaType.IMAGE : UploadMediaType.FILE);
      if (isImage) await sendImageMessage(chatId, uploaded, ctx);
      else await sendFileMessage(chatId, uploaded, ctx, opts.filename || "file");
    },
  };
}
