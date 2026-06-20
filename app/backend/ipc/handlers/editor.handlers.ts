/**
 * editor 域 IPC handler（file-ops + convert + pandoc + watcher + print）。
 *
 * 每个 handler 经 IpcHandlers 的通道维度强类型，请求体解构与返回值由 IpcContract 校验。
 * print 走 electron webContents（属 ipc 层，允许用 electron）。
 */
import { BrowserWindow } from "electron";
import * as fileOps from "../../capabilities/editor/file-ops";
import { convertFileToMarkdown } from "../../capabilities/editor/convert";
import { pandocDetect, pandocExport } from "../../capabilities/editor/pandoc";
import { watchFile, unwatchFile } from "../../capabilities/editor/watcher";
import type { IpcHandlers } from "../register";

export const editorHandlers: IpcHandlers = {
  // file-ops
  "editor:readFile": async ({ path }) => {
    try {
      return await fileOps.readFile(path);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  },
  "editor:writeFile": ({ path, content, encoding }) =>
    fileOps.writeFile(path, content, encoding),
  "editor:readBinaryFile": ({ path }) => fileOps.readBinaryFile(path),
  "editor:writeBinaryFile": ({ path, data }) =>
    fileOps.writeBinaryFile(path, data),
  "editor:copyFile": ({ src, dst }) => fileOps.copyFile(src, dst),
  "editor:listDir": async ({ path, includeHidden }) => {
    try {
      return await fileOps.listDir(path, includeHidden ?? false);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw e;
    }
  },
  "editor:createFile": ({ path, content }) =>
    fileOps.createFile(path, content ?? null),
  "editor:createDir": ({ path }) => fileOps.createDir(path),
  "editor:delete": ({ path }) => fileOps.deletePath(path),
  "editor:rename": ({ from, to }) => fileOps.rename(from, to),

  // convert / pandoc
  "editor:convert": ({ path }) => convertFileToMarkdown(path),
  "editor:pandocDetect": () => pandocDetect(),
  "editor:pandocExport": ({ args }) => pandocExport(args),

  // watcher
  "editor:watchFile": ({ path }) => watchFile(path),
  "editor:unwatchFile": ({ path }) => unwatchFile(path),

  // 原生打印（替代旧 print_webview / WKWebView 的 window.print no-op）。
  "editor:print": () =>
    new Promise<void>((resolve, reject) => {
      const win =
        BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
      if (!win) {
        reject(new Error("no window to print"));
        return;
      }
      // success=false 多为用户取消，不视为错误，静默 resolve。
      win.webContents.print({}, () => resolve());
    }),
};
