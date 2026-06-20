/**
 * bridge/ipc/templates —— 模板域 IPC 包装（前端经此调 backend template-service）。
 */
import { eidonInvoke } from "./client";
import type { InvalidTemplate, Template, TemplateInput } from "@shared/models";

interface TemplatesView {
  templates: Template[];
  invalid: InvalidTemplate[];
}

export const templatesBridge = {
  list: (workspace: string): Promise<TemplatesView> =>
    eidonInvoke("templates:list", { workspace }),
  init: (workspace: string): Promise<TemplatesView> =>
    eidonInvoke("templates:init", { workspace }),
  create: (workspace: string, input: TemplateInput): Promise<Template> =>
    eidonInvoke("templates:create", { workspace, input }),
  edit: (workspace: string, templateId: string, input: TemplateInput): Promise<Template> =>
    eidonInvoke("templates:edit", { workspace, templateId, input }),
  delete: (workspace: string, templateId: string): Promise<void> =>
    eidonInvoke("templates:delete", { workspace, templateId }),
  get: (workspace: string, templateId: string, version?: number): Promise<Template | null> =>
    eidonInvoke("templates:get", { workspace, templateId, version }),
  listVersions: (workspace: string, templateId: string): Promise<number[]> =>
    eidonInvoke("templates:listVersions", { workspace, templateId }),
};
