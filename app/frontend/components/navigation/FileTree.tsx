import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Tree, type NodeApi, type NodeRendererProps, type TreeApi } from 'react-arborist';

import { writeText } from '@bridge/ipc/clipboard';

import { Icon } from '../shared/Icons';
import { listen, type UnlistenFn } from '@bridge/ipc/platform';
import { eidonInvoke, consistencyBridge } from '@bridge/ipc';
import { revealPathInDir } from '@bridge/ipc/opener';
import type { Level } from '@shared/contracts';
import type { ScannedNode, StructureViolation } from '@shared/models';
import { useWorkspaceStore } from '../../stores/workspace';
import { useFiles } from '../../hooks/useFiles';
import { useTabsStore } from '../../stores/tabs';
import { useToastsStore } from '../../stores/toasts';
import { useNodesStore } from '../../stores/nodes';
import { useTemplatesStore } from '../../stores/templates';
import { useSettingsStore } from '../../stores/settings';
import { useI18n } from '../../i18n';
import { canCreateContentInScannedL3, findEnclosingL3Path } from '../../lib/eidon-paths';
import { nowISO, initialMarkdownContent } from '../../lib/frontmatter';
import {
  canDragFileTreeEntry,
  canDropIntoFileTreeEntry,
  canMoveFileTreeEntriesInto,
  createChildNodeLevel,
  promoteFolderLevel,
  type FileTreeMoveEntry,
} from '../../lib/filetree-menu';
import { deriveTemplateVisual, templateDisplayName, type TemplateVisualIdentity } from '../../lib/template-visuals';
import { NodeCreateDialog } from '../dialogs/NodeCreateDialog';
import { TodoCreateDialog } from '../dialogs/TodoCreateDialog';
import { NodeTreePicker } from './NodeTreePicker';

/** react-arborist 内部 TreeProvider 无条件创建 DndProvider(HTML5Backend)，即使设置
 *  disableDrag/disableDrop 也照建不误。快速卸载→重挂时旧后端异步清理与新后端创建竞态，
 *  抛 "Cannot have two HTML5 backends at the same time"。这里提供一个模块级单例桩后端，
 *  确保无论 Tree 挂载多少次，始终复用同一个无操作后端（文件树拖拽由原生 HTML5 事件实现）。
 *  react-dnd 是 react-arborist 的依赖，非本项目直接依赖；此处用 any 绕过类型导入。 */
const noopDndBackend = (() => {
  const noop = () => {};
  const unsub = () => {};
  let _instance: ReturnType<typeof noopDndBackend> | null = null;
  return (): any => {
    if (!_instance) {
      _instance = {
        setup: noop,
        teardown: noop,
        connectDragSource: () => unsub,
        connectDragPreview: () => unsub,
        connectDropTarget: () => unsub,
      } as any;
    }
    return _instance;
  };
})();

interface ExplorerEntry {
  id: string;
  name: string;
  path: string;
  isDir: boolean;
  children?: ExplorerEntry[];
  loaded?: boolean;
  truncated?: boolean;
}

interface CtxMenu {
  x: number;
  y: number;
  node: NodeApi<ExplorerEntry> | null;
}

interface NodeDialogState {
  mode: 'create' | 'promote';
  path: string;
}

/** 文件树剪贴板（复制/剪切待粘贴的条目）。 */
interface TreeClipboard {
  mode: 'copy' | 'cut';
  entry: ExplorerEntry;
}

const TRUNCATED_SENTINEL = '__eidon_truncated__';
const SYSTEM_ENTRY_NAMES = new Set(['.eidon', '.eidon-sync', '.eidon-encrypted', '.node', '.git', '.DS_Store', 'Thumbs.db']);

async function loadDir(path: string): Promise<{ children: ExplorerEntry[]; truncated: boolean }> {
  try {
    const entries = await eidonInvoke('editor:listDir', { path, includeHidden: true });
    // 系统项始终隐藏；其它 `.` 开头项按「显示隐藏文件」设置过滤（默认隐藏 .gitignore 等）。
    const showHidden = useSettingsStore.getState().showHiddenFiles;
    let truncated = false;
    const children: ExplorerEntry[] = [];
    for (const entry of entries) {
      if (entry.name === TRUNCATED_SENTINEL && !entry.isDir && entry.path === '') {
        truncated = true;
        continue;
      }
      if (SYSTEM_ENTRY_NAMES.has(entry.name)) continue;
      if (!showHidden && entry.name.startsWith('.')) continue;
      children.push({
        id: entry.path,
        name: entry.name,
        path: entry.path,
        isDir: entry.isDir,
        children: entry.isDir ? [] : undefined,
        loaded: !entry.isDir,
      });
    }
    return { children, truncated };
  } catch (error) {
    console.error('list_dir failed', error);
    return { children: [], truncated: false };
  }
}

function joinPath(parent: string, name: string): string {
  const sep = parent.includes('\\') && !parent.includes('/') ? '\\' : '/';
  return parent.endsWith(sep) ? parent + name : parent + sep + name;
}

function dirname(path: string): string {
  return path.replace(/[\\/][^\\/]+$/, '');
}

function parentRelPath(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/').filter(Boolean);
  parts.pop();
  return parts.join('/');
}

function isSameOrChild(path: string, parent: string): boolean {
  const a = path.replace(/\\/g, '/').replace(/\/+$/, '');
  const b = parent.replace(/\\/g, '/').replace(/\/+$/, '');
  return a === b || a.startsWith(`${b}/`);
}

function updateEntry(entries: ExplorerEntry[], path: string, updater: (entry: ExplorerEntry) => ExplorerEntry): ExplorerEntry[] {
  return entries.map((entry) => {
    if (entry.path === path) return updater(entry);
    if (!entry.children) return entry;
    return { ...entry, children: updateEntry(entry.children, path, updater) };
  });
}

/** 文件视觉身份：图标 + 类型 token（type 对应 CSS 的 --ft-* 语义色，配色惯例参考 VS Code Material Icon Theme）。 */
interface FileVisual {
  icon: string;
  type: string;
}

