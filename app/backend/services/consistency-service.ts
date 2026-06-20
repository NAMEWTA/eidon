/**
 * backend/services/consistency-service —— 一致性域编排。
 * check 只读检测；normalize 用户显式触发的一键迁移（取首个模板，无模板则报错由前端提示）。
 */
import type { ConsistencyReport, NormalizationResult } from "@shared/models";
import { detectStructureViolations, normalizeWorkspaceStructure } from "../domain/consistency";
import { createWorkspaceStore } from "./workspace-store";
import { templateService } from "./template-service";

export const consistencyService = {
  check: (workspace: string): Promise<ConsistencyReport> =>
    detectStructureViolations(createWorkspaceStore(workspace)),

  async normalize(workspace: string): Promise<NormalizationResult> {
    const { templates } = await templateService.list(workspace);
    const template = templates[0];
    if (!template) {
      throw new Error("no template available to normalize workspace structure");
    }
    return normalizeWorkspaceStructure(createWorkspaceStore(workspace), {
      templateLayers: template.layers,
    });
  },
};
