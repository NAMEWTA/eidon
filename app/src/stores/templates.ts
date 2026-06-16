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

// 在途去重：init 会被 FileTree.refreshRoot 与 TemplateManager 挂载等多处并发调用。
// initWorkspaceTemplates 以「.eidon/templates 目录是否存在」为只初始化一次的守卫，但该
// 目录是写第一个模板时才懒创建——两次 init 并发时都会越过守卫、各写一套种子，导致内置
// 模板重复（每名两份）。这里按工作区缓存在途 Promise，并发调用复用同一次，串行化种子化。
const initInFlight = new Map<string, Promise<Template[]>>();

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
    // 同一工作区的并发 init 复用在途 Promise，避免种子化竞态（见 initInFlight 注释）。
    const pending = initInFlight.get(root);
    if (pending) return pending;
    set({ loading: true, error: null });
    const run = (async () => {
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
      } finally {
        initInFlight.delete(root);
      }
    })();
    initInFlight.set(root, run);
    return run;
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
