/**
 * shared/models/file —— editor/file-ops + pandoc wire 形状（camelCase）。
 * 迁移自旧 shared/ipc/types.ts，蛇形字段已统一为 camelCase（见 ADR-0025 / D7）。
 */

export interface FileReadResult {
  content: string;
  encoding: string;
  language: string;
  hadBom: boolean;
}

export interface FsDirEntry {
  name: string;
  path: string;
  isDir: boolean;
}

export interface PandocInfo {
  path: string;
  version: string;
}

export interface PandocExportArgs {
  inputMarkdown: string;
  format: string;
  outputPath: string;
  bibliography?: string | null;
  csl?: string | null;
  template?: string | null;
  extraArgs: string[];
}
