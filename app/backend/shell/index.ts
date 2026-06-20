/**
 * Electron 主进程入口。
 *
 * 职责：注册自定义资产协议 → app.whenReady 注入运行时路径/CSP/协议 handler/原生菜单/IPC →
 * 创建安全主窗口；单实例锁 + close-guard + window-state 还原。所有后端能力经 typed IPC 暴露。
 */
import { app, BrowserWindow, session } from "electron";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { registerIpcHandlers, type IpcHandlers } from "../ipc/register";
import { editorHandlers } from "../ipc/handlers/editor.handlers";
import { knowledgeHandlers } from "../ipc/handlers/knowledge.handlers";
import { gitHandlers } from "../ipc/handlers/git.handlers";
import { shellHandlers } from "../ipc/handlers/shell.handlers";
import { nativeHandlers } from "../ipc/handlers/native.handlers";
import { nodesHandlers } from "../ipc/handlers/nodes.handlers";
import { templatesHandlers } from "../ipc/handlers/templates.handlers";
import { todosHandlers } from "../ipc/handlers/todos.handlers";
import { consistencyHandlers } from "../ipc/handlers/consistency.handlers";
import { setRuntimePaths } from "../capabilities/runtime-paths";
import { createMainWindow } from "./window/main-window";
import { buildAndSetMenu } from "./menu/build-menu";
import { readSavedLanguage } from "./menu/locale";
import {
  registerAssetScheme,
  handleAssetProtocol,
  addAllowedRoot,
} from "./protocol/asset-protocol";

const __dirname = dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;

// 自定义协议必须在 app ready 之前声明 scheme 权限。
registerAssetScheme();

/** 注入运行时路径（保持 capabilities 不依赖 electron）：缓存/配置目录 + 内置字典目录。 */
function injectRuntimePaths(): void {
  const dicts = app.isPackaged
    ? join(process.resourcesPath, "dicts")
    : join(__dirname, "../../resources/dicts");
  setRuntimePaths({
    userData: app.getPath("userData"),
    userConfig: app.getPath("userData"),
    dicts,
  });
}

/**
 * 汇总各域 handler，并把「打开工作区」类调用的目录登记进资产协议白名单
 * （收紧 eidon-asset:// 到 workspace 根）。
 */
function allIpcHandlers(): IpcHandlers {
  const handlers: IpcHandlers = {
    ...editorHandlers,
    ...knowledgeHandlers,
    ...gitHandlers,
    ...shellHandlers,
    ...nativeHandlers,
    ...nodesHandlers,
    ...templatesHandlers,
    ...todosHandlers,
    ...consistencyHandlers,
  };
  const loose = handlers as Record<string, (req: unknown) => unknown>;
  const wrapRoot = (channel: string, pick: (req: Record<string, unknown>) => unknown): void => {
    const orig = loose[channel];
    if (!orig) return;
    loose[channel] = (req: unknown) => {
      const dir = pick((req ?? {}) as Record<string, unknown>);
      if (typeof dir === "string" && dir) addAllowedRoot(dir);
      return orig(req);
    };
  };
  wrapRoot("kn:indexInit", (r) => r.workspace);
  wrapRoot("git:status", (r) => r.folder);
  wrapRoot("git:init", (r) => r.folder);
  wrapRoot("git:autoCommit", (r) => r.folder);
  wrapRoot("nodes:scan", (r) => r.workspace);
  return handlers;
}

/** 生产环境收紧 CSP；dev 放行以兼容 Vite HMR。 */
function applyCsp(): void {
  if (isDev) return;
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: eidon-asset:",
    "media-src 'self' blob: eidon-asset:",
    "font-src 'self' data:",
    "connect-src 'self' eidon-asset:",
  ].join("; ");
  session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
    cb({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [csp],
      },
    });
  });
}

// 单实例锁（避免多窗口；二次启动聚焦已有窗口）。
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  void app.whenReady().then(() => {
    injectRuntimePaths();
    applyCsp();
    handleAssetProtocol();
    app.setAboutPanelOptions({
      applicationName: "EIDON",
      applicationVersion: app.getVersion(),
      credits: "Made by 智通 / xiangdong li",
      website: "https://github.com/NAMEWTA/eidon",
    });
    buildAndSetMenu(readSavedLanguage());
    registerIpcHandlers(allIpcHandlers());
    createMainWindow(__dirname, isDev);

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow(__dirname, isDev);
    });
  });

  app.on("window-all-closed", () => {
    // macOS 习惯：关闭所有窗口不退出；其它平台退出。
    if (process.platform !== "darwin") app.quit();
  });
}
