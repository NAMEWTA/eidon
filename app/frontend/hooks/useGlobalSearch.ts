/**
 * useGlobalSearch。命令式全文搜索：
 * 调用时经 getState() 读当前文件夹（读响应式 store，总是最新）。
 */
import { eidonInvoke } from '@bridge/ipc';
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
    const hits = await eidonInvoke('kn:search', { root: folder, query, maxResults });
    return hits;
  } catch (e) {
    useToastsStore.getState().error(`Search failed: ${e}`);
    return [];
  }
}

export function useGlobalSearch() {
  return { search };
}
