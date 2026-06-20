/**
 * shared/models/fs —— 注入端口共用的最小目录项形状。
 * nodes/templates/consistency 三处注入 reader/store 原各自定义同形 DirEntry，此处统一。
 */
export interface DirEntry {
  name: string;
  isDir: boolean;
}
