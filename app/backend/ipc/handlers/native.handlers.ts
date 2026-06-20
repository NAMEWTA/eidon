/**
 * 原生平台能力（dialog/clipboard/opener/notification/window）。
 *
 * 这些必须经 main（Electron 限制：渲染层无法直接弹原生对话框/读系统剪贴板）。
 * 渲染层经 src/ipc/{dialog,clipboard,opener,notification}.ts 包装调用这些通道。
 */
import {
  dialog,
  clipboard,
  shell,
  nativeImage,
  Notification,
  BrowserWindow,
} from "electron";
import type { IpcHandlers } from "../register";

function focusedWindow(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;
}

export const nativeHandlers: IpcHandlers = {
  // ── dialog ────────────────────────────────────────────────────────
  "dialog:open": async ({ multiple, directory, defaultPath, filters }) => {
    const properties: Array<"openFile" | "openDirectory" | "multiSelections"> = [];
    properties.push(directory ? "openDirectory" : "openFile");
    if (multiple) properties.push("multiSelections");
    const win = focusedWindow();
    const result = await (win
      ? dialog.showOpenDialog(win, { properties, defaultPath, filters })
      : dialog.showOpenDialog({ properties, defaultPath, filters }));
    if (result.canceled || result.filePaths.length === 0) return null;
    return multiple ? result.filePaths : result.filePaths[0];
  },
  "dialog:save": async ({ defaultPath, filters }) => {
    const win = focusedWindow();
    const result = await (win
      ? dialog.showSaveDialog(win, { defaultPath, filters })
      : dialog.showSaveDialog({ defaultPath, filters }));
    return result.canceled || !result.filePath ? null : result.filePath;
  },

  // ── clipboard ─────────────────────────────────────────────────────
  "clipboard:writeText": ({ text }) => clipboard.writeText(text),
  "clipboard:writeHtml": ({ html, text }) =>
    clipboard.write({ html, text: text ?? "" }),
  "clipboard:writeImage": ({ dataUrl }) =>
    clipboard.writeImage(nativeImage.createFromDataURL(dataUrl)),

  // ── opener / shell ────────────────────────────────────────────────
  "shell:openExternal": ({ url }) => shell.openExternal(url),
  "shell:openPath": async ({ path }) => {
    await shell.openPath(path);
  },
  "shell:revealItemInDir": ({ path }) => shell.showItemInFolder(path),

  // ── notification ──────────────────────────────────────────────────
  "notify:requestPermission": () => Notification.isSupported(),
  "notify:send": ({ title, body }) => {
    if (!Notification.isSupported()) return;
    new Notification({ title, body }).show();
  },

  // ── window ────────────────────────────────────────────────────────
  "win:setTitle": ({ title }) => {
    focusedWindow()?.setTitle(title);
  },
};
