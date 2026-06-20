/**
 * shared/models —— 纯 TS 数据模型公共出口（实体/VO/BO/注入端口/wire 形状）。
 * 零业务逻辑、零运行时（仅类型）。三层（frontend/bridge/backend）皆可 import。
 * 磁盘契约（zod）在 shared/contracts；纯函数工具在 shared/utils。
 */
export * from "./fs";
export * from "./node";
export * from "./template";
export * from "./todo";
export * from "./consistency";
export * from "./git";
export * from "./file";
export * from "./search";
export * from "./shell";
export * from "./dialog";
export * from "./ai";
