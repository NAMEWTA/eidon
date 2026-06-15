/**
 * useExport（从 Vue composable 迁移为 React hook）。HTML/DOCX/PDF/PDF-print/PNG 导出
 * 与 Copy-as-*。命令式：读 store 用 getState；HTML 模板/strip/选区读取/剪贴板能力探测
 * 等纯/DOM 助手逐字保留。导出管线（docx/pdf/image/markdown）走既有 lib，渲染面像素保真。
 */
import { save as saveDialog } from '@tauri-apps/plugin-dialog';
import { invoke } from '../../core/bridge/tauri';
import { writeText, writeHtml, writeImage } from '@tauri-apps/plugin-clipboard-manager';
import { Image } from '../../core/bridge/tauri';
import { documentDir, join } from '../../core/bridge/tauri';
import { isIOS } from '../lib/platform';
import { markdownToDocxBlob } from '../lib/docx-export';
import { markdownToPdfBlob } from '../lib/pdf-export';
import { markdownToImageBlob } from '../lib/image-export';
import { renderMarkdown, extractImageRoot } from '../lib/markdown';
import { rewriteLinkUrls, rewriteImageUrls } from '../lib/image-resolve';
import { useTabsStore } from '../stores/tabs';
import { useSettingsStore } from '../stores/settings';
import { useToastsStore } from '../stores/toasts';
import { resolvePdfOptions, userTouchedPdfDefaults, buildPrintStyle } from '../lib/pdf-options';

const HTML_TEMPLATE = (title: string, body: string) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
<style>
  :root {
    --brand: #ff9f40;
    --brand-soft: #ffe7cc;
    --ink: #1f1d1a;
    --ink-muted: #6a6560;
    --rule: #e6e2d8;
    --paper: #fbfaf6;
    --code-bg: #f3efe7;
    --code-key: #ff9f40;
    --row-alt: #f7f4ec;
  }
  html, body { background: var(--paper); }
  body {
    max-width: 760px;
    margin: 56px auto;
    padding: 0 56px 96px;
    font: 16px/1.75 -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto,
      "Helvetica Neue", Arial,
      "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei",
      "Noto Sans CJK SC", "WenQuanYi Micro Hei",
      system-ui, sans-serif;
    color: var(--ink);
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }
  h1, h2, h3, h4, h5, h6 {
    line-height: 1.25;
    font-weight: 700;
    color: var(--ink);
    margin: 2em 0 0.6em;
  }
  h1:first-child, h2:first-child, h3:first-child { margin-top: 0; }
  h1 {
    font-size: 2.15em;
    border-bottom: 2px solid var(--brand);
    padding-bottom: .35em;
    letter-spacing: -0.01em;
  }
  h2 {
    font-size: 1.55em;
    border-bottom: 1px solid var(--rule);
    padding-bottom: .25em;
  }
  h3 { font-size: 1.25em; }
  h4 { font-size: 1.05em; }
  h5, h6 { font-size: 1em; color: var(--ink-muted); }
  p { margin: .9em 0; }
  a {
    color: var(--brand);
    text-decoration: none;
    border-bottom: 1px solid var(--brand-soft);
  }
  a:hover { border-bottom-color: var(--brand); }
  strong { color: var(--ink); }
  em { color: var(--ink); }
  code {
    font-family: "JetBrains Mono", "SF Mono", "Menlo", "Consolas",
      "Liberation Mono", monospace;
    font-size: .9em;
    background: var(--code-bg);
    padding: .15em .45em;
    border-radius: 4px;
    color: #8a4a00;
  }
  pre {
    background: var(--code-bg);
    padding: 16px 20px;
    border-radius: 8px;
    overflow-x: auto;
    margin: 1.2em 0;
    line-height: 1.55;
    border: 1px solid var(--rule);
  }
  pre code {
    background: transparent;
    padding: 0;
    color: var(--ink);
    font-size: .88em;
  }
  pre code .hljs-keyword,
  pre code .hljs-built_in,
  pre code .hljs-tag { color: var(--code-key); }
  blockquote {
    border-left: 4px solid var(--brand);
    background: linear-gradient(to right, var(--brand-soft) 0%, transparent 40%);
    margin: 1.4em 0;
    padding: .5em 1.2em;
    color: var(--ink-muted);
    font-style: italic;
    border-radius: 0 4px 4px 0;
  }
  blockquote p { margin: .4em 0; }
  ul, ol { padding-left: 1.8em; margin: .9em 0; }
  li { margin: .3em 0; }
  li > p { margin: .3em 0; }
  table {
    border-collapse: collapse;
    margin: 1.4em 0;
    width: 100%;
    font-size: .95em;
  }
  th, td {
    border: 1px solid var(--rule);
    padding: 8px 14px;
    text-align: left;
  }
  thead th {
    background: var(--brand-soft);
    color: var(--ink);
    font-weight: 700;
    border-bottom: 2px solid var(--brand);
  }
  tbody tr:nth-child(even) { background: var(--row-alt); }
  hr {
    border: none;
    border-top: 1px solid var(--rule);
    margin: 2.4em 0;
  }
  img {
    max-width: 100%;
    border-radius: 6px;
    margin: 1.2em 0;
    box-shadow: 0 1px 3px rgba(0, 0, 0, .08);
  }
  .katex-display { overflow-x: auto; overflow-y: hidden; margin: 1.2em 0; }
