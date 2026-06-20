/**
 * 外部打开。
 * openPath/openUrl/revealItemInDir 经 shell:* 通道走 main（Electron 限制）。
 */
import { eidonInvoke } from "./client";

export const openPath = (path: string): Promise<void> => eidonInvoke("shell:openPath", { path });
export const openUrl = (url: string): Promise<void> => eidonInvoke("shell:openExternal", { url });
export const revealItemInDir = (path: string): Promise<void> =>
  eidonInvoke("shell:revealItemInDir", { path });

// 兼容别名。
export const openPathExternal = openPath;
export const openUrlExternal = openUrl;
export const revealPathInDir = revealItemInDir;
