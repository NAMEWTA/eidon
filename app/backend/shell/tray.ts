/**
 * 系统托盘（AI-Native 常驻，见决策 Q2）。
 *
 * 关窗隐藏到托盘后，主进程经托盘保持存活，继续托管 cron 调度与（后续）平台桥接。
 * 托盘菜单：显示主窗口 / 退出 EIDON（置退出意图后 app.quit，走未存内容守卫）。
 */
import { app, Menu, Tray, nativeImage, type BrowserWindow } from "electron";
import { join } from "node:path";

import { setQuitting } from "./lifecycle/quit-state";

let tray: Tray | null = null;

/** 解析托盘图标路径（dev=app/resources/icons；prod=resourcesPath/icons，见 electron-builder extraResources）。 */
function resolveTrayIcon(dirnameMain: string): string {
  return app.isPackaged
    ? join(process.resourcesPath, "icons", "32x32.png")
    : join(dirnameMain, "../../resources/icons/32x32.png");
}

function showMainWindow(win: BrowserWindow): void {
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

export function createTray(win: BrowserWindow, dirnameMain: string): Tray {
  const image = nativeImage.createFromPath(resolveTrayIcon(dirnameMain));
  tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image);
  tray.setToolTip("EIDON");

  const menu = Menu.buildFromTemplate([
    { label: "显示主窗口", click: () => showMainWindow(win) },
    { type: "separator" },
    {
      label: "退出 EIDON",
      click: () => {
        setQuitting(true);
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);

  // 左键点击：Windows/Linux 习惯切换主窗口可见性。
  tray.on("click", () => {
    if (win.isVisible() && !win.isMinimized()) win.focus();
    else showMainWindow(win);
  });

  return tray;
}

export function destroyTray(): void {
  tray?.destroy();
  tray = null;
}
