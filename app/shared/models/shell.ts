/**
 * shared/models/shell —— shell/app wire 形状（camelCase）。
 * 迁移自旧 shared/ipc/types.ts，蛇形字段已统一为 camelCase（见 ADR-0025 / D7）。
 */

export interface AppBuildInfo {
  isAppStore: boolean;
  version: string;
}
