/**
 * useFiles — 文件操作。
 *
 * 纯命令式：所有动作经 `useXStore.getState()` 读写 store + bridge invoke，
 * 不依赖 React 渲染，故定义为模块级函数，hook 仅返回稳定句柄集合。行为逐字保留。
 *
 * 「未保存」对话框：既有实现用 provide/inject + window 兜底；改为统一走
 * window 全局（App.tsx 在挂载时设置 `window.__eidon_showUnsavedDialog`），
 * 与原 window 兜底语义一致。
 */
import { eidonInvoke } from '@bridge/ipc';
import { open as openDialog, save as saveDialog } from '@bridge/ipc/dialog';
import { absoluteWorkspacePath } from '@shared/utils';
import { useTabsStore } from '../stores/tabs';
import { useWorkspaceStore } from '../stores/workspace';
import { useSettingsStore } from '../stores/settings';
import { useToastsStore } from '../stores/toasts';
import { useRecentEditsStore } from '../stores/recentEdits';
import { useNodesStore } from '../stores/nodes';
import { validateEidonWorkspaceContentPath } from '../lib/eidon-paths';
import { initialMarkdownContent, ensureFrontmatterTimestamps } from '../lib/frontmatter';
import { stampGoalSetAtIfMissing } from '../lib/writing-goals';
import type { Language, Tab } from '../types';

