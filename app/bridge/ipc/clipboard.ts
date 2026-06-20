/**
 * bridge/ipc/clipboard.ts — 剪贴板（writeText / writeHtml / writeImage），经 clipboard:* 通道走 main 的 Electron clipboard。
 * writeImage 接受 ./platform 的 ClipboardImage（PNG 字节）→ dataURL。
 */
import { eidonInvoke } from "./client";
import type { ClipboardImage } from "./platform";

export const writeText = (text: string): Promise<void> =>
  eidonInvoke("clipboard:writeText", { text });

/** writeHtml(html, altText?)；altText 落到剪贴板纯文本面。 */
export const writeHtml = (html: string, altText?: string): Promise<void> =>
  eidonInvoke("clipboard:writeHtml", { html, text: altText });

/** PNG 字节 → data URL → clipboard:writeImage。 */
export const writeImage = (image: ClipboardImage): Promise<void> => {
  const base64 = bytesToBase64(image.__pngBytes);
  return eidonInvoke("clipboard:writeImage", { dataUrl: `data:image/png;base64,${base64}` });
};

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