</style>
</head>
<body>
${body}
</body>
</html>`;

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

/** Strip Markdown syntax to produce plain prose. */
function stripMarkdown(src: string): string {
  return src
    .replace(/```[a-zA-Z0-9]*\n([\s\S]*?)```/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(\*|_)(.+?)\1/g, '$2')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/^[-*_]{3,}\s*$/gm, '')
    .trim();
}

/** 读取 CodeMirror 编辑器选区的 Markdown 源（不要求 .cm-focused；详见原注释）。 */
function getEditorSelectionMd(): string | null {
  if (typeof document === 'undefined') return null;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  let node: Node | null = range.commonAncestorContainer;
  while (node && node.nodeType === Node.TEXT_NODE) node = node.parentNode;
  const inEditor = (node as Element | null)?.closest?.('.cm-editor');
  if (!inEditor) return null;
  const text = sel.toString();
  return text.trim() ? text : null;
}

function activeOr(): { content: string; baseName: string; filePath?: string } | null {
  const tab = useTabsStore.getState().activeTab();
  if (!tab) {
    useToastsStore.getState().error('No active document');
    return null;
  }
  const name = tab.fileName ?? 'Untitled';
  return { content: tab.content ?? '', baseName: name.replace(/\.[^.]+$/, ''), filePath: tab.filePath };
}

function copySource(): { source: string; isSelection: boolean } | null {
  const ctx = activeOr();
  if (!ctx) return null;
  const sel = getEditorSelectionMd();
  return sel !== null ? { source: sel, isSelection: true } : { source: ctx.content, isSelection: false };
}

async function pickWritePath(filename: string, filters: { name: string; extensions: string[] }[]): Promise<string | null> {
  if (isIOS()) {
    const dir = await documentDir();
    return await join(dir, filename);
  }
  return await saveDialog({ defaultPath: filename, filters });
}

function iosSavedToast(filename: string): string {
  return `Saved to On My iPhone › EIDON › ${filename}`;
}

function hasNativeClipboardWrite(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.clipboard !== 'undefined' &&
    typeof navigator.clipboard.write === 'function' &&
    typeof (window as unknown as { ClipboardItem?: unknown }).ClipboardItem !== 'undefined'
  );
}

async function exportHtml() {
  const toasts = useToastsStore.getState();
  const ctx = activeOr();
  if (!ctx) return;
  const filename = `${ctx.baseName}.html`;
  const path = await pickWritePath(filename, [{ name: 'HTML', extensions: ['html'] }]);
  if (!path) return;
  const imageRoot = extractImageRoot(ctx.content);
  const body = rewriteLinkUrls(rewriteImageUrls(renderMarkdown(ctx.content), imageRoot, ctx.filePath), imageRoot, ctx.filePath);
  const html = HTML_TEMPLATE(ctx.baseName, body);
  try {
    await invoke('write_file', { path, content: html, encoding: 'UTF-8' });
    toasts.success(isIOS() ? iosSavedToast(filename) : 'Exported to HTML');
  } catch (e) {
    useToastsStore.getState().error(`Export failed: ${e}`);
  }
}

async function exportDocx() {
  const toasts = useToastsStore.getState();
  const ctx = activeOr();
  if (!ctx) return;
  const filename = `${ctx.baseName}.docx`;
  const path = await pickWritePath(filename, [{ name: 'Word Document', extensions: ['docx'] }]);
  if (!path) return;
  try {
    const blob = await markdownToDocxBlob(ctx.content, ctx.baseName, ctx.filePath);
    const buffer = new Uint8Array(await blob.arrayBuffer());
    await invoke('write_binary_file', { path, data: Array.from(buffer) });
    toasts.success(isIOS() ? iosSavedToast(filename) : 'Exported to DOCX');
  } catch (e) {
    console.error(e);
    useToastsStore.getState().error(`DOCX export failed: ${e}`);
  }
}

async function exportPdf() {
  const toasts = useToastsStore.getState();
  const ctx = activeOr();
  if (!ctx) return;
  const filename = `${ctx.baseName}.pdf`;
  const path = await pickWritePath(filename, [{ name: 'PDF', extensions: ['pdf'] }]);
  if (!path) return;
  const tid = toasts.info('Generating PDF…', 0);
  try {
    const settings = useSettingsStore.getState();
    const pdfOpts = resolvePdfOptions(settings.pdfDefaults, ctx.content, userTouchedPdfDefaults(settings.pdfDefaults));
    const blob = await markdownToPdfBlob(ctx.content, ctx.baseName, pdfOpts, ctx.filePath);
    const buffer = new Uint8Array(await blob.arrayBuffer());
    await invoke('write_binary_file', { path, data: Array.from(buffer) });
    useToastsStore.getState().dismiss(tid);
    useToastsStore.getState().success(isIOS() ? iosSavedToast(filename) : 'Exported to PDF');
  } catch (e) {
    console.error(e);
    useToastsStore.getState().dismiss(tid);
    useToastsStore.getState().error(`PDF export failed: ${e}`);
  }
}

async function exportPdfPrint() {
  const ctx = activeOr();
  if (!ctx) return;
  const source = ctx.content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
  const imageRoot = extractImageRoot(source);
  const body = rewriteLinkUrls(rewriteImageUrls(renderMarkdown(source), imageRoot, ctx.filePath), imageRoot, ctx.filePath);

  let overlay = document.getElementById('eidon-print-overlay') as HTMLDivElement | null;
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'eidon-print-overlay';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
<div class="eidon-print-content preview-content">${body}</div>`;
  document.body.classList.add('eidon-printing');

  const settings = useSettingsStore.getState();
  const pdfOpts = resolvePdfOptions(settings.pdfDefaults, ctx.content, userTouchedPdfDefaults(settings.pdfDefaults));
  const styleCss = buildPrintStyle(pdfOpts);
  let styleEl: HTMLStyleElement | null = null;
  if (styleCss) {
    styleEl = document.createElement('style');
    styleEl.id = 'eidon-print-style';
    styleEl.textContent = styleCss;
    document.head.appendChild(styleEl);
  }

  const cleanup = () => {
    document.body.classList.remove('eidon-printing');
    overlay?.remove();
    styleEl?.remove();
  };

  await new Promise((r) => setTimeout(r, 200));
  try {
    await invoke('print_webview');
  } catch (e) {
    console.error('[print] failed', e);
    useToastsStore.getState().error(`Print failed: ${e}`);
  } finally {
    setTimeout(cleanup, 100);
  }
}

