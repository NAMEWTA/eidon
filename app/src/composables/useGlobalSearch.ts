/**
 * useGlobalSearch（从 Vue composable 迁移为 React hook）。命令式全文搜索：
 * 调用时经 getState() 读当前文件夹（与 Vue 读响应式 store 等价，总是最新）。
 */
import { invoke } from '../../core/bridge/tauri';
import { useWorkspaceStore } from '../stores/workspace';
import { useToastsStore } from '../stores/toasts';

export interface SearchHit {
  file: string;
  line: number;
  snippet: string;
}

async function search(query: string, root?: string, maxResults = 200): Promise<SearchHit[]> {
  const folder = root ?? useWorkspaceStore.getState().currentFolder;
  if (!folder) {
    useToastsStore.getState().warning('Open a folder first to enable global search');
    return [];
  }
  if (!query.trim()) return [];
  try {
    const hits = await invoke<SearchHit[]>('search_in_dir', { root: folder, query, maxResults });
    return hits;
  } catch (e) {
    useToastsStore.getState().error(`Search failed: ${e}`);
    return [];
  }
}

export function useGlobalSearch() {
  return { search };
}
