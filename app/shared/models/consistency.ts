/**
 * shared/models/consistency —— 一致性域数据模型 + 注入端口（纯类型，零逻辑）。
 * 业务实现见 backend/domain/consistency；前端 FileTree 经 bridge IPC 消费违规报告。
 */
import type { Level, TemplateLayer } from "../contracts";
import type { DirEntry } from "./fs";

export interface ConsistencyReader {
  listDir(relPath: string): Promise<DirEntry[]>;
  readFile(relPath: string): Promise<string>;
}

export type StructureViolationKind =
  | "content-file-at-root"
  | "plain-folder-in-node-zone"
  | "content-file-in-organizer"
  | "level-mismatch"
  | "node-metadata-invalid";

export interface StructureViolation {
  kind: StructureViolationKind;
  path: string;
  depth: number;
  message: string;
}

export interface ConsistencyReport {
  violations: StructureViolation[];
  byPath: Map<string, StructureViolation[]>;
}

export interface NormalizationOptions {
  templateLayers: Record<Level, TemplateLayer>;
  fallbackNames?: {
    l1?: string;
    l2?: string;
    l3?: string;
  };
  now?: string | Date;
}

export interface NormalizationResult {
  fallbackL3Path: string;
  createdNodes: string[];
  moved: Array<{ from: string; to: string }>;
  skipped: Array<{ path: string; reason: string }>;
}
