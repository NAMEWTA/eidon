import { create } from 'zustand';

import { createWorkspaceFileStore } from '../../core/bridge/file';
import {
  createTemplate,
  deleteTemplate,
  editTemplate,
  getTemplate,
  initWorkspaceTemplates,
  listInvalidTemplates,
  listTemplates,
  listTemplateVersions,
  type InvalidTemplate,
  type Template,
  type TemplateInput,
} from '../../core/templates';
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

export const useTemplatesStore = create<TemplatesState & TemplatesActions>()((set, get) => ({
  templates: [],
  invalidTemplates: [],
  loading: false,
  error: null,

  async load(workspace) {
    const root = resolveWorkspace(workspace);
    set({ loading: true, error: null });
    try {
      const store = createWorkspaceFileStore(root);
      const [templates, invalidTemplates] = await Promise.all([
        listTemplates(store),
        listInvalidTemplates(store),
      ]);
      set({ templates, invalidTemplates, loading: false });
      return templates;
    } catch (error) {
      const message = String(error);
      set({ error: message, loading: false });
      throw error;
    }
  },

  async init(workspace) {
    const root = resolveWorkspace(workspace);
    set({ loading: true, error: null });
    try {
      const store = createWorkspaceFileStore(root);
      await initWorkspaceTemplates(store);
      const [templates, invalidTemplates] = await Promise.all([
        listTemplates(store),
        listInvalidTemplates(store),
      ]);
      set({ templates, invalidTemplates, loading: false });
      return templates;
    } catch (error) {
      const message = String(error);
      set({ error: message, loading: false });
      throw error;
    }
  },

  async create(input, workspace) {
    const root = resolveWorkspace(workspace);
    const store = createWorkspaceFileStore(root);
    const created = await createTemplate(store, input);
    await get().load(root);
    return created;
  },

  async edit(templateId, input, workspace) {
    const root = resolveWorkspace(workspace);
    const store = createWorkspaceFileStore(root);
    const updated = await editTemplate(store, templateId, input);
    await get().load(root);
    return updated;
  },

  async delete(templateId, workspace) {
    const root = resolveWorkspace(workspace);
    await deleteTemplate(createWorkspaceFileStore(root), templateId);
    await get().load(root);
  },

  async get(templateId, version, workspace) {
    const root = resolveWorkspace(workspace);
    return getTemplate(createWorkspaceFileStore(root), templateId, version);
  },

  async versions(templateId, workspace) {
    const root = resolveWorkspace(workspace);
    return listTemplateVersions(createWorkspaceFileStore(root), templateId);
  },
}));
