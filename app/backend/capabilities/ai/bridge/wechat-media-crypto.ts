/**
 * capabilities/ai/bridge/wechat-media-crypto —— 微信 iLink 媒体 AES-128 密钥编解码（纯 node）。
 *
 * 移植自 HanaAgent `lib/bridge/wechat-ilink-media-crypto.ts`。iLink 媒体走 CDN + AES-128-ECB，
 * 密钥在协议里以「16 字节原始」或「32 字符 hex 的 ascii→base64」两种形态出现，这里统一收敛。
 */
import crypto from "node:crypto";

const AES_128_HEX_RE = /^[0-9a-f]{32}$/;

/** 生成一对随机 AES-128 媒体密钥（原始 16B + hex）。 */
export function createIlinkMediaAesKey(): { rawKey: Buffer; aesKeyHex: string } {
  const rawKey = crypto.randomBytes(16);
  return { rawKey, aesKeyHex: rawKey.toString("hex") };
}

function normalizeIlinkMediaAesKeyHex(aesKeyHex: string): string {
  if (typeof aesKeyHex !== "string") {
    throw new Error("WeChat iLink media aes key must be a hex string");
  }
  const normalized = aesKeyHex.toLowerCase();
  if (!AES_128_HEX_RE.test(normalized)) {
    throw new Error("WeChat iLink media aes key must be 32 hex characters");
  }
  return normalized;
}

/** hex 密钥 → 协议形态（ascii(hex) 再 base64）。 */
export function encodeIlinkMediaAesKey(aesKeyHex: string): string {
  return Buffer.from(normalizeIlinkMediaAesKeyHex(aesKeyHex), "ascii").toString("base64");
}

/** 协议形态 → 16B 原始密钥（兼容 16B 直存 / 32 字符 hex 两种编码）。 */
export function decodeIlinkMediaAesKey(aesKeyBase64: string): Buffer {
  const decoded = Buffer.from(aesKeyBase64, "base64");
  if (decoded.length === 16) return Buffer.from(decoded);
  if (decoded.length === 32) {
    const aesKeyHex = normalizeIlinkMediaAesKeyHex(decoded.toString("ascii"));
    return Buffer.from(aesKeyHex, "hex");
  }
  throw new Error(`invalid WeChat iLink media aes_key length: ${decoded.length}`);
}
