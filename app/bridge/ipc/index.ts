/**
 * bridge/ipc — 渲染层访问 backend 的统一出口（前端↔后端契约边界）。
 *
 * 命名空间导出各域桥；数据域（nodes/templates/todos/consistency）走新 IPC 通道（ADR-0025/D1）；
 * 平台 API（窗口/拖放/资产 URL/剪贴板/路径）经 ./platform。类型安全调用用 eidonInvoke。
 */
export * as events from "./events";
export * as git from "./git";
export * as notification from "./notification";
export * as opener from "./opener";
export * as platform from "./platform";
export * as dialog from "./dialog";
export * as clipboard from "./clipboard";
export * as snapshots from "./snapshots";

export { nodesBridge } from "./nodes";
export { templatesBridge } from "./templates";
export { todosBridge } from "./todos";
export { consistencyBridge } from "./consistency";

export {
  listen,
  emit,
  toAssetUrl,
  getVersion,
  setWindowTitle,
  onFileDrop,
  documentDir,
  tempDir,
  join,
  sep,
  createClipboardImage,
  type UnlistenFn,
} from "./platform";
export { eidonInvoke } from "./client";