async function copyAsHtml() {
  const toasts = useToastsStore.getState();
  const src = copySource();
  if (!src) return;
  const html = renderMarkdown(src.source);
  const okMsg = src.isSelection ? 'Copied selection as HTML' : 'Copied as HTML';
  if (hasNativeClipboardWrite()) {
    try {
      const item = new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([src.source], { type: 'text/plain' }),
      });
      await navigator.clipboard.write([item]);
      toasts.success(okMsg);
      return;
    } catch {
      // fall through to Tauri plugin
    }
  }
  try {
    await writeHtml(html);
    useToastsStore.getState().success(okMsg);
  } catch {
    try {
      await writeText(html);
      useToastsStore.getState().success(src.isSelection ? 'Copied selection HTML source' : 'Copied HTML source');
    } catch (e2) {
      useToastsStore.getState().error(`Copy failed: ${e2}`);
    }
  }
}

async function copyAsPlainText() {
  const src = copySource();
  if (!src) return;
  const text = stripMarkdown(src.source);
  const okMsg = src.isSelection ? 'Copied selection as plain text' : 'Copied as plain text';
  try {
    await writeText(text);
    useToastsStore.getState().success(okMsg);
  } catch (e) {
    useToastsStore.getState().error(`Copy failed: ${e}`);
  }
}

