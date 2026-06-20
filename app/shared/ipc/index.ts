// shared/ipc — typed IPC 契约公共出口。
export * from "./channels";
export * from "./events";
export * from "./api";
// 兼容过渡：wire 形状已迁至 shared/models（统一 camelCase，见 ADR-0025/D7）。
// 旧 `@shared/ipc` 的 wire 类型 import 暂经此再导出，待 backend 消费端迁到 @shared/models 后移除（Phase 2）。
export * from "../models";