const SAVE_FILTERS = [
  { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd'] },
  { name: 'Plain Text', extensions: ['txt'] },
];

// 内置转换器（无 Python 依赖）。
const CONVERT_BUILTIN = new Set(['csv', 'html', 'htm']);
// 需要 markitdown CLI（Python）。
const CONVERT_CLI = new Set([
  'epub',
  'mp3', 'wav', 'm4a', 'ogg', 'flac',
]);
const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif', 'tiff']);
const OFFICE_EXTS = new Set(['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'pages', 'numbers', 'key']);

type UnsavedDialog = (mode: 'tab' | 'window', fileName: string, count: number) => Promise<'save' | 'discard' | 'cancel'>;

function getUnsavedDialog(): UnsavedDialog | undefined {
  const w = window as unknown as { __eidon_showUnsavedDialog?: UnsavedDialog };
  return w.__eidon_showUnsavedDialog;
}

async function scannedL3Paths(workspaceFolder: string | null | undefined): Promise<string[]> {
  if (!workspaceFolder) return [];
  const nodeState = useNodesStore.getState();
  let nodes = nodeState.workspace === workspaceFolder ? nodeState.nodes : [];
  if (nodes.length === 0 || nodeState.workspace !== workspaceFolder) {
    try {
      nodes = (await useNodesStore.getState().scan(workspaceFolder)).nodes;
    } catch {
      nodes = [];
    }
  }
  return nodes.filter((node) => node.node.level === 3).map((node) => node.path);
}

async function validateContentPath(path: string): Promise<{ ok: true } | { ok: false; relativePath: string; reason: string }> {
  const workspaceFolder = useWorkspaceStore.getState().currentFolder;
  return validateEidonWorkspaceContentPath(workspaceFolder, path, await scannedL3Paths(workspaceFolder));
}

function joinRelPath(parent: string, name: string): string {
  return parent ? `${parent.replace(/\/+$/, '')}/${name}` : name;
}

function splitName(fileName: string): { stem: string; ext: string } {
  const dot = fileName.lastIndexOf('.');
  if (dot <= 0) return { stem: fileName, ext: '' };
  return { stem: fileName.slice(0, dot), ext: fileName.slice(dot) };
}

async function nextAvailableInboxPath(workspaceFolder: string, inboxRelPath: string, fileName: string): Promise<string> {
  const { stem, ext } = splitName(fileName);
  const inboxAbs = absoluteWorkspacePath(workspaceFolder, inboxRelPath);
  let existing: Set<string>;
  try {
    const entries = await eidonInvoke('editor:listDir', { path: inboxAbs, includeHidden: true });
    existing = new Set(entries.map((e) => e.name));
  } catch {
    existing = new Set();
  }
  for (let i = 0; i < 1000; i++) {
    const name = i === 0 ? fileName : `${stem} ${i + 1}${ext}`;
    if (!existing.has(name)) return joinRelPath(inboxRelPath, name);
  }
  return joinRelPath(inboxRelPath, `${stem} ${Date.now()}${ext}`);
}

async function createInDefaultInbox(fileName: string, language: 'markdown' | 'plaintext') {
  const workspaceFolder = useWorkspaceStore.getState().currentFolder;
  if (!workspaceFolder) {
    useTabsStore.getState().newTab({ fileName, language });
    return;
  }

  try {
    const inboxRelPath = await useNodesStore.getState().ensureDefaultInbox(workspaceFolder);
    const targetRelPath = await nextAvailableInboxPath(workspaceFolder, inboxRelPath, fileName);
    const targetPath = absoluteWorkspacePath(workspaceFolder, targetRelPath);
    // 新建 Markdown 文件自动初始化 frontmatter（创建/更新时间精确到秒）。
    const initialContent = language === 'markdown' ? initialMarkdownContent() : '';
    await eidonInvoke('editor:createFile', { path: targetPath, content: initialContent });
    window.dispatchEvent(new CustomEvent('eidon:saved', { detail: { filePath: targetPath } }));
    await openPath(targetPath);
  } catch (error) {
    useToastsStore.getState().error(`Failed to create file in inbox: ${error}`);
    useTabsStore.getState().newTab({ fileName, language });
  }
}

function assetKindForExtension(ext: string): Exclude<NonNullable<Tab['kind']>, 'text'> | null {
  if (IMAGE_EXTS.has(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (OFFICE_EXTS.has(ext)) return 'unsupported';
  return null;
}

async function newFile() {
  await createInDefaultInbox('Untitled.md', 'markdown');
}

async function newTextFile() {
  await createInDefaultInbox('Untitled.txt', 'plaintext');
}

export async function openPath(path: string) {
  const toasts = useToastsStore.getState();

  const ext = (path.split('.').pop() || '').toLowerCase();
  const assetKind = assetKindForExtension(ext);
  if (assetKind) {
    useTabsStore.getState().openAssetFromDisk({
      filePath: path,
      kind: assetKind,
    });
    useWorkspaceStore.getState().pushRecent(path);
    const fileName = path.split(/[\\/]/).pop() ?? path;
    if (assetKind === 'unsupported') {
      toasts.info(`Opened ${fileName} as an external-only file`);
    } else {
      toasts.success(`Opened ${fileName}`);
    }
    return;
  }

  if (CONVERT_BUILTIN.has(ext) || CONVERT_CLI.has(ext)) {
    return openAndConvert(path, ext);
  }

  try {
    const result = await eidonInvoke('editor:readFile', { path });
    if (result === null) {
      useToastsStore.getState().error(`File not found: ${path}`);
      return;
    }
    useTabsStore.getState().openFromDisk({
      filePath: path,
      content: result.content,
      encoding: result.encoding,
      language: result.language as Language,
      hadBom: result.hadBom,
    });
    useWorkspaceStore.getState().pushRecent(path);
    const fileName = path.split(/[\\/]/).pop() ?? path;
    toasts.success(`Opened ${fileName}`);
  } catch (e) {
    console.error('open failed', e);
    useToastsStore.getState().error(`Failed to open file: ${e}`);
  }
}

async function openAndConvert(path: string, ext: string) {
  const toasts = useToastsStore.getState();
  const fileName = path.split(/[\\/]/).pop() ?? path;
  const tid = toasts.info(`Converting ${fileName} to Markdown…`, 0);
  try {
    const markdown = await eidonInvoke('editor:convert', { path });
    useToastsStore.getState().dismiss(tid);
    // 转换为 markdown：直接以最终名/语言新建标签再灌内容（与 既有实现「新建后 mutate」终态一致）。
    const baseName = fileName.replace(/\.[^.]+$/, '');
    const tab = useTabsStore.getState().newTab({ fileName: `${baseName}.md`, language: 'markdown' });
    useTabsStore.getState().setContent(tab.id, markdown);
    useToastsStore.getState().success(`Converted ${fileName} → Markdown`);
  } catch (e) {
    useToastsStore.getState().dismiss(tid);
    const msg = String(e);
    if (msg.includes('markitdown')) {
      useToastsStore.getState().warning(`Converting .${ext} requires markitdown:\npip install 'markitdown[all]'`, 8000);
    } else {
      useToastsStore.getState().error(`Conversion failed: ${msg}`);
    }
  }
}

async function openFolder() {
  const workspace = useWorkspaceStore.getState();
  const selected = await openDialog({
    directory: true,
    multiple: false,
    defaultPath: workspace.currentFolder ?? undefined,
  });
  if (!selected || typeof selected !== 'string') return;
  useWorkspaceStore.getState().setFolder(selected);
  if (useSettingsStore.getState().leftPanelView !== 'explorer') useSettingsStore.getState().setLeftPanelView('explorer');
}

/**
 * 保存前预处理（仅 md，非 md 原样返回）：
 * 1. `ensureFrontmatterTimestamps` —— 保证 frontmatter 带 `created`（缺则注入/补齐）；
 * 2. `stampGoalSetAtIfMissing` —— 文档带写作目标（`goal:`）但缺 `goal_set_at` 时打首存戳（幂等）。
 * 处理后的内容经 setContent 同步回 store，使「写盘 payload」与随后 `markSaved` 落的
 * `savedContent` 完全一致。**两步都必须在写盘之前完成**：否则盘上字节与内存 savedContent
 * 分叉，下次从盘加载/重启会静默丢掉 goal_set_at 戳（且 autoGit 会提交未打戳的版本）。
 */
function syncBumpUpdated(tab: Tab): string {
  if (tab.language !== 'markdown') return tab.content;
  const bumped = stampGoalSetAtIfMissing(ensureFrontmatterTimestamps(tab.content));
  if (bumped !== tab.content) useTabsStore.getState().setContent(tab.id, bumped);
  return bumped;
}

async function saveTab(tab: Tab, opts: { silent?: boolean } = {}): Promise<boolean> {
  const toasts = useToastsStore.getState();
  if ((tab.kind ?? 'text') !== 'text') {
    if (!opts.silent) toasts.info('This file is preview-only in EIDON');
    return false;
  }
  const path = tab.filePath;
  if (!path) {
    return saveTabAs(tab);
  }
  try {
    const content = syncBumpUpdated(tab);
    const payload = tab.lineEnding === 'crlf' ? content.replace(/\n/g, '\r\n') : content;
    await eidonInvoke('editor:writeFile', { path, content: payload, encoding: tab.encoding || 'UTF-8' });
    useTabsStore.getState().markSaved(tab.id, path);
    useWorkspaceStore.getState().pushRecent(path);
    useRecentEditsStore.getState().recordEdit(path);
    window.dispatchEvent(new CustomEvent('eidon:saved', { detail: { filePath: path } }));
    if (!opts.silent) {
      toasts.success(`Saved ${tab.fileName}`);
    }
    return true;
  } catch (e) {
    console.error('save failed', e);
    useToastsStore.getState().error(`Failed to save: ${e}`);
    return false;
  }
}

async function saveTabAs(tab: Tab): Promise<boolean> {
  const toasts = useToastsStore.getState();
  if ((tab.kind ?? 'text') !== 'text') {
    toasts.info('This file is preview-only in EIDON');
    return false;
  }
  const defaultName = tab.fileName || (tab.language === 'markdown' ? 'Untitled.md' : 'Untitled.txt');
  const workspaceFolder = useWorkspaceStore.getState().currentFolder;
  const l3Paths = await scannedL3Paths(workspaceFolder);
  const defaultPath = tab.filePath ?? (
    workspaceFolder && l3Paths[0]
      ? absoluteWorkspacePath(workspaceFolder, `${l3Paths[0]}/${defaultName}`)
      : defaultName
  );
  const path = await saveDialog({ defaultPath, filters: SAVE_FILTERS });
  if (!path) return false;
  const validation = await validateContentPath(path);
  if (!validation.ok) {
    toasts.error(`${validation.reason}\n${validation.relativePath}`);
    return false;
  }
  try {
    const content = syncBumpUpdated(tab);
    const payload = tab.lineEnding === 'crlf' ? content.replace(/\n/g, '\r\n') : content;
    await eidonInvoke('editor:writeFile', { path, content: payload, encoding: tab.encoding || 'UTF-8' });
    useTabsStore.getState().markSaved(tab.id, path);
    useWorkspaceStore.getState().pushRecent(path);
    useRecentEditsStore.getState().recordEdit(path);
    window.dispatchEvent(new CustomEvent('eidon:saved', { detail: { filePath: path } }));
    const fileName = path.split(/[\\/]/).pop() ?? path;
    toasts.success(`Saved as ${fileName}`);
    return true;
  } catch (e) {
    console.error('save-as failed', e);
    useToastsStore.getState().error(`Failed to save: ${e}`);
    return false;
  }
}

async function saveActive() {
  const tab = useTabsStore.getState().activeTab();
  if (tab) await saveTab(tab);
}

async function saveActiveAs() {
  const tab = useTabsStore.getState().activeTab();
  if (tab) await saveTabAs(tab);
}

async function autoSaveDirtyTabs(): Promise<void> {
  const tabs = useTabsStore.getState();
  if (!useSettingsStore.getState().autoSaveOnBlur) return;
  for (const tab of tabs.tabs) {
    if ((tab.kind ?? 'text') === 'text' && tab.filePath && tabs.isDirty(tab.id)) {
      await saveTab(tab, { silent: true });
    }
  }
}

async function closeTabSafe(id: string) {
  const tabs = useTabsStore.getState();
  const tab = tabs.tabs.find((t) => t.id === id);
  if (!tab) return;
  const showUnsavedDialog = getUnsavedDialog();
  if ((tab.kind ?? 'text') === 'text' && tab.content !== tab.savedContent && showUnsavedDialog) {
    const action = await showUnsavedDialog('tab', tab.fileName, 1);
    if (action === 'save') {
      const ok = await saveTab(tab);
      if (!ok) return;
    } else if (action === 'cancel') {
      return;
    }
  }
  useTabsStore.getState().closeTab(id);
}

const fileOps = {
  newFile,
  newTextFile,
  openPath,
  openFolder,
  saveActive,
  saveActiveAs,
  autoSaveDirtyTabs,
  closeTabSafe,
};

/** React hook：返回稳定的文件操作句柄集合（命令式，无需订阅）。 */
export function useFiles() {
  return fileOps;
}
