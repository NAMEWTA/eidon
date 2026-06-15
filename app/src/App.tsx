/**
 * App.tsx — 应用外壳（从 App.vue 迁移）。
 *
 * 布局：Toolbar / 工作区（FileTree + 内容 + 右侧栏可重排面板）/ StatusBar；reading 模式整屏切到 ReadingView。
 * 所有模态对话框常挂底部。窗格平铺由 TileRoot；右侧栏面板按 settings.rsPaneOrder 排序、可拖拽重排、
 * 可拖拽分隔条调高、整体显隐带"隐藏时快照、恢复时还原"。
 *
 * Vue→React：
 *  - 纯 DOM 副作用（--ui-font-size / zoom / --content-font-size / data-theme）已由 effects/dom-effects
 *    集中处理（main.tsx 启动挂载），此处不再重复。
 *  - 其余 watch/watchEffect → 在挂载 effect 内用 store.subscribe + 初值调用复刻（含 immediate 语义）。
 *  - provide('showUnsavedDialog') → window.__eidon_showUnsavedDialog（useFiles 读 window 兜底）。
 *  - <Teleport to="body"> → createPortal。emits → 回调 props。生命周期 composable start/stop → effect cleanup。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from './components/Icons';
import { getCurrentWebview, getCurrentWindow, listen, invoke, type UnlistenFn } from '../core/bridge/tauri';
import { Toolbar } from './components/Toolbar';
import { TileRoot } from './components/TileRoot';
import { StatusBar } from './components/StatusBar';
import { CommandPalette } from './components/CommandPalette';
import { QuickSwitcher } from './components/QuickSwitcher';
import { Outline } from './components/Outline';
import { BacklinksPanel } from './components/BacklinksPanel';
import { TagsPanel } from './components/TagsPanel';
import { HistoryPanel } from './components/HistoryPanel';
import { NodePropertiesPanel } from './components/NodePropertiesPanel';
import { FilePropertiesPanel } from './components/FilePropertiesPanel';
import { ActivityBar } from './components/ActivityBar';
import { CalendarPanel } from './components/CalendarPanel';
import { TodoListPanel } from './components/TodoListPanel';
import { useAutoCommit } from './composables/useAutoCommit';
import { useSessionRestore } from './composables/useSessionRestore';
import { SessionRestoreDialog } from './components/SessionRestoreDialog';
import { BasesView } from './components/BasesView';
import { BASES_OPEN_EVENT, BASES_CLOSE_EVENT } from './composables/useBasesView';
import { FileTree } from './components/FileTree';
import { SettingsPanel } from './components/SettingsPanel';
import { MarkdownHelp } from './components/MarkdownHelp';
import { GlobalSearch } from './components/GlobalSearch';
import { CjkProofread } from './components/CjkProofread';
import { ReadingView } from './components/ReadingView';
import { AboutDialog } from './components/AboutDialog';
import { UnsavedDialog } from './components/UnsavedDialog';
import { FileChangedDialog } from './components/FileChangedDialog';
import { Toast } from './components/Toast';
import { useTabsStore } from './stores/tabs';
import { useSettingsStore } from './stores/settings';
import { useTilesStore } from './stores/tiles';
import { usePomodoroStore } from './stores/pomodoro';
import { useFiles } from './composables/useFiles';
import { useExport } from './composables/useExport';
import { useShortcuts } from './composables/useShortcuts';
import { useFileWatcher } from './composables/useFileWatcher';
import { loadCustomTheme } from './lib/custom-theme';
import { isIOS } from './lib/platform';
import { useI18n } from './i18n';
import { openWelcomeTour } from './lib/welcome-tour';
import { useWorkspaceStore } from './stores/workspace';
import { useWorkspaceIndexStore } from './stores/workspaceIndex';
import { useNodesStore } from './stores/nodes';
import { useTodosStore } from './stores/todos';
import { splitFrontMatter, stringifyFrontMatter } from './lib/frontmatter';
import type { ScannedNode } from '../core/nodes';

export function App() {
  const { t } = useI18n();
  const files = useFiles();
  const exporter = useExport();

  // 渲染所需切片订阅（最小化重渲：避免订阅整 tabs 内容随键入刷新整壳）。
  const settings = useSettingsStore();
  const currentFolder = useWorkspaceStore((s) => s.currentFolder);
  const scannedNodes = useNodesStore((s) => s.nodes);
  const tilesRoot = useTilesStore((s) => s.root);

  const [cursorLine, setCursorLine] = useState(1);
  const [cursorCol, setCursorCol] = useState(1);
  const [selectionText, setSelectionText] = useState('');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [quickSwitcherOpen, setQuickSwitcherOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialSection, setSettingsInitialSection] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [searchPrefill, setSearchPrefill] = useState<string | undefined>(undefined);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [cjkProofreadOpen, setCjkProofreadOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [basesOpen, setBasesOpen] = useState(false);

  // Unsaved-changes 对话框。
  const [unsavedOpen, setUnsavedOpen] = useState(false);
  const [unsavedMode, setUnsavedMode] = useState<'tab' | 'window'>('tab');
  const [unsavedFileName, setUnsavedFileName] = useState('');
  const [unsavedCount, setUnsavedCount] = useState(0);
  const unsavedResolveRef = useRef<((action: 'save' | 'discard' | 'cancel') => void) | null>(null);

  // File-changed 对话框。
  const [fileChangedOpen, setFileChangedOpen] = useState(false);
  const [fileChangedFileName, setFileChangedFileName] = useState('');
  const fileChangedResolveRef = useRef<((action: 'reload' | 'overwrite' | 'cancel') => void) | null>(null);

  // ---- 未保存 / 文件变更对话框：稳定回调（供 useFiles/useFileWatcher 用）----
  const showUnsavedDialog = useCallback(
    (mode: 'tab' | 'window', fileName: string, count: number): Promise<'save' | 'discard' | 'cancel'> => {
      setUnsavedMode(mode);
      setUnsavedFileName(fileName);
      setUnsavedCount(count);
      setUnsavedOpen(true);
      return new Promise((resolve) => {
        unsavedResolveRef.current = resolve;
      });
    },
    [],
  );
  function onUnsavedAction(action: 'save' | 'discard' | 'cancel') {
    setUnsavedOpen(false);
    if (unsavedResolveRef.current) {
      unsavedResolveRef.current(action);
      unsavedResolveRef.current = null;
    }
  }

  const showFileChangedDialog = useCallback(
    (fileName: string): Promise<'reload' | 'overwrite' | 'cancel'> => {
      setFileChangedFileName(fileName);
      setFileChangedOpen(true);
      return new Promise((resolve) => {
        fileChangedResolveRef.current = resolve;
      });
    },
    [],
  );
  function onFileChangedAction(action: 'reload' | 'overwrite' | 'cancel') {
    setFileChangedOpen(false);
    if (fileChangedResolveRef.current) {
      fileChangedResolveRef.current(action);
      fileChangedResolveRef.current = null;
    }
  }

  // useFiles（inject 兜底）需要 window 全局；尽早设置。
  if (typeof window !== 'undefined') {
    (window as unknown as { __eidon_showUnsavedDialog?: typeof showUnsavedDialog }).__eidon_showUnsavedDialog = showUnsavedDialog;
  }

  // 快捷键（薄 hook：useEffect 挂 keydown）。
  useShortcuts({
    openPalette: () => setPaletteOpen(true),
    openSettings: () => setSettingsOpen(true),
    openHelp: () => setHelpOpen(true),
    openGlobalSearch: () => useSettingsStore.getState().toggleLeftPanelView('search'),
    openQuickSwitcher: () => setQuickSwitcherOpen(true),
    openCjkProofread: () => setCjkProofreadOpen(true),
  });
  useFileWatcher(showFileChangedDialog);

  function onCursor(line: number, col: number) {
    setCursorLine(line);
    setCursorCol(col);
  }
  function onSelection(text: string) {
    setSelectionText(text);
  }
  function onOutlineGoto(line: number) {
    window.dispatchEvent(new CustomEvent('eidon:outline-goto', { detail: { line, paneId: useTilesStore.getState().focusedPaneId } }));
  }

  // ---- 节点选择与面板联动 ----
  const selectedStructureNode = selectedNodeId
    ? scannedNodes.find((node) => node.node.id === selectedNodeId) ?? null
    : null;

  // ---- 抽屉可见性（由 settings 字段派生） ----
  const leftPanelView = settings.leftPanelView;
  const rightPanelView = settings.rightPanelView;
  const leftDrawerOpen = leftPanelView !== null;
  const rightDrawerOpen = rightPanelView !== null;

  function onFilterTag(tag: string) {
    const newPrefill = `#${tag}`;
    if (leftPanelView === 'search' && searchPrefill === newPrefill) {
      setSearchPrefill(undefined);
      requestAnimationFrame(() => setSearchPrefill(newPrefill));
    } else {
      setSearchPrefill(newPrefill);
    }
    useSettingsStore.getState().setLeftPanelView('search');
  }

  // ---- 侧栏宽度（可拖拽）----
  const drawerWidth = settings.sideSidebarWidth;
  const drawerStyle: React.CSSProperties = { width: `${drawerWidth}px`, flexBasis: `${drawerWidth}px` };
  const fileTreeWidth = settings.fileTreeWidth;
  const fileTreeStyle: React.CSSProperties = { width: `${fileTreeWidth}px`, flexBasis: `${fileTreeWidth}px` };

  function onSelectStructureNode(node: ScannedNode | null) {
    setSelectedNodeId(node?.node.id ?? null);
    if (node) useSettingsStore.getState().setRightPanelView('node');
  }

  function onFileTreeResize(ev: React.MouseEvent) {
    ev.preventDefault();
    const startX = ev.clientX;
    const startW = fileTreeWidth;
    let relayoutPending = false;
    const queueRelayout = () => {
      if (relayoutPending) return;
      relayoutPending = true;
      requestAnimationFrame(() => {
        relayoutPending = false;
        window.dispatchEvent(new CustomEvent('eidon:relayout'));
      });
    };
    const onMove = (m: MouseEvent) => {
      useSettingsStore.getState().setFileTreeWidth(startW + (m.clientX - startX));
      queueRelayout();
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.dispatchEvent(new CustomEvent('eidon:relayout'));
    };
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function onSidebarResize(side: 'left' | 'right', ev: React.MouseEvent) {
    ev.preventDefault();
    const startX = ev.clientX;
    const startW = drawerWidth;
    const onMove = (m: MouseEvent) => {
      const dx = m.clientX - startX;
      const delta = side === 'right' ? -dx : dx;
      useSettingsStore.getState().setSideSidebarWidth(startW + delta);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // ---- 缩放快捷键（三轴） ----
  function onZoomShortcut(e: KeyboardEvent): boolean {
    const cmd = e.metaKey;
    const ctrlOnly = e.ctrlKey && !e.metaKey;
    if (!cmd && !ctrlOnly) return false;
    if (e.altKey) return false;
    let axis: 'ui' | 'editor' | 'preview' = 'ui';
    if (e.shiftKey && !(e.metaKey && e.ctrlKey)) axis = 'editor';
    else if (e.metaKey && e.ctrlKey) axis = 'preview';
    const isIn = e.key === '=' || e.key === '+';
    const isOut = e.key === '-' || e.key === '_';
    const isReset = e.key === '0';
    if (!isIn && !isOut && !isReset) return false;
    e.preventDefault();
    const s = useSettingsStore.getState();
    if (axis === 'editor') {
      if (isIn) s.editorFontIn();
      else if (isOut) s.editorFontOut();
      else s.resetEditorFontSize();
    } else if (axis === 'preview') {
      if (isIn) s.previewFontIn();
      else if (isOut) s.previewFontOut();
      else s.resetPreviewFontSize();
    } else {
      if (isIn) s.zoomIn();
      else if (isOut) s.zoomOut();
      else s.resetZoom();
    }
    return true;
  }

  function onEsc(e: KeyboardEvent) {
    if (onZoomShortcut(e)) return;
    if (e.key !== 'Escape') return;
    if (aboutOpen) setAboutOpen(false);
    else if (cjkProofreadOpen) setCjkProofreadOpen(false);
    else if (fileChangedOpen) setFileChangedOpen(false);
    else if (helpOpen) setHelpOpen(false);
    else if (quickSwitcherOpen) setQuickSwitcherOpen(false);
    else if (paletteOpen) setPaletteOpen(false);
    else if (settingsOpen) setSettingsOpen(false);
    else if (useSettingsStore.getState().viewMode === 'reading') useSettingsStore.getState().exitReadingMode();
  }
  // window keydown 用 latest-callback ref，避免 onEsc 读到陈旧 state。
  const onEscRef = useRef(onEsc);
  onEscRef.current = onEsc;

  // ---- 视口尺寸变化 → 触发编辑器 relayout（抽屉切换时）----
  const drawerSig = `${leftPanelView ?? ''}|${rightPanelView ?? ''}`;
  const didMountRelayout = useRef(false);
  useEffect(() => {
    if (!didMountRelayout.current) {
      didMountRelayout.current = true;
      return;
    }
    requestAnimationFrame(() => window.dispatchEvent(new CustomEvent('eidon:relayout')));
  }, [drawerSig]);

  useEffect(() => {
    setSelectedNodeId(null);
  }, [currentFolder]);

  // 节点级待办：工作区/节点树变化时重新聚合 .node/todos.json 并（首次）启动提醒调度器。
  useEffect(() => {
    if (currentFolder) void useTodosStore.getState().loadAll(currentFolder);
  }, [currentFolder, scannedNodes]);

  // 切换 / 打开文件标签时清空结构节点选择，使右抽屉「属性」视图随最近交互对象在
  // 节点属性 ↔ 文件属性间互斥切换（选中目录节点 → 节点属性；聚焦 md 文件 → 文件属性）。
  const activeTabId = useTabsStore((s) => s.activeId);
  useEffect(() => {
    setSelectedNodeId(null);
  }, [activeTabId]);

  // ---- 挂载：生命周期 composable、所有 window/Tauri 监听、store.subscribe watchers、onMounted 异步块 ----
  const autoCommit = useAutoCommit();
  const sessionRestore = useSessionRestore();
  useEffect(() => {
    autoCommit.start();
    sessionRestore.start();
    usePomodoroStore.getState().rehydrate();
    (window as unknown as { usePomodoroStore?: typeof usePomodoroStore }).usePomodoroStore = usePomodoroStore;
    try {
      localStorage.removeItem('eidon.window.v1');
    } catch {
      /* ignore */
    }

    // --- 菜单动作派发 ---
    function dispatchMenuAction(id: string) {
      const s = useSettingsStore.getState();
      const tabsS = useTabsStore.getState();
      switch (id) {
        case 'file.new': files.newFile(); break;
        case 'file.newText': files.newTextFile(); break;
        case 'file.openFolder': files.openFolder(); break;
        case 'file.save': files.saveActive(); break;
        case 'file.saveAs': files.saveActiveAs(); break;
        case 'file.print': exporter.exportPdfPrint(); break;
        case 'file.closeTab': if (tabsS.activeId) files.closeTabSafe(tabsS.activeId); break;
        case 'view.toggleTheme': s.toggleTheme(); break;
        case 'view.toggleFileTree': s.toggleLeftPanelView('explorer'); break;
        case 'view.toggleOutline': s.toggleRightPanelView('outline'); break;
        case 'view.cycleView': s.cycleViewMode(); break;
        case 'view.zoomUiIn': s.zoomIn(); break;
        case 'view.zoomUiOut': s.zoomOut(); break;
        case 'view.zoomUiReset': s.resetZoom(); break;
        case 'view.zoomEditorIn': s.editorFontIn(); break;
        case 'view.zoomEditorOut': s.editorFontOut(); break;
        case 'view.zoomEditorReset': s.resetEditorFontSize(); break;
        case 'view.zoomPreviewIn': s.previewFontIn(); break;
        case 'view.zoomPreviewOut': s.previewFontOut(); break;
        case 'view.zoomPreviewReset': s.resetPreviewFontSize(); break;
        case 'view.cmdPalette': setPaletteOpen(true); break;
        case 'view.settings': setSettingsOpen(true); break;
        case 'search.global': s.toggleLeftPanelView('search'); break;
        case 'help.markdown': setHelpOpen(true); break;
        case 'help.about': setAboutOpen(true); break;
        default: console.warn('unknown menu action', id);
      }
    }

    // --- window 事件处理器（仅用 setters/getState，稳定）---
    const onEscListener = (e: KeyboardEvent) => onEscRef.current(e);
    const onWindowBlur = () => void files.autoSaveDirtyTabs();
    const onOpenHelpEvent = () => setHelpOpen(true);
    const onOpenSearchEvent = () => useSettingsStore.getState().toggleLeftPanelView('search');
    const onOpenCjkProofreadEvent = () => setCjkProofreadOpen(true);
    const onOpenBases = () => setBasesOpen(true);
    const onCloseBases = () => setBasesOpen(false);
    const onSelectStructureNodeEvent = (event: Event) => {
      const nodeId = (event as CustomEvent<{ nodeId?: string }>).detail?.nodeId;
      if (!nodeId) return;
      setSelectedNodeId(nodeId);
      useSettingsStore.getState().setRightPanelView('node');
    };
    const onWikiOpen = async (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      const target: string = detail.target || '';
      if (!target) return;
      const path = await useWorkspaceIndexStore.getState().resolve(target);
      if (path) {
        await files.openPath(path);
      } else {
        const fileName = /\.md$/i.test(target) ? target : `${target}.md`;
        const tab = useTabsStore.getState().newTab({ fileName, language: 'markdown' });
        // newTab 已初始化 frontmatter（created/updated）；在正文前追加标题。
        const { data, body } = splitFrontMatter(tab.content);
        const fullContent = stringifyFrontMatter(data, `# ${target}\n\n${body}`);
        useTabsStore.getState().setContent(tab.id, fullContent);
        useTabsStore.getState().activate(tab.id);
      }
    };
    const onOpenSettingsEvent = (e: Event) => {
      const section = (e as CustomEvent).detail?.section ?? null;
      setSettingsInitialSection(section);
      setSettingsOpen(true);
    };
    const onRemotePulled = () => {
      void useWorkspaceIndexStore.getState().rescan();
    };

    window.addEventListener('keydown', onEscListener);
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('eidon:open-help', onOpenHelpEvent as EventListener);
    window.addEventListener('eidon:open-global-search', onOpenSearchEvent as EventListener);
    window.addEventListener('eidon:open-cjk-proofread', onOpenCjkProofreadEvent as EventListener);
    window.addEventListener('eidon:select-structure-node', onSelectStructureNodeEvent as EventListener);
    window.addEventListener('eidon:wiki-open', onWikiOpen as EventListener);
    window.addEventListener(BASES_OPEN_EVENT, onOpenBases as EventListener);
    window.addEventListener(BASES_CLOSE_EVENT, onCloseBases as EventListener);
    window.addEventListener('eidon:open-settings', onOpenSettingsEvent as EventListener);
    window.addEventListener('eidon:remote-pulled', onRemotePulled);

    // --- store.subscribe watchers（复刻 Vue watch / watchEffect）---
    const computeTabsSig = () =>
      useTabsStore
        .getState()
        .tabs.map((tb) => [tb.id, tb.fileName, tb.filePath, tb.content, tb.savedContent, tb.language].join('|'))
        .join(';');
    let prevTabsSig = computeTabsSig();
    let prevActiveId = useTabsStore.getState().activeId;
    let prevFileName = useTabsStore.getState().activeTab()?.fileName;

    // 标题（immediate）。
    function applyTitle(name: string | undefined) {
      const title = name ? `${name} — EIDON` : 'EIDON';
      try {
        void getCurrentWindow().setTitle(title);
      } catch {
        /* 非 Tauri 环境静默 */
      }
    }
    applyTitle(prevFileName);
    // iOS 默认阅读模式（immediate）。
    function maybeIosReading() {
      const aid = useTabsStore.getState().activeId;
      if (!aid) return;
      if (!isIOS()) return;
      const s = useSettingsStore.getState();
      if (!s.readingByDefaultOnMobile) return;
      const tab = useTabsStore.getState().activeTab();
      if (!tab || tab.language !== 'markdown') return;
      if (s.viewMode === 'reading') return;
      useSettingsStore.setState({ lastNonReadingViewMode: s.viewMode, viewMode: 'reading' });
      useSettingsStore.getState().persist();
    }
    maybeIosReading();

    const unsubTabs = useTabsStore.subscribe(() => {
      const sig = computeTabsSig();
      const aid = useTabsStore.getState().activeId;
      const fileName = useTabsStore.getState().activeTab()?.fileName;
      if (sig !== prevTabsSig || aid !== prevActiveId) {
        useTabsStore.getState().persist();
        useTilesStore.getState().persist();
      }
      if (aid !== prevActiveId) {
        if (aid) useTilesStore.getState().syncFromTabs(aid);
        maybeIosReading();
      }
      if (fileName !== prevFileName) {
        applyTitle(fileName);
      }
      prevTabsSig = sig;
      prevActiveId = aid;
      prevFileName = fileName;
    });

    let prevRootJson = JSON.stringify(useTilesStore.getState().root);
    const unsubTiles = useTilesStore.subscribe(() => {
      const r = JSON.stringify(useTilesStore.getState().root);
      if (r !== prevRootJson) {
        prevRootJson = r;
        useTilesStore.getState().persist();
      }
    });

    // settings + workspace 驱动的 watchEffect 集合（首次 reconcile 复刻 immediate）。
    let prevLang: string | undefined;
    let prevIdxFolder: string | null | undefined;
    let spellcheckLoaded = false;
    let prevCss: string | undefined;
    function reconcile() {
      const s = useSettingsStore.getState();
      const ws = useWorkspaceStore.getState();
      if (s.language !== prevLang) {
        prevLang = s.language;
        invoke('set_menu_language', { lang: s.language }).catch(() => {});
        invoke('save_language_preference', { lang: s.language }).catch(() => {});
      }
      if (ws.currentFolder !== prevIdxFolder) {
        prevIdxFolder = ws.currentFolder;
        useWorkspaceIndexStore.getState().setFolder(ws.currentFolder).catch(() => {});
        if (ws.currentFolder) {
          useNodesStore.getState().ensureDefaultInbox(ws.currentFolder)
            .then(() => {
              window.dispatchEvent(new CustomEvent('eidon:saved', { detail: { filePath: ws.currentFolder } }));
            })
            .catch((error) => console.warn('default inbox init failed', error));
        }
      }
      if (s.spellcheckEnabled && !spellcheckLoaded) {
        invoke('spellcheck_init', { lang: 'en_US' })
          .then(() => { spellcheckLoaded = true; })
          .catch((e) => console.warn('spellcheck_init failed', e));
      }
      if (s.customCssPath !== prevCss) {
        prevCss = s.customCssPath;
        loadCustomTheme(s.customCssPath);
      }
    }
    reconcile();
    const unsubSettings = useSettingsStore.subscribe(() => reconcile());
    const unsubWorkspace = useWorkspaceStore.subscribe(() => reconcile());

    // --- onMounted 异步块 ---
    let unlistenMenu: UnlistenFn | null = null;
    let unlistenClose: UnlistenFn | null = null;
    (async () => {
      const s0 = useSettingsStore.getState();
      // #87(3) 固定启动视图模式。
      if (s0.startupViewMode && s0.startupViewMode !== s0.viewMode) {
        s0.setViewMode(s0.startupViewMode);
      }

      // 首启欢迎导览。
      const sNow = useSettingsStore.getState();
      const tabsNow = useTabsStore.getState();
      const isFreshLaunch = tabsNow.tabs.length === 0 && !sNow.welcomeShown;
      if (isFreshLaunch) {
        openWelcomeTour();
        sNow.markWelcomeShown();
      } else if (tabsNow.tabs.length === 0) {
        tabsNow.newTab();
      }

      // 初始化 tile 布局。
      const tiles0 = useTilesStore.getState();
      tiles0.validate(useTabsStore.getState().tabs);
      if (!tiles0.focusedLeaf()?.activeTabId && useTabsStore.getState().tabs.length > 0) {
        tiles0.initDefault(useTabsStore.getState().tabs[0].id);
      }
      tiles0.syncActiveTab();

      // 窗口关闭。
      try {
        unlistenClose = await listen('eidon://close-requested', async () => {
          useTabsStore.getState().persist?.();
          useTilesStore.getState().persist();
          await invoke('force_close_window');
        });
      } catch (err) {
        console.warn('close-requested listener failed', err);
      }

      // 原生菜单。
      try {
        unlistenMenu = await listen<string>('eidon://menu', (e) => {
          if (e.payload) dispatchMenuAction(e.payload);
        });
      } catch (err) {
        console.warn('menu listener not available', err);
      }

      // 拖拽图片到编辑器插入（仅图片）。EIDON 是知识库，不再「拖文件进窗口打开」。
      try {
        const webview = getCurrentWebview();
        const IMAGE_DROP_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif', 'tiff']);
        await webview.onDragDropEvent(async (event) => {
          if (event.payload.type === 'drop') {
            for (const path of event.payload.paths) {
              const ext = (path.split('.').pop() || '').toLowerCase();
              if (IMAGE_DROP_EXTS.has(ext)) {
                window.dispatchEvent(
                  new CustomEvent('eidon:insert-image-path', { detail: { path, paneId: useTilesStore.getState().focusedPaneId } }),
                );
              }
              // 非图片文件不再自动打开。
            }
          }
        });
      } catch (e) {
        console.warn('drag-drop not available', e);
      }

      // 自动检查更新 —— 暂时停用：原监听地址即将更换，待提供新 URL 后恢复（lib/check-update.ts 保留不动）。
      // if (!isIOS() && useSettingsStore.getState().autoCheckUpdate) {
      //   try {
      //     const { checkForUpdateOnStartup, openReleaseUrl } = await import('./lib/check-update');
      //     const result = await checkForUpdateOnStartup();
      //     if (result && result.hasUpdate) {
      //       const { useToastsStore } = await import('./stores/toasts');
      //       useToastsStore.getState().success(t('settings.updateAvailable', { version: result.latest || '' }), 8000);
      //       setTimeout(() => openReleaseUrl(result.url), 3000);
      //     }
      //   } catch {
      //     /* silent */
      //   }
      // }
    })();

    return () => {
      window.removeEventListener('keydown', onEscListener);
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('eidon:open-help', onOpenHelpEvent as EventListener);
      window.removeEventListener('eidon:open-global-search', onOpenSearchEvent as EventListener);
      window.removeEventListener('eidon:open-cjk-proofread', onOpenCjkProofreadEvent as EventListener);
      window.removeEventListener('eidon:select-structure-node', onSelectStructureNodeEvent as EventListener);
      window.removeEventListener('eidon:wiki-open', onWikiOpen as EventListener);
      window.removeEventListener(BASES_OPEN_EVENT, onOpenBases as EventListener);
      window.removeEventListener(BASES_CLOSE_EVENT, onCloseBases as EventListener);
      window.removeEventListener('eidon:open-settings', onOpenSettingsEvent as EventListener);
      window.removeEventListener('eidon:remote-pulled', onRemotePulled);
      unsubTabs();
      unsubTiles();
      unsubSettings();
      unsubWorkspace();
      if (unlistenMenu) unlistenMenu();
      if (unlistenClose) unlistenClose();
      autoCommit.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- 右抽屉面板标题（按视图类型）----
  const rightDrawerTitle = (() => {
    switch (rightPanelView) {
      case 'outline': return t('rsPane.outline');
      case 'node': return t('activitybar.node');
      case 'backlinks': return t('rsPane.backlinks');
      case 'tags': return t('rsPane.tags');
      case 'history': return t('rsPane.history');
      default: return '';
    }
  })();

  const leftDrawerTitle = (() => {
    switch (leftPanelView) {
      case 'explorer': return t('activitybar.explorer');
      case 'search': return t('activitybar.search');
      case 'calendar': return t('activitybar.calendar');
      case 'todos': return t('activitybar.todos');
      default: return '';
    }
  })();

  const reading = settings.viewMode === 'reading';

  return (
    <div className={`app${reading ? ' app--reading' : ''}`}>
      {reading ? (
        <ReadingView />
      ) : (
        <>
          <Toolbar
            onOpenPalette={() => setPaletteOpen(true)}
            onOpenHelp={() => setHelpOpen(true)}
          />
          <div className="workspace">
            <ActivityBar side="left" />

            {/* ---- 左抽屉 ---- */}
            {leftDrawerOpen && (
              <div className="leftdrawer" style={fileTreeStyle}>
                <div className="rd-header">
                  <span className="rd-title">{leftDrawerTitle}</span>
                  <button
                    className="rd-close"
                    onClick={() => useSettingsStore.getState().setLeftPanelView(null)}
                    title={t('rightSidebar.hidePane')}
                  >
                    <Icon name="close" size={16} />
                  </button>
                </div>
                <div className="leftdrawer__body">
                  {leftPanelView === 'explorer' && <FileTree onSelectStructureNode={onSelectStructureNode} />}
                  {leftPanelView === 'search' && <GlobalSearch prefill={searchPrefill} onClose={() => useSettingsStore.getState().setLeftPanelView(null)} />}
                  {leftPanelView === 'calendar' && <CalendarPanel />}
                  {leftPanelView === 'todos' && <TodoListPanel onClose={() => useSettingsStore.getState().setLeftPanelView(null)} />}
                </div>
                <div className="leftdrawer__resize" onMouseDown={onFileTreeResize} />
              </div>
            )}

            {/* ---- 内容区 ---- */}
            <div className="content">
              {basesOpen ? (
                <BasesView />
              ) : (
                <TileRoot node={tilesRoot} onCursor={onCursor} onSelection={onSelection} />
              )}
            </div>

            {/* ---- 右抽屉 ---- */}
            {rightDrawerOpen && (
              <div className="rightdrawer" style={drawerStyle}>
                <div className="rightdrawer__resize" onMouseDown={(e) => onSidebarResize('right', e)} />
                <div className="rd-header">
                  <span className="rd-title">{rightDrawerTitle}</span>
                  <button
                    className="rd-close"
                    onClick={() => useSettingsStore.getState().setRightPanelView(null)}
                    title={t('rightSidebar.hidePane')}
                  >
                    <Icon name="close" size={16} />
                  </button>
                </div>
                <div className="rightdrawer__body">
                  {rightPanelView === 'outline' && <Outline cursorLine={cursorLine} onGoto={onOutlineGoto} />}
                  {rightPanelView === 'node' && (
                    selectedStructureNode ? (
                      <NodePropertiesPanel
                        node={selectedStructureNode}
                        onClose={() => useSettingsStore.getState().setRightPanelView(null)}
                        onChanged={() => {
                          if (currentFolder) void useNodesStore.getState().scan(currentFolder);
                        }}
                      />
                    ) : (
                      <FilePropertiesPanel onClose={() => useSettingsStore.getState().setRightPanelView(null)} />
                    )
                  )}
                  {rightPanelView === 'backlinks' && <BacklinksPanel onClose={() => useSettingsStore.getState().setRightPanelView(null)} />}
                  {rightPanelView === 'tags' && <TagsPanel onClose={() => useSettingsStore.getState().setRightPanelView(null)} onFilterTag={onFilterTag} />}
                  {rightPanelView === 'history' && <HistoryPanel onClose={() => useSettingsStore.getState().setRightPanelView(null)} />}
                </div>
              </div>
            )}

            <ActivityBar side="right" />
          </div>
          <StatusBar line={cursorLine} col={cursorCol} selectionText={selectionText} />
        </>
      )}

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <QuickSwitcher open={quickSwitcherOpen} onClose={() => setQuickSwitcherOpen(false)} />
      <SettingsPanel
        open={settingsOpen}
        initialSection={settingsInitialSection}
        onClose={() => { setSettingsOpen(false); setSettingsInitialSection(null); }}
      />
      <MarkdownHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
      <CjkProofread open={cjkProofreadOpen} onClose={() => setCjkProofreadOpen(false)} />
      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <UnsavedDialog
        open={unsavedOpen}
        mode={unsavedMode}
        fileName={unsavedFileName}
        count={unsavedCount}
        onSave={() => onUnsavedAction('save')}
        onDiscard={() => onUnsavedAction('discard')}
        onCancel={() => onUnsavedAction('cancel')}
      />
      <SessionRestoreDialog />
      <FileChangedDialog
        open={fileChangedOpen}
        fileName={fileChangedFileName}
        onReload={() => onFileChangedAction('reload')}
        onOverwrite={() => onFileChangedAction('overwrite')}
        onCancel={() => onFileChangedAction('cancel')}
      />
      <Toast />
    </div>
  );
}

export default App;
