import { openPath, openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";

export const openPathExternal = (path: string): Promise<void> => openPath(path);

export const openUrlExternal = (url: string): Promise<void> => openUrl(url);

export const revealPathInDir = (path: string): Promise<void> => revealItemInDir(path);
