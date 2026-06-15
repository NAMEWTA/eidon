/**
 * 框架无关的引用库加载器（从 usePandocExport.loadCitations 抽出，逐字保留）。
 * 读 workspace bibliography 文件 → 按扩展名选解析器 → 按 path 缓存。
 * Editor 与（迁移后的）pandoc 导出共用，避免重复 I/O。
 */
import { invoke } from '../../core/bridge/tauri';
import { parseBibFile, parseCslJson, type CitationEntry } from './citations';

function detectCitationFormat(path: string): 'bib' | 'csl-json' {
  const lower = path.toLowerCase();
  if (lower.endsWith('.json') || lower.endsWith('.csl-json') || lower.endsWith('.cslj')) {
    return 'csl-json';
  }
  return 'bib';
}

let citationCache: { path: string; entries: CitationEntry[] } | null = null;

/** 读取并解析 bibliography；无配置或读失败返回空数组。 */
export async function loadCitations(workspaceBibliography: string): Promise<CitationEntry[]> {
  const path = (workspaceBibliography || '').trim();
  if (!path) {
    citationCache = null;
    return [];
  }
  if (citationCache && citationCache.path === path) {
    return citationCache.entries;
  }
  try {
    const result = await invoke<{ content: string }>('read_file', { path });
    const content = result?.content ?? '';
    const entries = detectCitationFormat(path) === 'csl-json' ? parseCslJson(content) : parseBibFile(content);
    citationCache = { path, entries };
    return entries;
  } catch (e) {
    console.error('[loadCitations]', e);
    citationCache = null;
    return [];
  }
}

/** 强制下次 loadCitations 重读磁盘。 */
export function invalidateCitationsCache(): void {
  citationCache = null;
}
