import { create } from 'zustand';

import { templatesBridge } from '@bridge/ipc';
import type { InvalidTemplate, Template, TemplateInput } from '@shared/models';
import { useWorkspaceStore } from './workspace';

interface TemplatesState {
  templates: Template[];
  invalidTemplates: InvalidTemplate[];
  loading: boolean;
  error: string | null;
}

interface TemplatesActions {
  load(workspace?: string | null): Promise<Template[]>;
  init(workspace?: string | null): Promise<Template[]>;
  create(input: TemplateInput, workspace?: string | null): Promise<Template>;
  edit(templateId: string, input: TemplateInput, workspace?: string | null): Promise<Template>;
  delete(templateId: string, workspace?: string | null): Promise<void>;
  get(templateId: string, version?: number, workspace?: string | null): Promise<Template | null>;
  versions(templateId: string, workspace?: string | null): Promise<number[]>;
}

const resolveWorkspace = (workspace?: string | null): string => {
  const resolved = workspace ?? useWorkspaceStore.getState().currentFolder;
  if (!resolved) throw new Error('Open a workspace first');
  return resolved;
};

// 列表/种子化的磁盘编排与并发去重已下沉 backend template-service（D1）；store 仅作 UI 缓存。
export const useTemplatesStore = create<TemplatesState & TemplatesActions>()((set, get) => ({
  templates: [],
  invalidTemplates: [],
  loading: false,
  error: null,

  async load(workspace) {
    const root = resolveWorkspace(workspace);
    set({ loading: true, error: null });
    try {
      const { templates, invalid } = await templatesBridge.list(root);
      set({ templates, invalidTemplates: invalid, loading: false });
      return templates;
    } catch (error) {
      set({ error: String(error), loading: false });
      throw error;
    }
  },

  async init(workspace) {
    const root = resolveWorkspace(workspace);
    set({ loading: true, error: null });
    try {
      const { templates, invalid } = await templatesBridge.init(root);
      set({ templates, invalidTemplates: invalid, loading: false });
      return templates;
    } catch (error) {
      set({ error: String(error), loading: false });
      throw error;
    }
  },

  async create(input, workspace) {
    const root = resolveWorkspace(workspace);
    const created = await templatesBridge.create(root, input);
    await get().load(root);
    return created;
  },

  async edit(templateId, input, workspace) {
    const root = resolveWorkspace(workspace);
    const updated = await templatesBridge.edit(root, templateId, input);
    await get().load(root);
    return updated;
  },

  async delete(templateId, workspace) {
    const root = resolveWorkspace(workspace);
    await templatesBridge.delete(root, templateId);
    await get().load(root);
  },

  async get(templateId, version, workspace) {
    const root = resolveWorkspace(workspace);
    return templatesBridge.get(root, templateId, version);
  },

  async versions(templateId, workspace) {
    const root = resolveWorkspace(workspace);
    return templatesBridge.listVersions(root, templateId);
  },
}));
