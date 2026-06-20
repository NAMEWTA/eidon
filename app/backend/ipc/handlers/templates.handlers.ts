/**
 * backend/ipc/handlers/templates.handlers.ts — 模板域 IPC handler（薄层 → template-service）。
 */
import { templateService } from "../../services/template-service";
import type { IpcHandlers } from "../register";

export const templatesHandlers: IpcHandlers = {
  "templates:list": ({ workspace }) => templateService.list(workspace),
  "templates:init": ({ workspace }) => templateService.init(workspace),
  "templates:create": ({ workspace, input }) => templateService.create(workspace, input),
  "templates:edit": ({ workspace, templateId, input }) =>
    templateService.edit(workspace, templateId, input),
  "templates:delete": ({ workspace, templateId }) =>
    templateService.delete(workspace, templateId),
  "templates:get": ({ workspace, templateId, version }) =>
    templateService.get(workspace, templateId, version),
  "templates:listVersions": ({ workspace, templateId }) =>
    templateService.listVersions(workspace, templateId),
};
