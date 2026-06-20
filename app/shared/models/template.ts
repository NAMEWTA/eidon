/**
 * shared/models/template —— 模板域数据模型 + 注入端口（纯类型，零逻辑）。
 * 业务实现见 backend/domain/templates；前端经 bridge IPC 消费这些类型。
 */
import type { FieldType, Level, TemplateLayer } from "../contracts";
import type { DirEntry } from "./fs";

/**
 * 可写文件系统抽象（注入依赖，系统边界）。
 * 生产由 backend 经 capabilities/editor/file-ops 实现；测试用 node:fs 临时目录实现。
 */
export interface TemplateStore {
  listDir(relPath: string): Promise<DirEntry[]>;
  readFile(relPath: string): Promise<string>;
  writeFile(relPath: string, contents: string): Promise<void>;
  remove(relPath: string): Promise<void>;
  exists(relPath: string): Promise<boolean>;
}

/** 单层模板输入（pre-parse；required/options 可省，由契约补默认/校验）。 */
export interface LayerInput {
  name: string;
  fields: Array<{
    key: string;
    label: string;
    type: FieldType;
    options?: string[];
    required?: boolean;
  }>;
}

/** 创建/编辑模板输入：三层各自的名字 + 字段集。 */
export interface TemplateInput {
  templateName?: string;
  layers: Record<Level, LayerInput>;
}

/** 一套模板的运行时三层捆绑视图（非磁盘单元；磁盘是每层一文件）。 */
export interface Template {
  templateId: string;
  templateName: string;
  version: number;
  layers: Record<Level, TemplateLayer>;
}

export interface InvalidTemplate {
  templateId: string;
  reason: string;
}
