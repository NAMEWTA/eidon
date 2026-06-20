/**
 * 文件对话框。
 * 经 dialog:* 通道走 main 的 Electron dialog。保持 plugin-dialog 的调用形状。
 */
import { eidonInvoke } from "./client";

export interface DialogFilter {
  name: string;
  extensions: string[];
}

export interface OpenDialogOptions {
  multiple?: boolean;
  directory?: boolean;
  defaultPath?: string;
  filters?: DialogFilter[];
  title?: string;
}

export interface SaveDialogOptions {
  defaultPath?: string;
  filters?: DialogFilter[];
  title?: string;
}

/** 打开文件/目录选择框；取消返回 null，多选返回 string[]，单选返回 string。 */
export function open(options: OpenDialogOptions = {}): Promise<string | string[] | null> {
  return eidonInvoke("dialog:open", {
    multiple: options.multiple,
    directory: options.directory,
    defaultPath: options.defaultPath,
    filters: options.filters,
  });
}

/** 保存对话框；取消返回 null。 */
export function save(options: SaveDialogOptions = {}): Promise<string | null> {
  return eidonInvoke("dialog:save", {
    defaultPath: options.defaultPath,
    filters: options.filters,
  });
}
