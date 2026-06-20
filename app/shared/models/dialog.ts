/**
 * shared/models/dialog —— native dialog wire 形状。
 * 迁移自旧 shared/ipc/types.ts（本就 camelCase）。
 */

export interface DialogFilter {
  name: string;
  extensions: string[];
}