/** 扩展名 → 文件视觉身份映射表（同类扩展共享一条，新增类型在此登记即可）。 */
const FILE_VISUALS: Array<{ exts: string[]; visual: FileVisual }> = [
  { exts: ['md', 'markdown', 'mdown', 'mkd'], visual: { icon: 'new-text', type: 'md' } },
  { exts: ['txt', 'log'], visual: { icon: 'new-text', type: 'plain' } },
  { exts: ['pdf'], visual: { icon: 'file-type', type: 'pdf' } },
  { exts: ['doc', 'docx', 'odt', 'rtf'], visual: { icon: 'file-pen', type: 'doc' } },
  { exts: ['xls', 'xlsx', 'ods', 'csv', 'tsv'], visual: { icon: 'file-spreadsheet', type: 'sheet' } },
  { exts: ['ppt', 'pptx', 'odp', 'key'], visual: { icon: 'presentation', type: 'slide' } },
  { exts: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif', 'tiff', 'ico'], visual: { icon: 'file-image', type: 'image' } },
  { exts: ['mp3', 'wav', 'flac', 'm4a', 'ogg', 'aac'], visual: { icon: 'file-audio', type: 'media' } },
  { exts: ['mp4', 'mov', 'mkv', 'avi', 'webm'], visual: { icon: 'file-video', type: 'media' } },
  { exts: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'], visual: { icon: 'file-archive', type: 'archive' } },
  { exts: ['json', 'yml', 'yaml', 'toml', 'xml', 'ini'], visual: { icon: 'file-json', type: 'data' } },
  { exts: ['ts', 'tsx', 'js', 'jsx', 'css', 'html', 'htm', 'rs', 'py', 'go', 'java', 'c', 'cpp', 'sh'], visual: { icon: 'file-code', type: 'code' } },
];

const FILE_VISUAL_BY_EXT = new Map<string, FileVisual>(
  FILE_VISUALS.flatMap(({ exts, visual }) => exts.map((ext) => [ext, visual] as const)),
);

function fileVisual(name: string): FileVisual {
  const ext = (name.split('.').pop() || '').toLowerCase();
  return FILE_VISUAL_BY_EXT.get(ext) ?? { icon: 'file', type: 'plain' };
}

function violationLabel(violation: StructureViolation): string {
  switch (violation.kind) {
    case 'plain-folder-in-node-zone':
      return '待提升';
    case 'content-file-in-organizer':
      return '位置非法';
    case 'content-file-at-root':
      return '根文件';
    case 'level-mismatch':
      return '层级';
    case 'node-metadata-invalid':
      return '修复';
    default:
      return '!';
  }
}

function ExplorerNode({
  node,
  style,
  tree,
  getStructureNode,
  getTemplateVisual,
  getViolations,
  canDragEntry,
  onOpenFile,
  onSelectStructureNode,
  onToggleDir,
  onDragStartEntries,
  onDragEndEntries,
  onDragEnterDir,
  onDragOverDir,
  onDragLeaveDir,
  onDropIntoDir,
  onContextMenu,
  isExplicitDropTarget,
  isMultiSelected,
  onToggleMultiSelect,
  onClearMultiSelect,
}: NodeRendererProps<ExplorerEntry> & {
  getStructureNode: (entry: ExplorerEntry) => ScannedNode | null;
  getTemplateVisual: (node: ScannedNode) => TemplateVisualIdentity;
  getViolations: (entry: ExplorerEntry) => StructureViolation[];
  canDragEntry: (entry: ExplorerEntry) => boolean;
  onOpenFile: (entry: ExplorerEntry) => void;
  onSelectStructureNode: (node: ScannedNode | null) => void;
  onToggleDir: (node: NodeApi<ExplorerEntry>) => void;
  isMultiSelected: (entry: ExplorerEntry) => boolean;
  onToggleMultiSelect: (node: NodeApi<ExplorerEntry>) => void;
  onClearMultiSelect: () => void;
  onDragStartEntries: (nodes: NodeApi<ExplorerEntry>[]) => void;
  onDragEndEntries: () => void;
  onDragEnterDir: (node: NodeApi<ExplorerEntry>) => void;
  onDragOverDir: (event: React.DragEvent, node: NodeApi<ExplorerEntry>) => void;
  onDragLeaveDir: (event: React.DragEvent, node: NodeApi<ExplorerEntry>) => void;
  onDropIntoDir: (event: React.DragEvent, node: NodeApi<ExplorerEntry>) => void;
  onContextMenu: (event: React.MouseEvent, node: NodeApi<ExplorerEntry>) => void;
  isExplicitDropTarget: (entry: ExplorerEntry) => boolean;
}) {
  const [name, setName] = useState(node.data.name);
  const structureNode = node.data.isDir ? getStructureNode(node.data) : null;
  const violations = getViolations(node.data);
  // 目录：结构节点始终用 FolderTree 与普通文件夹区分（开合由 chevron 表达），
  // 普通文件夹按开合切换 Folder/FolderOpen；文件：按扩展名取图标+语义色。
  const visual: FileVisual = node.data.isDir
    ? structureNode
      ? { icon: 'folder-tree', type: 'dir' }
      : { icon: node.isOpen ? 'open' : 'folder', type: 'dir' }
    : fileVisual(node.data.name);
  const nodeLevel = structureNode?.node.level;
  const templateVisual = structureNode ? getTemplateVisual(structureNode) : null;

  useEffect(() => setName(node.data.name), [node.data.name]);

  return (
    <div
      style={style}
      className={[
        'ftree__item',
        node.data.isDir ? 'ftree__item--dir' : 'ftree__item--file',
        node.isSelected ? 'ftree__item--active' : '',
        isMultiSelected(node.data) ? 'ftree__item--selected' : '',
        structureNode ? 'ftree__item--node' : '',
        violations.length > 0 ? 'ftree__item--violation' : '',
        isExplicitDropTarget(node.data) ? 'ftree__item--drop-target' : '',
      ].filter(Boolean).join(' ')}
      data-level={nodeLevel}
      title={node.data.path}
      /* 原生 HTML5 拖拽（react-arborist 自带 DnD 已停用）：可拖性由结构规则决定 */
      draggable={!node.isEditing && canDragEntry(node.data)}
      onClick={(event) => {
        event.stopPropagation();
        // Cmd/Ctrl + 点击 = 多选切换（不打开/不展开）；普通点击清空多选并执行打开/展开。
        if (event.metaKey || event.ctrlKey) {
          onToggleMultiSelect(node);
          return;
        }
        onClearMultiSelect();
        node.select();
        onSelectStructureNode(structureNode);
        if (node.data.isDir) onToggleDir(node);
        else onOpenFile(node.data);
      }}
      onDragStart={(event) => {
        // 部分 WebView 必须 setData 才会真正启动拖拽会话
        event.dataTransfer.setData('text/plain', node.data.path);
        event.dataTransfer.effectAllowed = 'move';
        onDragStartEntries([node]);
      }}
      onDragEnd={onDragEndEntries}
      onDragEnter={() => {
        if (node.data.isDir) onDragEnterDir(node);
      }}
      onDragOver={(event) => {
        if (node.data.isDir) onDragOverDir(event, node);
      }}
      onDragLeave={(event) => {
        if (node.data.isDir) onDragLeaveDir(event, node);
      }}
      onDrop={(event) => {
        if (node.data.isDir) onDropIntoDir(event, node);
      }}
      onContextMenu={(event) => onContextMenu(event, node)}
    >
      <span className="ftree__indent" style={{ width: `${node.level * 12}px` }} />
      <span className="ftree__twisty" aria-hidden="true">
        {node.data.isDir ? <Icon name={node.isOpen ? 'chevron-down' : 'chevron-right'} size={11} /> : null}
      </span>
      <span className="ftree__icon" data-ftype={visual.type}><Icon name={visual.icon} size={14} /></span>
      {node.isEditing ? (
        <input
          className="ftree__edit-input"
          value={name}
          autoFocus
          spellCheck={false}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing || event.keyCode === 229) return;
            if (event.key === 'Escape') {
              event.preventDefault();
              node.reset();
            } else if (event.key === 'Enter') {
              event.preventDefault();
              node.submit(name);
            }
          }}
          onBlur={() => node.submit(name)}
        />
      ) : (
        <span className="ftree__name">{node.data.name}</span>
      )}
      {/* 弹性填充放在文件名之后、徽标之前：吃掉剩余空间，把层级/模板/违规徽标整体推到右边缘
          （也是双击重命名的命中区）。 */}
      <span className="ftree__row-fill" onDoubleClick={() => tree.edit(node.id)} />
      {structureNode && (
        <>
          <span
            className="ftree__template-mark"
            style={{ background: templateVisual?.color }}
            title={`${structureNode.node.type} · ${structureNode.node.templateId}`}
          >
            {templateVisual?.glyph}
          </span>
          <span
            className={`ftree__node-badge ftree__node-badge--l${structureNode.node.level}`}
            title={`${structureNode.node.type} · schema v${structureNode.node.schemaVersion}`}
          >
            L{structureNode.node.level}
          </span>
        </>
      )}
      {violations.map((violation) => (
        <span key={`${violation.kind}:${violation.path}`} className="ftree__violation-badge" title={violation.message}>
          {violationLabel(violation)}
        </span>
      ))}
      {node.data.truncated && <span className="ftree__badge">10k+</span>}
    </div>
  );
}