async function copyAsMarkdown() {
  const src = copySource();
  if (!src) return;
  const okMsg = src.isSelection ? 'Copied selection as Markdown' : 'Copied as Markdown';
  try {
    await writeText(src.source);
    useToastsStore.getState().success(okMsg);
  } catch (e) {
    useToastsStore.getState().error(`Copy failed: ${e}`);
  }
}

async function exportImage() {
  const toasts = useToastsStore.getState();
  const ctx = activeOr();
  if (!ctx) return;
  const sel = getEditorSelectionMd();
  const source = sel ?? ctx.content;
  const isSelection = sel !== null;
  const filename = isSelection ? `${ctx.baseName}-selection.png` : `${ctx.baseName}.png`;
  const path = await pickWritePath(filename, [{ name: 'PNG Image', extensions: ['png'] }]);
  if (!path) return;
  const tid = toasts.info(isSelection ? 'Generating selection image…' : 'Generating image…', 0);
  try {
    const blob = await markdownToImageBlob(source, ctx.baseName, ctx.filePath, {
      branding: useSettingsStore.getState().imageExportBranding,
    });
    const buffer = new Uint8Array(await blob.arrayBuffer());
    await invoke('write_binary_file', { path, data: Array.from(buffer) });
    useToastsStore.getState().dismiss(tid);
    const msg = isIOS() ? iosSavedToast(filename) : isSelection ? 'Exported selection to PNG image' : 'Exported to PNG image';
    useToastsStore.getState().success(msg);
  } catch (e) {
    console.error(e);
    useToastsStore.getState().dismiss(tid);
    useToastsStore.getState().error(`Image export failed: ${e}`);
  }
}

async function copyAsImage() {
  const toasts = useToastsStore.getState();
  const ctx = activeOr();
  if (!ctx) return;
  const sel = getEditorSelectionMd();
  const source = sel ?? ctx.content;
  const isSelection = sel !== null;
  const tid = toasts.info(isSelection ? 'Capturing selection…' : 'Capturing image…', 0);
  try {
    const blob = await markdownToImageBlob(source, ctx.baseName, ctx.filePath, {
      branding: useSettingsStore.getState().imageExportBranding,
    });
    if (hasNativeClipboardWrite()) {
      try {
        const item = new ClipboardItem({ 'image/png': blob });
        await navigator.clipboard.write([item]);
        useToastsStore.getState().dismiss(tid);
        useToastsStore.getState().success(isSelection ? 'Copied selection as image' : 'Copied as image');
        return;
      } catch {
        // fall through to Tauri plugin
      }
    }
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const img = await Image.fromBytes(bytes);
    await writeImage(img);
    useToastsStore.getState().dismiss(tid);
    useToastsStore.getState().success(isSelection ? 'Copied selection as image' : 'Copied as image');
  } catch (e) {
    console.error(e);
    useToastsStore.getState().dismiss(tid);
    try {
      const filename = `${ctx.baseName}.png`;
      const path = await pickWritePath(filename, [{ name: 'PNG Image', extensions: ['png'] }]);
      if (path) {
        const blob2 = await markdownToImageBlob(source, ctx.baseName, ctx.filePath, {
          branding: useSettingsStore.getState().imageExportBranding,
        });
        const buffer = new Uint8Array(await blob2.arrayBuffer());
        await invoke('write_binary_file', { path, data: Array.from(buffer) });
        useToastsStore.getState().success(isIOS() ? iosSavedToast(filename) : 'Clipboard failed — saved as PNG instead');
      } else {
        useToastsStore.getState().error(`Copy image failed: ${e}`);
      }
    } catch {
      useToastsStore.getState().error(`Copy image failed: ${e}`);
    }
  }
}

export function useExport() {
  return {
    exportHtml,
    exportDocx,
    exportPdf,
    exportPdfPrint,
    exportImage,
    copyAsHtml,
    copyAsPlainText,
    copyAsMarkdown,
    copyAsImage,
  };
}
