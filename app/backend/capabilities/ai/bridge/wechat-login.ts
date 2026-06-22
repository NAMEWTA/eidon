/**
 * capabilities/ai/bridge/wechat-login —— 微信 iLink 扫码登录（纯 node）。
 *
 * 移植自 HanaAgent `lib/bridge/wechat-login.ts`（参考腾讯官方 `@tencent-weixin/openclaw-weixin`，MIT）。
 * 流程：get_bot_qrcode 取二维码 → get_qrcode_status 长轮询（服务器 hold ~35s）拿 bot_token。
 */
import QRCode from "qrcode";

const BASE_URL = "https://ilinkai.weixin.qq.com";
const BOT_TYPE = "3";

function loginHeaders(): Record<string, string> {
  return { "iLink-App-ClientVersion": "1" };
}

export interface WechatQrcode {
  ok: boolean;
  /** 二维码 PNG data URL（前端 <img>）。 */
  qrcodeDataUrl?: string;
  /** 轮询用 id。 */
  qrcodeId?: string;
  error?: string;
}

/** 获取扫码登录二维码。 */
export async function getWechatQrcode(): Promise<WechatQrcode> {
  try {
    const url = `${BASE_URL}/ilink/bot/get_bot_qrcode?bot_type=${BOT_TYPE}`;
    const res = await fetch(url, { headers: loginHeaders() });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `HTTP ${res.status}: ${body}` };
    }
    const data = (await res.json()) as { qrcode?: string; qrcode_img_content?: string };
    if (!data.qrcode) return { ok: false, error: "服务器未返回二维码" };
    // qrcode_img_content 是要被编码成二维码的 URL 文本，不是图片。
    const qrText = data.qrcode_img_content || data.qrcode;
    const qrcodeDataUrl = await QRCode.toDataURL(qrText, { width: 280, margin: 2 });
    return { ok: true, qrcodeDataUrl, qrcodeId: data.qrcode };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export interface WechatQrcodeStatus {
  status: "waiting" | "scanned" | "confirmed" | "expired" | "error";
  botToken?: string;
  botId?: string;
  userId?: string;
  baseUrl?: string;
  error?: string;
}

/**
 * 轮询扫码状态。服务器长轮询 hold 连接最多 ~35s，故前端无需高频调用。
 */
export async function pollWechatQrcodeStatus(qrcodeId: string): Promise<WechatQrcodeStatus> {
  if (!qrcodeId) return { status: "error", error: "qrcodeId is required" };
  try {
    const url = `${BASE_URL}/ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(qrcodeId)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 40_000);
    let res: Response;
    try {
      res = await fetch(url, { headers: loginHeaders(), signal: controller.signal });
      clearTimeout(timer);
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof Error && err.name === "AbortError") return { status: "waiting" };
      throw err;
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { status: "error", error: `HTTP ${res.status}: ${body}` };
    }
    const data = (await res.json()) as {
      status?: string;
      bot_token?: string;
      ilink_bot_id?: string;
      ilink_user_id?: string;
      baseurl?: string;
    };
    switch (data.status) {
      case "wait":
        return { status: "waiting" };
      case "scaned":
        return { status: "scanned" };
      case "confirmed":
        if (!data.bot_token || !data.ilink_bot_id) {
          return { status: "error", error: "登录成功但服务器未返回凭证" };
        }
        return {
          status: "confirmed",
          botToken: data.bot_token,
          botId: data.ilink_bot_id,
          userId: data.ilink_user_id,
          baseUrl: data.baseurl,
        };
      case "expired":
        return { status: "expired" };
      default:
        return { status: "waiting" };
    }
  } catch (err) {
    return { status: "error", error: err instanceof Error ? err.message : String(err) };
  }
}
