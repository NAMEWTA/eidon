/**
 * 主窗口创建。
 *
 * 1200×800、min 480×360、show:false→ready-to-show 防白屏；electron-window-state 记忆尺寸/位置/最大化，
 * ready-to-show 时 clamp 回当前显示器；安全 webPreferences（contextIsolation/sandbox/无 nodeIntegration）；
 * 外链交系统浏览器、阻 will-navigate；close-guard 拦截主窗口关闭发 eidon:close-requested。
 */
import { BrowserWindow, shell } from "electron";
import { join } from "node:path";
import windowStateKeeper from "electron-window-state";
import { setEventTarget } from "../../ipc/emit";
import { clampWindowToMonitor } from "./clamp";
import { shouldPreventClose } from "../lifecycle/close-guard";
import { isQuitting } from "../lifecycle/quit-state";
import { emitEvent } from "../../ipc/emit";

export function createMainWindow(dirnameMain: string, isDev: boolean): BrowserWindow {
  const winState = windowStateKeeper({ defaultWidth: 1200, defaultHeight: 800 });

  const win = new BrowserWindow({
    x: winState.x,
    y: winState.y,
    width: winState.width,
    height: winState.height,
    minWidth: 480,
    minHeight: 360,
    show: false,
    title: "EIDON",
    webPreferences: {
      preload: join(dirnameMain, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  // window-state 自动保存尺寸/位置/最大化；最大化状态需手动还原。
  winState.manage(win);
  if (winState.isMaximized) win.maximize();

  // 推送事件目标（watcher/index/menu 经 emit.ts 发 eidon:* 到此窗口）。
  setEventTarget(win);

  win.once("ready-to-show", () => {
    clampWindowToMonitor(win);
    win.show();
    win.focus();
  });

  win.on("closed", () => setEventTarget(null));

  // 关闭语义（托盘常驻，决策 Q2）：
  //  - 非退出流程（普通关窗）→ 隐藏到托盘，主进程继续托管 cron/桥接。
  //  - 退出流程（托盘退出 / Cmd+Q / before-quit）→ 走未存内容守卫后真正关闭。
  win.on("close", (e) => {
    if (!isQuitting()) {
      e.preventDefault();
      win.hide();
      return;
    }
    if (shouldPreventClose()) {
      e.preventDefault();
      emitEvent("eidon:close-requested", undefined);
    }
  });

  // 外链交系统浏览器；阻止应用内导航离开渲染入口。
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    const current = win.webContents.getURL();
    if (url !== current) {
      e.preventDefault();
      if (/^https?:/i.test(url)) void shell.openExternal(url);
    }
  });

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void win.loadFile(join(dirnameMain, "../renderer/index.html"));
  }

  return win;
}
