/**
 * backend/services/template-service —— 模板域编排（构造 store → 调 domain → 返回 model）。
 * 承载原渲染侧 templates store 的编排：首次种子化 init 的并发去重、list+invalid 聚合。
 */
import { EIDON_TEMPLATES_DIR } from "@shared/contracts";
import type { InvalidTemplate, Template, TemplateInput } from "@shared/models";
import {
  createTemplate,
  deleteTemplate,
  editTemplate,
  getTemplate,
  initWorkspaceTemplates,
  listInvalidTemplates,
  listTemplates,
  listTemplateVersions,
} from "../domain/templates";
import { createWorkspaceStore } from "./workspace-store";

// 在途去重：init 会被 FileTree 刷新与 TemplateManager 挂载等多处并发触发。initWorkspaceTemplates
// 以「.eidon/templates 目录是否存在」为只初始化一次的守卫，但该目录懒创建——并发时都会越过守卫
// 各写一套种子（内置模板每名两份）。按工作区缓存在途 Promise，并发调用复用同一次、串行化种子化。
const initInFlight = new Map<string, Promise<Template[]>>();

/** 确保种子化并返回全部模板（最新版本三层）；并发同工作区复用同一次 init。 */
export const ensureTemplatesInitialized = (workspace: string): Promise<Template[]> => {
  const pending = initInFlight.get(workspace);
  if (pending) return pending;
  const run = (async () => {
    try {
      const store = createWorkspaceStore(workspace);
      await initWorkspaceTemplates(store);
      return await listTemplates(store);
    } finally {
      initInFlight.delete(workspace);
    }
  })();
  initInFlight.set(workspace, run);
  return run;
};

interface TemplatesView {
  templates: Template[];
  invalid: InvalidTemplate[];
}

export const templateService = {
  /** 列出模板 + 无效模板；工作区未初始化 .eidon/templates 时返回空（不触发写入）。 */
  async list(workspace: string): Promise<TemplatesView> {
    const store = createWorkspaceStore(workspace);
    if (!(await store.exists(EIDON_TEMPLATES_DIR))) {
      return { templates: [], invalid: [] };
    }
    const [templates, invalid] = await Promise.all([
      listTemplates(store),
      listInvalidTemplates(store),
    ]);
    return { templates, invalid };
  },

  /** 首次种子化 + 列出（含无效）。 */
  async init(workspace: string): Promise<TemplatesView> {
    const templates = await ensureTemplatesInitialized(workspace);
    const invalid = await listInvalidTemplates(createWorkspaceStore(workspace));
    return { templates, invalid };
  },

  create: (workspace: string, input: TemplateInput): Promise<Template> =>
    createTemplate(createWorkspaceStore(workspace), input),

  edit: (workspace: string, templateId: string, input: TemplateInput): Promise<Template> =>
    editTemplate(createWorkspaceStore(workspace), templateId, input),

  delete: (workspace: string, templateId: string): Promise<void> =>
    deleteTemplate(createWorkspaceStore(workspace), templateId),

  get: (workspace: string, templateId: string, version?: number): Promise<Template | null> =>
    getTemplate(createWorkspaceStore(workspace), templateId, version),

  listVersions: (workspace: string, templateId: string): Promise<number[]> =>
    listTemplateVersions(createWorkspaceStore(workspace), templateId),
};
