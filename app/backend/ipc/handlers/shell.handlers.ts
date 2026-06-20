/**
 * shell/app 域 IPC handler（4 通道）。
 * buildInfo / saveLanguage / setMenuLanguage(重建菜单) / forceClose(close-guard)。
 */
import { app, BrowserWindow } from "electron";
import type { AppBuildInfo } from "@shared/models";
import type { IpcHandlers } from "../register";
import { saveLanguagePreference } from "../../shell/menu/locale";
import { buildAndSetMenu } from "../../shell/menu/build-menu";
import { markForceClose } from "../../shell/lifecycle/close-guard";

export const shellHandlers: IpcHandlers = {
  // 决策 #1：彻底删除 App Store 构建 → isAppStore 恒 false。
  "shell:buildInfo": (): AppBuildInfo => ({
    isAppStore: false,
    version: app.getVersion(),
  }),
  "shell:osPaths": () => ({
    documents: app.getPath("documents"),
    temp: app.getPath("temp"),
    home: app.getPath("home"),
  }),
  "shell:saveLanguage": ({ lang }) => saveLanguagePreference(lang),
  "shell:setMenuLanguage": ({ lang }) => buildAndSetMenu(lang),
  "shell:forceClose": () => {
    markForceClose();
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    win?.close();
  },
};
