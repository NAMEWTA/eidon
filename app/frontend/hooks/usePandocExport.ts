/**
 * F5 — Pandoc 导出（EPUB/ODT/LaTeX/RTF/custom）+ 引用库懒加载。Pandoc 不内置，经 `pandoc:detect` 探测，缺失则 toast 提示。
 * 命令式：读 store 用 getState；引用库加载复用框架无关 `lib/load-citations`。
 */
import { save as saveDialog } from '@bridge/ipc/dialog';
import { eidonInvoke } from '@bridge/ipc';
import { useTabsStore } from '../stores/tabs';
import { useToastsStore } from '../stores/toasts';
import { useSettingsStore } from '../stores/settings';
import { type CitationEntry } from '../lib/citations';
import { loadCitations as loadCitationsFromDisk, invalidateCitationsCache } from '../lib/load-citations';

export interface PandocInfo {
  path: string;
  version: string;
}

export type PandocFormat = 'epub' | 'odt' | 'latex' | 'rtf' | 'custom';

interface ExportOptions {
  template?: string;
  extraArgs?: string[];
}

interface FormatSpec {
  ext: string;
  filterName: string;
  extraArgs: string[];
}

const FORMATS: Record<Exclude<PandocFormat, 'custom'>, FormatSpec> = {
  epub: { ext: 'epub', filterName: 'EPUB', extraArgs: [] },
  odt: { ext: 'odt', filterName: 'OpenDocument Text', extraArgs: [] },
  latex: { ext: 'tex', filterName: 'LaTeX', extraArgs: ['--standalone'] },
  rtf: { ext: 'rtf', filterName: 'Rich Text Format', extraArgs: ['--standalone'] },
};

function parseFrontMatterCitationFields(content: string): { bibliography?: string; csl?: string } {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const yaml = m[1];
  const out: { bibliography?: string; csl?: string } = {};
  const bibMatch = yaml.match(/^bibliography\s*:\s*(.+?)\s*$/m);
  if (bibMatch) out.bibliography = stripYamlQuotes(bibMatch[1]);
  const cslMatch = yaml.match(/^csl\s*:\s*(.+?)\s*$/m);
  if (cslMatch) out.csl = stripYamlQuotes(cslMatch[1]);
  return out;
}

function stripYamlQuotes(s: string): string {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

async function detectPandoc(): Promise<PandocInfo | null> {
  try {
    const info = await eidonInvoke('editor:pandocDetect', {});
    return info ?? null;
  } catch (e) {
    console.error('[pandoc_detect]', e);
    return null;
  }
}

function activeContext(): { content: string; baseName: string } | null {
  const tab = useTabsStore.getState().activeTab();
  if (!tab) {
    useToastsStore.getState().error('No active document');
    return null;
  }
  const name = tab.fileName ?? 'Untitled';
  return { content: tab.content ?? '', baseName: name.replace(/\.[^.]+$/, '') };
}

function resolveCitationFlags(content: string): { bibliography?: string; csl?: string } {
  const fm = parseFrontMatterCitationFields(content);
  const s = useSettingsStore.getState();
  const bib = (fm.bibliography || s.workspaceBibliography || '').trim();
  const csl = (fm.csl || s.workspaceCsl || '').trim();
  return { bibliography: bib || undefined, csl: csl || undefined };
}

async function exportTo(format: PandocFormat, activeContent?: string, opts: ExportOptions = {}): Promise<void> {
  const toasts = useToastsStore.getState();
  const ctx = activeContext();
  if (!ctx) return;
  const content = activeContent ?? ctx.content;

  const info = await detectPandoc();
  if (!info) {
    toasts.error('Pandoc not found. Install it from https://pandoc.org/installing.html and retry.');
    return;
  }

  let ext = 'out';
  let filterName = 'File';
  const extraArgs: string[] = [];
  if (format === 'custom') {
    ext = '*';
    filterName = 'Pandoc output';
    if (opts.template) extraArgs.push(`--template=${opts.template}`);
  } else {
    const spec = FORMATS[format];
    ext = spec.ext;
    filterName = spec.filterName;
    extraArgs.push(...spec.extraArgs);
  }
  if (opts.extraArgs) extraArgs.push(...opts.extraArgs);

  const filters = ext === '*' ? [{ name: 'All Files', extensions: ['*'] }] : [{ name: filterName, extensions: [ext] }];
  const outputPath = await saveDialog({ defaultPath: `${ctx.baseName}.${ext === '*' ? 'out' : ext}`, filters });
  if (!outputPath) return;

  const { bibliography, csl } = resolveCitationFlags(content);

  const tid = toasts.info(`Exporting via Pandoc (${format})…`, 0);
  try {
    await eidonInvoke('editor:pandocExport', {
      args: {
        inputMarkdown: content,
        format,
        outputPath: outputPath,
        bibliography: bibliography ?? null,
        csl: csl ?? null,
        template: opts.template ?? null,
        extraArgs: extraArgs,
      },
    });
    useToastsStore.getState().dismiss(tid);
    useToastsStore.getState().success(`Exported to ${format.toUpperCase()}`);
  } catch (e) {
    useToastsStore.getState().dismiss(tid);
    const msg = typeof e === 'string' ? e : (e as Error)?.message || String(e);
    useToastsStore.getState().error(`Pandoc export failed: ${msg}`);
  }
}

/** 读取并解析工作区 bibliography（委托框架无关 loader）。 */
async function loadCitations(): Promise<CitationEntry[]> {
  return loadCitationsFromDisk(useSettingsStore.getState().workspaceBibliography);
}

export function usePandocExport() {
  return { detectPandoc, exportTo, loadCitations, invalidateCitationsCache };
}
