/**
 * bridge/ipc/platform.ts — 渲染侧平台 API（窗口标题 / 文件拖放 / 资产 URL / 剪贴板图片 / 路径工具）。
 *
 * 这些能力底层都走 window.eidon 的 typed IPC 或浏览器原生 API，集中在此一层，
 * 调用点只 import 本模块。事件订阅与路径工具从 ./events、./path 透传。
 */
import { eidonInvoke } from "./client";
import { listen, emit, type UnlistenFn } from "./events";
import { documentDir, tempDir, join, sep } from "./path";

export { listen, emit, documentDir, tempDir, join, sep };
export type { UnlistenFn };

/** 绝对路径 → `eidon-asset://local/<encodeURI(path)>`（与 backend/shell/protocol/asset-protocol 对解）。 */
export function toAssetUrl(filePath: string): string {
  const fwd = filePath.replace(/\\/g, "/");
  const withLead = fwd.startsWith("/") ? fwd : `/${fwd}`;
  const enc = withLead.split("/").map(encodeURIComponent).join("/");
  return `eidon-asset://local${enc}`;
}

/** 应用版本（来自 shell:buildInfo）。 */
export async function getVersion(): Promise<string> {
  const info = await eidonInvoke("shell:buildInfo", {});
  return info.version;
}

/** 设置主窗口标题。 */
export function setWindowTitle(title: string): Promise<void> {
  return eidonInvoke("win:setTitle", { title });
}

/**
 * 订阅文件拖放：用 HTML5 dragover/drop + preload 的 getPathForFile 还原磁盘路径，
 * 仅在拿到至少一个路径时回调；返回退订函数。
 */
export function onFileDrop(cb: (paths: string[]) => void | Promise<void>): UnlistenFn {
  const onDragOver = (e: DragEvent): void => {
    e.preventDefault();
  };
  const onDrop = (e: DragEvent): void => {
    e.preventDefault();
    const files = e.dataTransfer ? Array.from(e.dataTransfer.files) : [];
    const paths = files
      .map((f) => {
        try {
          return window.eidon.getPathForFile(f);
        } catch {
          return "";
        }
      })
      .filter(Boolean);
    if (paths.length === 0) return;
    void cb(paths);
  };
  window.addEventListener("dragover", onDragOver);
  window.addEventListener("drop", onDrop);
  return () => {
    window.removeEventListener("dragover", onDragOver);
    window.removeEventListener("drop", onDrop);
  };
}

/** 剪贴板图片句柄：包装 PNG 字节，交给 clipboard.writeImage。 */
export interface ClipboardImage {
  __pngBytes: Uint8Array;
}

/** PNG 字节 → 剪贴板图片句柄。 */
export function createClipboardImage(bytes: Uint8Array): ClipboardImage {
  return { __pngBytes: bytes };
}