export function FileTree({ onSelectStructureNode = () => undefined }: { onSelectStructureNode?: (node: ScannedNode | null) => void }) {
  const { t } = useI18n();
  const files = useFiles();
  const currentFolder = useWorkspaceStore((state) => state.currentFolder);
  const scannedNodes = useNodesStore((state) => state.nodes);
  const templates = useTemplatesStore((state) => state.templates);
  const showHiddenFiles = useSettingsStore((state) => state.showHiddenFiles);

  const [treeData, setTreeData] = useState<ExplorerEntry[]>([]);
  const [rootLoading, setRootLoading] = useState(false);
  const [rootTruncated, setRootTruncated] = useState(false);
  const [ctx, setCtx] = useState<CtxMenu | null>(null);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [selection, setSelection] = useState<string | undefined>(undefined);
  // Cmd/Ctrl + 点击的多选集合（id=绝对路径）；用于批量拖拽/移动。普通单击清空。
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [violationsByPath, setViolationsByPath] = useState<Map<string, StructureViolation[]>>(new Map());
  const [treeHeight, setTreeHeight] = useState(320);
  const [nodeDialog, setNodeDialog] = useState<NodeDialogState | null>(null);
  const [todoDialogNode, setTodoDialogNode] = useState<ScannedNode | null>(null);
  const [explicitDropTargetPath, setExplicitDropTargetPath] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<TreeClipboard | null>(null);
  const [moveDialogEntry, setMoveDialogEntry] = useState<ExplorerEntry | null>(null);
  const [moveFilter, setMoveFilter] = useState('');
  const [nameDialog, setNameDialog] = useState<{ kind: 'file' | 'folder'; parentPath: string } | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [normalizing, setNormalizing] = useState(false);
  const treeWrapRef = useRef<HTMLDivElement | null>(null);
  const treeResizeObs = useRef<ResizeObserver | null>(null);
  const ctxRef = useRef<HTMLDivElement | null>(null);
  const arboristRef = useRef<TreeApi<ExplorerEntry> | undefined>(undefined);
  const refreshDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressIndexRefreshUntil = useRef(0);
  const openIdsRef = useRef(openIds);
  const pendingOpenIds = useRef<Set<string>>(new Set());
  const dragOpenPending = useRef<Set<string>>(new Set());
  const draggingEntries = useRef<ExplorerEntry[]>([]);

  const nodeByPath = useMemo(() => {
    const map = new Map<string, ScannedNode>();
    for (const scanned of scannedNodes) map.set(scanned.path, scanned);
    return map;
  }, [scannedNodes]);

  const l3NodePaths = useMemo(() => (
    scannedNodes
      .filter((scanned) => scanned.node.level === 3)
      .map((scanned) => scanned.path)
  ), [scannedNodes]);

  const templateById = useMemo(() => {
    const map = new Map<string, typeof templates[number]>();
    for (const template of templates) map.set(template.templateId, template);
    return map;
  }, [templates]);

  function relFor(absPath: string): string {
    const root = useWorkspaceStore.getState().currentFolder;
    if (!root) return '';
    return useNodesStore.getState().relPath(absPath, root);
  }

  function normalizedAbs(path: string): string {
    return path.replace(/\\/g, '/').replace(/\/+$/, '');
  }

  function isInsideWorkspace(absPath: string): boolean {
    const root = useWorkspaceStore.getState().currentFolder;
    if (!root) return false;
    const rootNorm = normalizedAbs(root);
    const pathNorm = normalizedAbs(absPath);
    return pathNorm === rootNorm || pathNorm.startsWith(`${rootNorm}/`);
  }

  function isSystemMetadataPath(absPath: string): boolean {
    const rel = relFor(absPath);
    return (
      rel === '.eidon' ||
      rel.startsWith('.eidon/') ||
      rel === '.node' ||
      rel.startsWith('.node/') ||
      rel.includes('/.node/')
    );
  }

  function getStructureNode(entry: ExplorerEntry): ScannedNode | null {
    return entry.isDir ? nodeByPath.get(relFor(entry.path)) ?? null : null;
  }

  function getTemplateVisual(node: ScannedNode): TemplateVisualIdentity {
    const template = templateById.get(node.node.templateId);
    const name = template
      ? templateDisplayName({
          templateName: template.templateName,
          l1Name: template.layers[1].name,
          l2Name: template.layers[2].name,
          l3Name: template.layers[3].name,
        })
      : node.node.type;
    return deriveTemplateVisual({ templateId: node.node.templateId, name });
  }

  function getViolations(entry: ExplorerEntry): StructureViolation[] {
    return violationsByPath.get(relFor(entry.path)) ?? [];
  }

  function parentStructureLevel(relPath: string): Level | null {
    const parent = parentRelPath(relPath);
    if (!parent) return null;
    return nodeByPath.get(parent)?.node.level ?? null;
  }

  function menuContext(node: NodeApi<ExplorerEntry> | null) {
    const relPath = node ? relFor(node.data.path) : '';
    const structureLevel = node?.data.isDir ? getStructureNode(node.data)?.node.level ?? null : null;
    return {
      relPath,
      isDir: node?.data.isDir ?? true,
      structureLevel,
      parentStructureLevel: parentStructureLevel(relPath),
    };
  }

  function createLevelFor(node: NodeApi<ExplorerEntry> | null): Level | null {
    const context = menuContext(node);
    if (!context.isDir) return null;
    return createChildNodeLevel(context);
  }

  function promoteLevelFor(node: NodeApi<ExplorerEntry> | null): Level | null {
    if (!node) return null;
    return promoteFolderLevel(menuContext(node));
  }

  function canCreateContent(node: NodeApi<ExplorerEntry> | null): boolean {
    if (!node?.data.isDir) return false;
    return canCreateContentInScannedL3(relFor(node.data.path), l3NodePaths);
  }

  function canDrag(entry: ExplorerEntry): boolean {
    return canDragFileTreeEntry({ isStructureNode: entry.isDir && getStructureNode(entry) !== null });
  }

  function canDropInto(parent: ExplorerEntry | null): boolean {
    if (!parent?.isDir) return false;
    return canDropIntoFileTreeEntry({ isDir: parent.isDir, relPath: relFor(parent.path) }, l3NodePaths);
  }

  function moveEntryInfo(entry: ExplorerEntry): FileTreeMoveEntry {
    return {
      path: entry.path,
      isDir: entry.isDir,
      isStructureNode: entry.isDir && getStructureNode(entry) !== null,
    };
  }

  function canMoveInto(entries: ExplorerEntry[], parent: ExplorerEntry | null): boolean {
    return canMoveFileTreeEntriesInto(
      entries.map(moveEntryInfo),
      parent ? { path: parent.path, relPath: relFor(parent.path), isDir: parent.isDir } : null,
      l3NodePaths,
    );
  }

  async function scanNodes(path: string) {
    try {
      await useNodesStore.getState().scan(path);
    } catch (error) {
      console.warn('scan nodes failed', error);
    }
  }

  async function scanConsistency(path: string) {
    try {
      const report = await consistencyBridge.check(path);
      setViolationsByPath(report.byPath);
    } catch (error) {
      console.warn('scan consistency failed', error);
      setViolationsByPath(new Map());
    }
  }

  function flushPendingTreeOpen() {
    const openPending = () => {
      const ids = [...pendingOpenIds.current];
      pendingOpenIds.current.clear();
      for (const id of ids) arboristRef.current?.open(id);
    };
    if (typeof window !== 'undefined' && 'requestAnimationFrame' in window) {
      window.requestAnimationFrame(openPending);
    } else {
      setTimeout(openPending, 0);
    }
  }

  function scheduleTreeOpen(path: string) {
    if (!path) return;
    pendingOpenIds.current.add(path);
    setOpenIds((current) => new Set(current).add(path));
    flushPendingTreeOpen();
  }

  async function loadOpenDescendants(entries: ExplorerEntry[], openSet: Set<string>): Promise<ExplorerEntry[]> {
    const out: ExplorerEntry[] = [];
    for (const entry of entries) {
      if (!entry.isDir || !openSet.has(entry.path)) {
        out.push(entry);
        continue;
      }
      const loaded = await loadDir(entry.path);
      out.push({
        ...entry,
        children: await loadOpenDescendants(loaded.children, openSet),
        loaded: true,
        truncated: loaded.truncated,
      });
    }
    return out;
  }

  async function refreshRoot(options: { showLoading?: boolean } = { showLoading: false }) {
    const showLoading = options.showLoading ?? true;
    const path = useWorkspaceStore.getState().currentFolder;
    if (!path) {
      setTreeData([]);
      setViolationsByPath(new Map());
      setRootLoading(false);
      return;
    }
    if (showLoading) setRootLoading(true);
    const [{ children, truncated }] = await Promise.all([
      loadDir(path),
      scanNodes(path),
      scanConsistency(path),
      useTemplatesStore.getState().load(path).catch((error) => {
        console.warn('load templates failed', error);
      }),
    ]);
    if (useWorkspaceStore.getState().currentFolder !== path) return;
    setTreeData(await loadOpenDescendants(children, openIdsRef.current));
    for (const id of openIdsRef.current) pendingOpenIds.current.add(id);
    flushPendingTreeOpen();
    setRootTruncated(truncated);
    setRootLoading(false);
  }

  async function refreshLoadedParentForPath(absPath: string) {
    const root = useWorkspaceStore.getState().currentFolder;
    if (!root || !isInsideWorkspace(absPath)) return;
    if (normalizedAbs(absPath) === normalizedAbs(root) || isSystemMetadataPath(absPath)) {
      await refreshRoot({ showLoading: false });
      return;
    }

    const parent = dirname(absPath);
    const loaded = await loadDir(parent);
    if (useWorkspaceStore.getState().currentFolder !== root) return;
    const children = await loadOpenDescendants(loaded.children, openIdsRef.current);
    if (normalizedAbs(parent) === normalizedAbs(root)) {
      setTreeData(children);
      setRootTruncated(loaded.truncated);
    } else {
      setTreeData((current) =>
        updateEntry(current, parent, (entry) => ({
          ...entry,
          children,
          loaded: true,
          truncated: loaded.truncated,
        })),
      );
    }
    for (const id of openIdsRef.current) pendingOpenIds.current.add(id);
    flushPendingTreeOpen();
  }

  /** 求目标文件的全部祖先目录绝对路径（不含文件自身），shallow→deep。 */
  function ancestorDirsOf(absPath: string, root: string): string[] {
    const rel = absPath.startsWith(root) ? absPath.slice(root.length).replace(/^[\\/]+/, '') : absPath;
    const sep = root.includes('\\') ? '\\' : '/';
    const parts = rel.split(/[\\/]/).filter(Boolean);
    const out: string[] = [];
    let acc = root;
    for (let pi = 0; pi < parts.length - 1; pi++) {
      acc = acc + (acc.endsWith(sep) ? '' : sep) + parts[pi];
      out.push(acc);
    }
    return out;
  }

  /**
   * 「在文件树中定位当前文件」：展开全部祖先目录并滚动选中目标。
   *
   * 修复 BUG1（树行渲染重叠）：旧实现按祖先**逐个** setTreeData + 与滞后的 openIdsRef、命令式
   * arborist.open() 交错、外加冗余的双 scrollTo，导致 react-arborist 虚拟列表行 top 错位、行相互重叠。
   * 现改为**单一真相源 + 单次提交**：合并 open 集合 → 从根一次性 loadOpenDescendants → 单次 setTreeData/
   * setOpenIds（并同步 openIdsRef）→ React commit 后再统一 open + 单次 select/scroll。
   */
  async function revealActiveFileInTree() {
    const activePath = useTabsStore.getState().activeTab()?.filePath;
    const root = useWorkspaceStore.getState().currentFolder;
    if (!activePath || !root || !isInsideWorkspace(activePath)) return;

    // reveal 期间抑制 index-updated 触发的并发刷新，避免重复行/中途插入打乱布局。
    suppressIndexRefreshUntil.current = Date.now() + 1500;

    // 1) 合并 open 集合（现有 ∪ 目标祖先）。
    const merged = new Set(openIdsRef.current);
    for (const dir of ancestorDirsOf(activePath, root)) merged.add(dir);

    // 2) 从根一次性加载，把全部 open 后代落入一棵干净的新树（无重复 id）。
    const { children, truncated } = await loadDir(root);
    if (useWorkspaceStore.getState().currentFolder !== root) return;
    const tree = await loadOpenDescendants(children, merged);
    if (useWorkspaceStore.getState().currentFolder !== root) return;

    // 3) 单次提交：data + openIds（同步 ref，供后续读取不滞后）。
    openIdsRef.current = merged;
    setOpenIds(merged);
    setTreeData(tree);
    setRootTruncated(truncated);

    // 4) React commit + arborist 布局完成后，统一 open + 单次 select/scroll。
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    if (useWorkspaceStore.getState().currentFolder !== root) return;
    for (const id of merged) arboristRef.current?.open(id);
    setSelection(activePath);
    requestAnimationFrame(() => {
      arboristRef.current?.select(activePath);
      arboristRef.current?.scrollTo(activePath);
    });
  }

  function scheduleRefresh(options: { showLoading?: boolean } = { showLoading: false }) {
    if (refreshDebounce.current) clearTimeout(refreshDebounce.current);
    refreshDebounce.current = setTimeout(() => {
      refreshDebounce.current = null;
      void refreshRoot(options);
    }, 250);
  }

  async function loadChildren(node: NodeApi<ExplorerEntry>) {
    if (!node.data.isDir || node.data.loaded) return;
    const { children, truncated } = await loadDir(node.data.path);
    setTreeData((current) =>
      updateEntry(current, node.data.path, (entry) => ({
        ...entry,
        children,
        loaded: true,
        truncated,
      })),
    );
  }

  async function toggleDir(node: NodeApi<ExplorerEntry>) {
    if (node.isOpen) {
      node.close();
      pendingOpenIds.current.delete(node.data.path);
      setOpenIds((current) => {
        const next = new Set(current);
        next.delete(node.data.path);
        return next;
      });
    } else {
      if (!node.data.loaded) await loadChildren(node);
      scheduleTreeOpen(node.data.path);
    }
  }

  async function prepareDropIntoDir(node: NodeApi<ExplorerEntry>) {
    if (!node.data.isDir || !canDropInto(node.data)) return;
    if (dragOpenPending.current.has(node.data.path)) return;
    dragOpenPending.current.add(node.data.path);
    try {
      if (!node.data.loaded) await loadChildren(node);
      if (!node.isOpen) scheduleTreeOpen(node.data.path);
    } finally {
      setTimeout(() => {
        dragOpenPending.current.delete(node.data.path);
      }, 200);
    }
  }

  function toggleMultiSelect(node: NodeApi<ExplorerEntry>) {
    setSelectedIds((cur) => {
      const next = new Set(cur);
      if (next.has(node.data.id)) next.delete(node.data.id);
      else next.add(node.data.id);
      return next;
    });
  }

  function clearMultiSelect() {
    setSelectedIds((cur) => (cur.size ? new Set<string>() : cur));
  }

  function dragStartEntries(nodes: NodeApi<ExplorerEntry>[]) {
    const primary = nodes[0];
    // 拖拽的是多选集合中的一员且多选 >1 → 批量拖；否则只拖该条。
    const entries =
      primary && selectedIds.has(primary.data.id) && selectedIds.size > 1
        ? [...selectedIds]
            .map((id) => arboristRef.current?.get(id)?.data)
            .filter((entry): entry is ExplorerEntry => !!entry)
        : nodes.map((node) => node.data);
    draggingEntries.current = entries.filter((entry) => canDrag(entry));
  }

  function clearDraggingEntries() {
    draggingEntries.current = [];
    setExplicitDropTargetPath(null);
  }

  function dragOverDir(event: React.DragEvent, node: NodeApi<ExplorerEntry>) {
    if (!canMoveInto(draggingEntries.current, node.data)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setExplicitDropTargetPath(node.data.path);
  }

  function dragLeaveDir(event: React.DragEvent, node: NodeApi<ExplorerEntry>) {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof globalThis.Node && event.currentTarget.contains(nextTarget)) return;
    setExplicitDropTargetPath((path) => (path === node.data.path ? null : path));
  }

  async function dropIntoDir(event: React.DragEvent, node: NodeApi<ExplorerEntry>) {
    if (!canMoveInto(draggingEntries.current, node.data)) return;
    event.preventDefault();
    event.stopPropagation();
    try {
      await moveEntriesToParent(draggingEntries.current, node.data);
    } finally {
      clearDraggingEntries();
    }
  }

  function openCtx(event: React.MouseEvent, node: NodeApi<ExplorerEntry> | null) {
    event.preventDefault();
    event.stopPropagation();
    setCtx({ x: event.clientX, y: event.clientY, node });
  }

  function closeCtx() {
    setCtx(null);
  }

  // 打开「新建文件/文件夹」应用内对话框（WebView 不支持 window.prompt）。
  async function openCreateFileDialog(parent: string) {
    closeCtx();
    // 默认名 = `YYYY-MM-DD-.md`，光标停在末尾「-」后等待补标题（onFocus 处理）。
    const def = await uniqueChildName(parent, `${nowISO().slice(0, 10)}-.md`);
    setNameInput(def);
    setNameDialog({ kind: 'file', parentPath: parent });
  }

  async function openCreateFolderDialog(parent: string) {
    closeCtx();
    const def = await uniqueChildName(parent, 'New Folder');
    setNameInput(def);
    setNameDialog({ kind: 'folder', parentPath: parent });
  }

  // 「+」头部按钮：在当前激活（文件树选中项，回退当前编辑 tab）所属 L3 下新建 md 文件。
  function newFileInActiveL3() {
    const root = useWorkspaceStore.getState().currentFolder;
    if (!root) return;
    const activeAbs = selection ?? useTabsStore.getState().activeTab()?.filePath ?? null;
    if (!activeAbs) {
      useToastsStore.getState().info(t('explorer.newFileNeedL3'));
      return;
    }
    const l3Rel = findEnclosingL3Path(relFor(activeAbs), l3NodePaths);
    if (!l3Rel) {
      useToastsStore.getState().info(t('explorer.newFileNeedL3'));
      return;
    }
    void openCreateFileDialog(joinPath(root, l3Rel));
  }

  async function submitNameDialog() {
    const dialog = nameDialog;
    const raw = nameInput.trim();
    setNameDialog(null);
    if (!dialog || !raw) return;
    if (dialog.kind === 'file') {
      const finalName = /\.[a-z0-9]+$/i.test(raw) ? raw : `${raw}.md`;
      const target = joinPath(dialog.parentPath, finalName);
      // Markdown 文件建后立即写入 frontmatter（= 先存一次，盘上即带默认 YAML）。
      const isMd = /\.(md|markdown|mdown|mkd)$/i.test(finalName);
      try {
        await eidonInvoke('editor:createFile', { path: target, content: isMd ? initialMarkdownContent() : '' });
        scheduleRefresh();
        await files.openPath(target);
      } catch (error) {
        useToastsStore.getState().error(String(error));
      }
    } else {
      try {
        await eidonInvoke('editor:createDir', { path: joinPath(dialog.parentPath, raw) });
        scheduleRefresh();
      } catch (error) {
        useToastsStore.getState().error(String(error));
      }
    }
  }

  async function renameEntry({ node, name }: { node: NodeApi<ExplorerEntry>; name: string }) {
    const clean = name.trim();
    if (!clean || clean === node.data.name) return;
    const target = joinPath(dirname(node.data.path), clean);
    try {
      const rel = relFor(node.data.path);
      if (node.data.isDir && nodeByPath.has(rel)) {
        await useNodesStore.getState().rename({ path: rel, newName: clean });
      } else {
        await eidonInvoke('editor:rename', { from: node.data.path, to: target });
      }
      rewriteOpenTabPaths(node.data.path, target);
      scheduleRefresh();
    } catch (error) {
      useToastsStore.getState().error(String(error));
    }
  }

  async function deleteEntry(node: NodeApi<ExplorerEntry>) {
    closeCtx();
    const ok = window.confirm(
      node.data.isDir
        ? `Delete folder "${node.data.name}" and everything inside?\n\nThis cannot be undone.`
        : `Delete "${node.data.name}"?\n\nThis cannot be undone.`,
    );
    if (!ok) return;
    try {
      await eidonInvoke('editor:delete', { path: node.data.path });
      scheduleRefresh();
      useToastsStore.getState().success(`Deleted ${node.data.name}`);
    } catch (error) {
      useToastsStore.getState().error(`Delete failed: ${error}`);
    }
  }

  async function reveal(entry: ExplorerEntry | null) {
    closeCtx();
    const path = entry?.path ?? useWorkspaceStore.getState().currentFolder;
    if (!path) return;
    try {
      await revealPathInDir(path);
    } catch (error) {
      console.warn('reveal failed', error);
    }
  }

  /** 该条目是否可进入剪贴板/移动到（结构节点不允许：复制会克隆 ULID 身份，移动会破坏层级）。 */
  function canClipboardEntry(node: NodeApi<ExplorerEntry> | null): boolean {
    if (!node) return false;
    return canDrag(node.data);
  }

  function copyEntry(entry: ExplorerEntry, mode: TreeClipboard['mode']) {
    closeCtx();
    setClipboard({ mode, entry });
  }

  /** 粘贴目标合法性：目标是 L3 内目录，且剪切来源不是目标自身/祖先。 */
  function canPasteInto(node: NodeApi<ExplorerEntry> | null): boolean {
    if (!clipboard || !node?.data.isDir || !canDropInto(node.data)) return false;
    if (clipboard.entry.isDir && isSameOrChild(node.data.path, clipboard.entry.path)) return false;
    return true;
  }

  /** 生成目标目录内不冲突的名字：`a.md` → `a 2.md`，`dir` → `dir 2`。 */
  async function uniqueChildName(parentPath: string, desired: string): Promise<string> {
    const { children } = await loadDir(parentPath);
    const taken = new Set(children.map((child) => child.name));
    if (!taken.has(desired)) return desired;
    const dot = desired.lastIndexOf('.');
    const stem = dot > 0 ? desired.slice(0, dot) : desired;
    const ext = dot > 0 ? desired.slice(dot) : '';
    for (let i = 2; i < 1000; i += 1) {
      const candidate = `${stem} ${i}${ext}`;
      if (!taken.has(candidate)) return candidate;
    }
    return `${stem} ${Date.now()}${ext}`;
  }

  /** 递归复制：文件走 copy_file，目录先建再逐项复制（跳过系统目录）。 */
  async function copyEntryRecursive(srcPath: string, dstPath: string, isDir: boolean): Promise<void> {
    if (!isDir) {
      await eidonInvoke('editor:copyFile', { src: srcPath, dst: dstPath });
      return;
    }
    await eidonInvoke('editor:createDir', { path: dstPath });
    const entries = await eidonInvoke('editor:listDir', { path: srcPath, includeHidden: true });
    for (const entry of entries) {
      if (entry.name === TRUNCATED_SENTINEL || SYSTEM_ENTRY_NAMES.has(entry.name)) continue;
      await copyEntryRecursive(entry.path, joinPath(dstPath, entry.name), entry.isDir);
    }
  }

  async function pasteInto(parentPath: string) {
    const clip = clipboard;
    closeCtx();
    if (!clip) return;
    try {
      const name = await uniqueChildName(parentPath, clip.entry.name);
      const target = joinPath(parentPath, name);
      if (clip.mode === 'cut') {
        await eidonInvoke('editor:rename', { from: clip.entry.path, to: target });
        rewriteOpenTabPaths(clip.entry.path, target);
        setClipboard(null);
      } else {
        await copyEntryRecursive(clip.entry.path, target, clip.entry.isDir);
      }
      scheduleRefresh();
    } catch (error) {
      useToastsStore.getState().error(`${clip.mode === 'cut' ? 'Move' : 'Copy'} failed: ${error}`);
    }
  }

  async function copyEntryPath(entry: ExplorerEntry) {
    closeCtx();
    try {
      await writeText(entry.path);
      useToastsStore.getState().success(t('explorer.pathCopied'));
    } catch (error) {
      useToastsStore.getState().error(String(error));
    }
  }

  // 被移动的条目是否为结构节点（L1/L2/L3）→ 走「降级/重定位」（任意节点可作落点）；否则普通文件（仅 L3）。
  const movingStructureNode = moveDialogEntry ? getStructureNode(moveDialogEntry) : null;

  /** 移动落点合法性：节点降级=任意节点（除自身/子树/当前父）；普通文件=仅 L3。 */
  const isValidMoveTarget = (rel: string, level: Level): boolean => {
    if (!moveDialogEntry) return false;
    const movedRel = relFor(moveDialogEntry.path);
    const currentParentRel = parentRelPath(movedRel);
    if (rel === currentParentRel) return false;
    if (rel === movedRel || rel.startsWith(`${movedRel}/`)) return false; // 自身/子树
    if (movingStructureNode) return true; // 节点降级：任意层级节点可作落点
    return level === 3; // 普通文件/文件夹：仅 L3
  };

  function openMoveDialog(entry: ExplorerEntry) {
    closeCtx();
    setMoveFilter('');
    setMoveDialogEntry(entry);
  }

  async function moveToTarget(targetAbs: string, targetName: string) {
    const entry = moveDialogEntry;
    setMoveDialogEntry(null);
    if (!entry) return;
    await moveEntriesToParent([entry], { id: targetAbs, name: targetName, path: targetAbs, isDir: true });
  }

  /** 节点降级/重定位：移到目标节点下；落到第 4 层则剥离身份变普通文件夹。 */
  async function relocateNodeTo(targetRel: string) {
    const entry = moveDialogEntry;
    setMoveDialogEntry(null);
    if (!entry) return;
    try {
      const movedRel = relFor(entry.path);
      const result = await useNodesStore.getState().relocate({ path: movedRel, newParentPath: targetRel });
      rewriteOpenTabPaths(entry.path, joinPath(currentFolder ?? '', result.path));
      useToastsStore.getState().success(
        result.strippedIdentity
          ? t('explorer.relocateStripped', { name: entry.name })
          : t('explorer.moved', { count: '1', target: targetRel.split('/').pop() ?? targetRel }),
      );
      handleNodeChanged();
    } catch (error) {
      useToastsStore.getState().error(`Move failed: ${error}`);
    }
  }

  function onMovePick(rel: string) {
    if (movingStructureNode) void relocateNodeTo(rel);
    else void moveToTarget(joinPath(currentFolder ?? '', rel), rel.split('/').pop() ?? rel);
  }

  /** 一键整理（ADR-0016 的用户显式触发整改）：提升前三层普通文件夹为节点，游离内容文件归入兜底 L3。 */
  async function runNormalize() {
    closeCtx();
    const root = useWorkspaceStore.getState().currentFolder;
    if (!root || normalizing) return;
    const template = useTemplatesStore.getState().templates[0];
    if (!template) {
      useToastsStore.getState().error(t('explorer.normalizeNoTemplate'));
      return;
    }
    if (!window.confirm(t('explorer.normalizeConfirm'))) return;
    setNormalizing(true);
    try {
      const result = await consistencyBridge.normalize(root);
      useToastsStore.getState().success(
        t('explorer.normalizeDone', {
          created: String(result.createdNodes.length),
          moved: String(result.moved.length),
          skipped: String(result.skipped.length),
        }),
        6000,
      );
      handleNodeChanged();
    } catch (error) {
      useToastsStore.getState().error(`Normalize failed: ${error}`);
    } finally {
      setNormalizing(false);
    }
  }

  function openCreateNodeDialog(parentPath: string) {
    closeCtx();
    if (parentPath && parentPath !== useWorkspaceStore.getState().currentFolder) scheduleTreeOpen(parentPath);
    setNodeDialog({ mode: 'create', path: parentPath });
  }

  function openPromoteDialog(path: string) {
    closeCtx();
    const parent = dirname(path);
    if (parent && parent !== useWorkspaceStore.getState().currentFolder) scheduleTreeOpen(parent);
    setNodeDialog({ mode: 'promote', path });
  }

  function openInspector(node: ScannedNode) {
    closeCtx();
    onSelectStructureNode(node);
  }

  function openTodoDialog(node: ScannedNode) {
    closeCtx();
    setTodoDialogNode(node);
  }

  function handleNodeChanged() {
    scheduleRefresh();
    const root = useWorkspaceStore.getState().currentFolder;
    if (root) {
      void scanNodes(root);
      void scanConsistency(root);
      void useTemplatesStore.getState().load(root).catch(() => undefined);
    }
  }

  function rewriteOpenTabPaths(from: string, to: string) {
    const normalize = (value: string) => value.replace(/\\/g, '/').replace(/\/+$/, '');
    const fromNorm = normalize(from);
    const toNorm = normalize(to);
    useTabsStore.setState({
      tabs: useTabsStore.getState().tabs.map((tab) => {
        if (!tab.filePath) return tab;
        const current = normalize(tab.filePath);
        if (current !== fromNorm && !current.startsWith(`${fromNorm}/`)) return tab;
        const suffix = current === fromNorm ? '' : current.slice(fromNorm.length);
        const nextPath = toNorm + suffix;
        return {
          ...tab,
          filePath: nextPath,
          fileName: nextPath.split('/').pop() ?? tab.fileName,
        };
      }),
    });
  }

  async function moveEntriesToParent(entries: ExplorerEntry[], parent: ExplorerEntry | null) {
    if (!canMoveInto(entries, parent)) return;
    let movedCount = 0;
    for (const entry of entries) {
      const target = joinPath(parent!.path, entry.name);
      if (target === entry.path) continue;
      try {
        await eidonInvoke('editor:rename', { from: entry.path, to: target });
        rewriteOpenTabPaths(entry.path, target);
        movedCount += 1;
      } catch (error) {
        useToastsStore.getState().error(`Move failed: ${error}`);
        break;
      }
    }
    if (movedCount > 0) {
      useToastsStore.getState().success(t('explorer.moved', { count: String(movedCount), target: parent!.name }));
    }
    scheduleRefresh();
  }


  useEffect(() => {
    void refreshRoot({ showLoading: true });   // 仅首次加载显示 loading 占位
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFolder]);

  // 「显示隐藏文件」开关变化 → 重新加载文件树（loadDir 据此过滤 `.` 开头项）。
  const didMountHidden = useRef(false);
  useEffect(() => {
    if (!didMountHidden.current) {
      didMountHidden.current = true;
      return;
    }
    scheduleRefresh({ showLoading: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showHiddenFiles]);

  useEffect(() => {
    openIdsRef.current = openIds;
  }, [openIds]);

  // 回调 ref：树容器挂载/卸载时（含异步加载完成后才出现）即时挂/卸 ResizeObserver，
  // 测量真实可用高度喂给 react-arborist 的虚拟列表。旧实现用 [] 依赖的 effect，
  // 首挂时若仍处加载态（.ftree__tree 尚未渲染）则永不挂 observer，treeHeight 卡在默认 320（只显示上半）。
  const setTreeWrap = useCallback((el: HTMLDivElement | null) => {
    treeWrapRef.current = el;
    if (treeResizeObs.current) {
      treeResizeObs.current.disconnect();
      treeResizeObs.current = null;
    }
    if (!el) return;
    const update = () => setTreeHeight(Math.max(120, Math.floor(el.getBoundingClientRect().height)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    treeResizeObs.current = observer;
  }, []);

  useEffect(() => {
    const onSaved = (event: Event) => {
      suppressIndexRefreshUntil.current = Date.now() + 1500;
      const filePath = (event as CustomEvent<{ filePath?: string }>).detail?.filePath;
      if (filePath && isInsideWorkspace(filePath)) {
        void refreshLoadedParentForPath(filePath);
      } else {
        scheduleRefresh({ showLoading: false });
      }
    };
    const onRemotePulled = () => scheduleRefresh();
    const closeFloating = () => {
      setCtx(null);
    };
    const onDocumentPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof globalThis.Node) {
        if (ctxRef.current?.contains(target)) return;
      }
      closeFloating();
    };
    const onDocumentContextMenu = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof globalThis.Node)) return;
      if (ctxRef.current?.contains(target)) return;
      if (treeWrapRef.current?.closest('.ftree')?.contains(target)) return;
      closeFloating();
    };
    const onWindowKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeFloating();
      }
    };
    window.addEventListener('eidon:saved', onSaved as EventListener);
    window.addEventListener('eidon:remote-pulled', onRemotePulled as EventListener);
    document.addEventListener('pointerdown', onDocumentPointerDown, true);
    document.addEventListener('contextmenu', onDocumentContextMenu, true);
    window.addEventListener('keydown', onWindowKey);
    let unlistenIndex: UnlistenFn | null = null;
    (async () => {
      try {
        unlistenIndex = await listen('eidon://index-updated', () => {
          if (Date.now() < suppressIndexRefreshUntil.current) return;
          scheduleRefresh({ showLoading: false });
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      window.removeEventListener('eidon:saved', onSaved as EventListener);
      window.removeEventListener('eidon:remote-pulled', onRemotePulled as EventListener);
      document.removeEventListener('pointerdown', onDocumentPointerDown, true);
      document.removeEventListener('contextmenu', onDocumentContextMenu, true);
      window.removeEventListener('keydown', onWindowKey);
      if (unlistenIndex) unlistenIndex();
      if (refreshDebounce.current) clearTimeout(refreshDebounce.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ctxCreateLevel = ctx ? createLevelFor(ctx.node) : null;
  const ctxPromoteLevel = ctx ? promoteLevelFor(ctx.node) : null;
  const ctxStructureNode = ctx?.node?.data.isDir ? getStructureNode(ctx.node.data) : null;
  const ctxTargetPath = ctx?.node?.data.path ?? currentFolder ?? '';
  // 工作区当前结构违规总数（>0 时显示「一键整理」入口）
  const violationCount = [...violationsByPath.values()].reduce((sum, list) => sum + list.length, 0);

  return (
    <aside className="ftree" onContextMenu={(event) => openCtx(event, null)}>
      <div className="ftree__header">
        <span>{t('explorer.title')}</span>
        <div className="ftree__header-btns">
          {violationCount > 0 && (
            <button
              className="ftree__hbtn ftree__hbtn--normalize"
              title={t('explorer.normalizeTitle', { count: String(violationCount) })}
              onClick={() => void runNormalize()}
              disabled={normalizing || !currentFolder}
            >
              <Icon name="sparkles" size={13} />
              <span className="ftree__hbtn-count">{violationCount}</span>
            </button>
          )}
          {/* 在文件树中定位当前文件 */}
          <button
            className="ftree__hbtn"
            title={t('explorer.locateFile')}
            onClick={() => void revealActiveFileInTree()}
            disabled={!currentFolder}
          >
            <Icon name="focus" size={13} />
          </button>
          <button
            className="ftree__hbtn"
            title={t('explorer.newFileHeader')}
            onClick={newFileInActiveL3}
            disabled={!currentFolder}
          >
            <Icon name="new-text" size={13} />
          </button>
          <button className="ftree__hbtn" title={t('explorer.refresh')} onClick={() => scheduleRefresh()} disabled={!currentFolder}>
            <Icon name="refresh" size={13} />
          </button>
        </div>
      </div>

      {!currentFolder ? (
        <div className="ftree__empty">
          <button className="ftree__open-btn" onClick={() => files.openFolder()}>{t('explorer.openFolder')}</button>
        </div>
      ) : (
        <div className="ftree__body">
          {/*
            仅「首次加载（尚无树数据）」时显示加载占位；一旦有数据，刷新（新建/删除/重命名/移动/粘贴
            等都会 scheduleRefresh）期间保持 <Tree> 挂载、就地更新 data——绝不 unmount→remount。
            模块级 noopDndBackend 桩后端作为主防线，阻止 react-arborist 多次创建 HTML5Backend。
          */}
          {rootLoading && treeData.length === 0 ? (
            <div className="ftree__loading">
              <span className="ftree__spinner" aria-hidden="true" />
              <span>Loading…</span>
            </div>
          ) : (
            <div className="ftree__tree" ref={setTreeWrap}>
              <Tree<ExplorerEntry>
                ref={arboristRef}
                data={treeData}
                width="100%"
                height={treeHeight}
                rowHeight={26}
                indent={12}
                overscanCount={10}
                idAccessor="id"
                childrenAccessor="children"
                openByDefault={false}
                selection={selection}
                disableMultiSelection
                dndBackend={noopDndBackend}  /* 单例桩后端 — 防 “Cannot have two HTML5 backends” 崩溃 */
                /* react-arborist 自带 DnD 整体停用：拖拽移动由行上的原生 HTML5 事件实现
                   （此前两套 DnD 并存导致”只有拖拽动画、不执行实际移动”） */
                disableDrag
                disableDrop
                onSelect={(nodes) => setSelection(nodes[0]?.id)}
                onRename={renameEntry}
              >
                {(props) => (
                  <ExplorerNode
                    {...props}
                    getStructureNode={getStructureNode}
                    getTemplateVisual={getTemplateVisual}
                    getViolations={getViolations}
                    canDragEntry={canDrag}
                    onOpenFile={(entry) => void files.openPath(entry.path)}
                    onSelectStructureNode={onSelectStructureNode}
                    onToggleDir={(entryNode) => void toggleDir(entryNode)}
                    onDragStartEntries={dragStartEntries}
                    onDragEndEntries={clearDraggingEntries}
                    onDragEnterDir={(entryNode) => void prepareDropIntoDir(entryNode)}
                    onDragOverDir={dragOverDir}
                    onDragLeaveDir={dragLeaveDir}
                    onDropIntoDir={(event, entryNode) => void dropIntoDir(event, entryNode)}
                    onContextMenu={openCtx}
                    isExplicitDropTarget={(entry) => explicitDropTargetPath === entry.path}
                    isMultiSelected={(entry) => selectedIds.has(entry.id)}
                    onToggleMultiSelect={toggleMultiSelect}
                    onClearMultiSelect={clearMultiSelect}
                  />
                )}
              </Tree>
              {rootTruncated && (
                <div className="ftree__truncated" title="This folder has more than 10,000 entries; showing the first batch.">
                  + 10,000+ more
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {ctx && (
        <div
          ref={ctxRef}
          className="ftree__ctx"
          style={{ left: `${ctx.x}px`, top: `${ctx.y}px` }}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          {ctxCreateLevel && ctxTargetPath && (
            <>
              <button className="ftree__ctx-item" onClick={() => openCreateNodeDialog(ctxTargetPath)}>
                <Icon name="insert" size={14} /> {t(`explorer.newL${ctxCreateLevel}Node`)}
              </button>
              <div className="ftree__ctx-sep" />
            </>
          )}
          {ctxPromoteLevel && ctx.node && (
            <>
              <button className="ftree__ctx-item" onClick={() => openPromoteDialog(ctx.node!.data.path)}>
                <Icon name="package" size={14} /> {t('explorer.promoteToNode', { level: ctxPromoteLevel })}
              </button>
              <div className="ftree__ctx-sep" />
            </>
          )}
          {ctxStructureNode && (
            <>
              <button className="ftree__ctx-item" onClick={() => openInspector(ctxStructureNode)}>
                <Icon name="clipboard" size={14} /> {t('explorer.editNodeFields')}
              </button>
              <button className="ftree__ctx-item" onClick={() => openTodoDialog(ctxStructureNode)}>
                <Icon name="todos" size={14} /> {t('explorer.createTodo')}
              </button>
              <button className="ftree__ctx-item" onClick={() => ctx.node && openMoveDialog(ctx.node.data)}>
                <Icon name="arrow-right" size={14} /> {t('explorer.moveNodeTo')}
              </button>
            </>
          )}
          {canCreateContent(ctx.node) && (
            <>
              {ctxStructureNode && <div className="ftree__ctx-sep" />}
              <button className="ftree__ctx-item" onClick={() => void openCreateFileDialog(ctx.node!.data.path)}>
                <Icon name="new-text" size={14} /> {t('explorer.newFile')}
              </button>
              <button className="ftree__ctx-item" onClick={() => void openCreateFolderDialog(ctx.node!.data.path)}>
                <Icon name="folder-plus" size={14} /> {t('explorer.newFolder')}
              </button>
              <div className="ftree__ctx-sep" />
            </>
          )}
          {/* 编辑组：复制 / 剪切 / 移动到（结构节点不参与——复制克隆 ULID、移动破坏层级）+ 粘贴 */}
          {canClipboardEntry(ctx.node) && (
            <>
              <button className="ftree__ctx-item" onClick={() => copyEntry(ctx.node!.data, 'copy')}>
                <Icon name="clipboard" size={14} /> {t('explorer.copy')}
              </button>
              <button className="ftree__ctx-item" onClick={() => copyEntry(ctx.node!.data, 'cut')}>
                <Icon name="clear" size={14} /> {t('explorer.cut')}
              </button>
              <button className="ftree__ctx-item" onClick={() => openMoveDialog(ctx.node!.data)}>
                <Icon name="arrow-right" size={14} /> {t('explorer.moveTo')}
              </button>
            </>
          )}
          {canPasteInto(ctx.node) && (
            <button className="ftree__ctx-item" onClick={() => void pasteInto(ctx.node!.data.path)}>
              <Icon name="package" size={14} /> {t('explorer.paste')}
              <span className="ftree__ctx-hint">{clipboard?.entry.name}</span>
            </button>
          )}
          {(canClipboardEntry(ctx.node) || canPasteInto(ctx.node)) && <div className="ftree__ctx-sep" />}
          {ctx.node && (
            <button className="ftree__ctx-item" onClick={() => { closeCtx(); void ctx.node!.edit(); }}>
              <Icon name="pencil" size={14} /> {t('explorer.rename')}
            </button>
          )}
          {ctx.node && (
            <button className="ftree__ctx-item ftree__ctx-item--danger" onClick={() => void deleteEntry(ctx.node!)}>
              <Icon name="trash" size={14} /> {t('explorer.delete')}
            </button>
          )}
          <div className="ftree__ctx-sep" />
          {ctx.node && (
            <button className="ftree__ctx-item" onClick={() => void copyEntryPath(ctx.node!.data)}>
              <Icon name="file-code" size={14} /> {t('explorer.copyPath')}
            </button>
          )}
          <button className="ftree__ctx-item" onClick={() => void reveal(ctx.node?.data ?? null)}>
            <Icon name="search" size={14} /> {t('explorer.reveal')}
          </button>
        </div>
      )}

      {/* 「移动到…」对话框：列出全部 L3 节点（文件只能落在 L3 内，铁律见 AGENTS.md §3.1） */}
      {moveDialogEntry && (
        <div className="node-dialog__backdrop" onClick={() => setMoveDialogEntry(null)}>
          <div className="node-dialog ftree__move" onClick={(event) => event.stopPropagation()}>
            <div className="ftree__move-head">
              <span className="ftree__move-title">
                {t('explorer.moveToTitle', { name: moveDialogEntry.name })}
              </span>
              <button className="rs-pane-close" onClick={() => setMoveDialogEntry(null)}>
                <Icon name="close" size={14} />
              </button>
            </div>
            <div className="ftree__move-filter">
              <Icon name="search" size={13} />
              <input
                autoFocus
                value={moveFilter}
                placeholder={t('explorer.moveToFilter')}
                onChange={(event) => setMoveFilter(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setMoveDialogEntry(null);
                }}
              />
            </div>
            {scannedNodes.length === 0 ? (
              <div className="ftree__move-empty">{t('explorer.moveToEmpty')}</div>
            ) : (
              <NodeTreePicker
                nodes={scannedNodes.map((scanned) => ({ path: scanned.path, level: scanned.node.level }))}
                isValidTarget={isValidMoveTarget}
                filter={moveFilter}
                onPick={onMovePick}
              />
            )}
          </div>
        </div>
      )}

      {/* 新建文件/文件夹输入对话框 */}
      {nameDialog && (
        <div className="node-dialog__backdrop" onClick={() => setNameDialog(null)}>
          <div className="node-dialog ftree__name-dialog" onClick={(event) => event.stopPropagation()}>
            <div className="ftree__move-head">
              <span className="ftree__move-title">
                {nameDialog.kind === 'file' ? t('explorer.newFile') : t('explorer.newFolder')}
              </span>
              <button className="rs-pane-close" onClick={() => setNameDialog(null)}>
                <Icon name="close" size={14} />
              </button>
            </div>
            <div className="ftree__name-dialog-body">
              <input
                autoFocus
                value={nameInput}
                spellCheck={false}
                onChange={(event) => setNameInput(event.target.value)}
                onFocus={(event) => {
                  // 光标停在扩展名前（日期文件名 → 落在末尾「-」之后，等待补标题；文件夹 → 落在末尾）。
                  const dot = nameInput.lastIndexOf('.');
                  const caret = dot > 0 ? dot : nameInput.length;
                  event.currentTarget.setSelectionRange(caret, caret);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setNameDialog(null);
                  if (event.key === 'Enter') void submitNameDialog();
                }}
              />
            </div>
            <div className="ftree__name-dialog-actions">
              <button onClick={() => setNameDialog(null)}>{t('explorer.nameDialogCancel')}</button>
              <button className="primary-btn" disabled={!nameInput.trim()} onClick={() => void submitNameDialog()}>
                {t('explorer.nameDialogConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {nodeDialog && (
        <NodeCreateDialog
          open
          mode={nodeDialog.mode}
          path={nodeDialog.path}
          onClose={() => setNodeDialog(null)}
          onChanged={handleNodeChanged}
        />
      )}

      {todoDialogNode && (
        <TodoCreateDialog
          node={todoDialogNode}
          onClose={() => setTodoDialogNode(null)}
        />
      )}

    </aside>
  );
}

export default FileTree;
