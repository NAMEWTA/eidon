/**
 * useCommands（从 Vue composable 迁移为 React hook）。构建命令面板/QuickSwitcher
 * 的命令列表（id/title/hint/shortcut/run 逐字保留）。run 回调在**执行时**经
 * getState() 读 store（确保作用于当前状态，而非渲染时快照）；composable 句柄
 * （files/exporter/daily/pandoc/bases/auto）为稳定模块级集合。
 *
 * 注意：GitHub Sync 命令已按 EIDON 阶段边界移除（ADR-0018），
 * 相关 composable（useGithubSync）代码保留不动。
 */
import { useFiles } from './useFiles';
import { useSettingsStore } from '../stores/settings';
import { useTabsStore } from '../stores/tabs';
import { useTilesStore } from '../stores/tiles';
import { useExport } from './useExport';
import { useToastsStore } from '../stores/toasts';
import { open as openFileDialog } from '@tauri-apps/plugin-dialog';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { simplifiedToTraditional, traditionalToSimplified, pinyin } from '../lib/chinese';
import { cleanAIArtifacts, stripMarkdownToPlain } from '../lib/clean-ai';
import { openWelcomeTour } from '../lib/welcome-tour';
import { formatMarkdown } from '../lib/markdown-format';
import { useDailyNotes } from './useDailyNotes';
import { usePandocExport } from './usePandocExport';
import { useBasesView } from './useBasesView';
import { useAutoCommit } from './useAutoCommit';
import { useWorkspaceIndexStore } from '../stores/workspaceIndex';
import { useGitHistoryStore } from '../stores/gitHistory';
import { useWorkspaceStore } from '../stores/workspace';
import { useI18n } from '../i18n';

export interface Command {
  id: string;
  title: string;
  hint?: string;
  shortcut?: string;
  run: () => void | Promise<void>;
}

/** 替换活动编辑器内容（中文转换等命令用）。 */
function transformActive(fn: (s: string) => string, successMsg: string, failMsg?: string) {
  const tabs = useTabsStore.getState();
  const t = tabs.activeTab();
  if (!t) {
    useToastsStore.getState().warning(failMsg ?? 'No active document');
    return;
  }
  tabs.setContent(t.id, fn(t.content));
  useToastsStore.getState().success(successMsg);
}

export function useCommands(): Command[] {
  const { t } = useI18n();
  const files = useFiles();
  const exporter = useExport();
  const daily = useDailyNotes();
  const pandoc = usePandocExport();
  const bases = useBasesView();
  const auto = useAutoCommit();

  const all: Command[] = [
    { id: 'file.new', title: t('cmd.fileNew'), shortcut: 'Ctrl+N', run: () => files.newFile() },
    { id: 'file.newText', title: t('cmd.fileNewText'), shortcut: 'Ctrl+Alt+N', run: () => files.newTextFile() },
    { id: 'file.save', title: t('cmd.fileSave'), shortcut: 'Ctrl+S', run: () => files.saveActive() },
    { id: 'file.saveAs', title: t('cmd.fileSaveAs'), shortcut: 'Ctrl+Shift+S', run: () => files.saveActiveAs() },
    { id: 'file.openFolder', title: t('cmd.fileOpenFolder'), hint: t('cmd.fileOpenFolderHint'), run: () => files.openFolder() },
    {
      id: 'file.closeTab',
      title: t('cmd.fileCloseTab'),
      shortcut: 'Ctrl+W',
      run: () => {
        const id = useTabsStore.getState().activeId;
        if (id) files.closeTabSafe(id);
      },
    },
    { id: 'view.edit', title: t('cmd.viewEdit'), run: () => useSettingsStore.getState().setViewMode('edit') },
    { id: 'view.split', title: t('cmd.viewSplit'), run: () => useSettingsStore.getState().setViewMode('split') },
    { id: 'view.preview', title: t('cmd.viewPreview'), run: () => useSettingsStore.getState().setViewMode('preview') },
    { id: 'view.cycleView', title: t('cmd.viewCycle'), shortcut: 'Ctrl+Shift+P', run: () => useSettingsStore.getState().cycleViewMode() },
    {
      id: 'view.toggleOutline',
      title: t('cmd.viewToggleOutline'),
      shortcut: 'Ctrl+Shift+O',
      run: () => useSettingsStore.getState().toggleRightPanelView('outline'),
    },
    { id: 'view.toggleFileTree', title: t('cmd.viewToggleFileTree'), shortcut: 'Ctrl+B', run: () => useSettingsStore.getState().toggleLeftPanelView('explorer') },
    { id: 'todos.openPanel', title: t('cmd.viewToggleTodos'), shortcut: 'Ctrl+Shift+T', run: () => useSettingsStore.getState().toggleLeftPanelView('todos') },
    { id: 'view.toggleWrap', title: t('cmd.viewToggleWrap'), run: () => useSettingsStore.getState().toggleWordWrap() },
    { id: 'view.toggleLineNumbers', title: t('cmd.viewToggleLineNumbers'), run: () => useSettingsStore.getState().toggleLineNumbers() },
    { id: 'view.toggleTheme', title: t('cmd.viewToggleTheme'), run: () => useSettingsStore.getState().toggleTheme() },
    { id: 'view.toggleSourceLiveEdit', title: t('cmd.viewToggleSourceLiveEdit'), run: () => useSettingsStore.getState().toggleEditorRender() },
    { id: 'view.toggleSpellCheck', title: t('cmd.viewToggleSpellCheck'), run: () => useSettingsStore.getState().toggleSpellCheck() },
    { id: 'view.toggleFocusMode', title: t('cmd.viewToggleFocusMode'), run: () => useSettingsStore.getState().toggleFocusMode() },
    { id: 'view.toggleTypewriter', title: t('cmd.viewToggleTypewriter'), run: () => useSettingsStore.getState().toggleTypewriterMode() },

    { id: 'tile.splitRight', title: t('cmd.tileSplitRight'), shortcut: 'Ctrl+\\', run: () => { const tiles = useTilesStore.getState(); tiles.splitPane(tiles.focusedPaneId, 'horizontal'); } },
    { id: 'tile.splitDown', title: t('cmd.tileSplitDown'), shortcut: 'Ctrl+Shift+\\', run: () => { const tiles = useTilesStore.getState(); tiles.splitPane(tiles.focusedPaneId, 'vertical'); } },
    { id: 'tile.closePane', title: t('cmd.tileClosePane'), run: () => { const tiles = useTilesStore.getState(); tiles.closePane(tiles.focusedPaneId); } },
    { id: 'tile.focusNext', title: t('cmd.tileFocusNext'), shortcut: 'Ctrl+Alt+Right', run: () => useTilesStore.getState().focusNextPane() },
    { id: 'tile.focusPrev', title: t('cmd.tileFocusPrev'), shortcut: 'Ctrl+Alt+Left', run: () => useTilesStore.getState().focusPrevPane() },

    {
      id: 'search.global',
      title: t('cmd.searchGlobal'),
      shortcut: 'Ctrl+Shift+F',
      hint: t('cmd.searchGlobalHint'),
      run: () => { window.dispatchEvent(new CustomEvent('eidon:open-global-search')); },
    },

    { id: 'cn.s2t', title: t('cmd.cnS2t'), hint: t('cmd.cnS2tHint'), run: () => transformActive(simplifiedToTraditional, t('cmd.convertedToTraditional')) },
    { id: 'cn.t2s', title: t('cmd.cnT2s'), run: () => transformActive(traditionalToSimplified, t('cmd.convertedToSimplified')) },
    {
      id: 'cn.copyPinyin',
      title: t('cmd.cnCopyPinyin'),
      run: async () => {
        const tab = useTabsStore.getState().activeTab();
        if (!tab) {
          useToastsStore.getState().warning(t('cmd.noActiveDocument'));
          return;
        }
        await writeText(pinyin(tab.content));
        useToastsStore.getState().success(t('cmd.pinyinCopied'));
      },
    },

    {
      id: 'proofread.cjk',
      title: t('cmd.proofreadCjk'),
      shortcut: 'Ctrl+Shift+J',
      hint: t('cmd.proofreadCjkHint'),
      run: () => { window.dispatchEvent(new CustomEvent('eidon:open-cjk-proofread')); },
    },

    {
      id: 'editor.insertImage',
      title: t('cmd.editorInsertImage'),
      hint: t('cmd.editorInsertImageHint'),
      run: async () => {
        if (!useTabsStore.getState().activeTab()) {
          useToastsStore.getState().warning(t('cmd.noActiveDocument'));
          return;
        }
        const sel = await openFileDialog({
          multiple: false,
          filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif', 'tiff'] }],
        });
        if (typeof sel !== 'string') return;
        window.dispatchEvent(
          new CustomEvent('eidon:insert-image-path', { detail: { path: sel, paneId: useTilesStore.getState().focusedPaneId } }),
        );
      },
    },

    {
      id: 'format.markdown',
      title: t('cmd.formatMarkdown'),
      shortcut: 'Ctrl+Alt+L',
      hint: t('cmd.formatMarkdownHint'),
      run: async () => {
        const tabs = useTabsStore.getState();
        const tab = tabs.activeTab();
        if (!tab) {
          useToastsStore.getState().warning(t('cmd.noActiveDocument'));
          return;
        }
        if (tab.language !== 'markdown') {
          useToastsStore.getState().warning(t('cmd.formatMarkdownOnly'));
          return;
        }
        try {
          const next = await formatMarkdown(tab.content);
          if (next === tab.content) {
            useToastsStore.getState().info(t('cmd.alreadyFormatted'));
            return;
          }
          useTabsStore.getState().setContent(tab.id, next);
          useToastsStore.getState().success(t('cmd.formatted'));
        } catch (e) {
          console.error('format failed', e);
          useToastsStore.getState().warning(t('cmd.formatFailed'));
        }
      },
    },

    { id: 'clean.aiArtifacts', title: t('cmd.cleanAiArtifacts'), hint: t('cmd.cleanAiArtifactsHint'), run: () => transformActive(cleanAIArtifacts, t('cmd.aiArtifactsCleaned')) },
    { id: 'clean.stripMarkdown', title: t('cmd.cleanStripMarkdown'), hint: t('cmd.cleanStripMarkdownHint'), run: () => transformActive(stripMarkdownToPlain, t('cmd.strippedToPlain')) },

    { id: 'export.html', title: t('cmd.exportHtml'), run: () => exporter.exportHtml() },
    { id: 'export.docx', title: t('cmd.exportDocx'), run: () => exporter.exportDocx() },
    { id: 'export.pdf', title: t('cmd.exportPdf'), run: () => exporter.exportPdf() },
    { id: 'export.pdfPrint', title: t('cmd.exportPdfPrint'), shortcut: 'Ctrl+Shift+Alt+P', run: () => exporter.exportPdfPrint() },
    { id: 'export.image', title: t('cmd.exportImage'), run: () => exporter.exportImage() },
    { id: 'export.epub', title: t('cmd.exportEpub'), hint: t('cmd.exportEpubHint'), run: () => pandoc.exportTo('epub') },
    { id: 'export.odt', title: t('cmd.exportOdt'), hint: t('cmd.exportOdtHint'), run: () => pandoc.exportTo('odt') },
    { id: 'export.latex', title: t('cmd.exportLatex'), hint: t('cmd.exportLatexHint'), run: () => pandoc.exportTo('latex') },
    { id: 'export.rtf', title: t('cmd.exportRtf'), hint: t('cmd.exportRtfHint'), run: () => pandoc.exportTo('rtf') },
    { id: 'export.pandocCustom', title: t('cmd.exportPandocCustom'), run: () => pandoc.exportTo('custom') },
    { id: 'export.copyHtml', title: t('cmd.exportCopyHtml'), shortcut: 'Ctrl+Shift+C', run: () => exporter.copyAsHtml() },
    { id: 'export.copyPlain', title: t('cmd.exportCopyPlain'), run: () => exporter.copyAsPlainText() },
    { id: 'export.copyMd', title: t('cmd.exportCopyMd'), run: () => exporter.copyAsMarkdown() },
    { id: 'export.copyImage', title: t('cmd.exportCopyImage'), run: () => exporter.copyAsImage() },

    { id: 'daily.openToday', title: t('cmd.dailyOpenToday'), shortcut: 'Ctrl+D', hint: t('cmd.dailyOpenTodayHint'), run: () => daily.openTodayNote() },
    { id: 'daily.openYesterday', title: t('cmd.dailyOpenYesterday'), run: () => daily.openYesterday() },
    { id: 'daily.openTomorrow', title: t('cmd.dailyOpenTomorrow'), run: () => daily.openTomorrow() },
    { id: 'tags.refresh', title: t('cmd.tagsRefresh'), run: () => useWorkspaceIndexStore.getState().rescan() },
    { id: 'bases.open', title: t('cmd.basesOpen'), hint: t('cmd.basesOpenHint'), run: () => bases.openBases() },
    {
      id: 'history.initWorkspace',
      title: t('cmd.historyInit'),
      hint: t('cmd.historyInitHint'),
      run: async () => {
        const folder = useWorkspaceStore.getState().currentFolder;
        if (!folder) {
          useToastsStore.getState().warning(t('cmd.gitInitNeedFolder'));
          return;
        }
        try {
          await useGitHistoryStore.getState().init(folder);
          useToastsStore.getState().success(t('cmd.gitInitialized'));
        } catch (e) {
          useToastsStore.getState().warning(`${t('cmd.gitInitFailed')}: ${e}`);
        }
      },
    },
    { id: 'history.commitNow', title: t('cmd.historyCommitNow'), hint: t('cmd.historyCommitNowHint'), run: () => auto.commitNow() },
    { id: 'history.toggleAutoGit', title: t('cmd.historyToggleAutoGit'), run: () => useSettingsStore.getState().toggleAutoGit() },

    {
      id: 'help.welcomeTour',
      title: t('cmd.helpWelcomeTour'),
      hint: t('cmd.helpWelcomeTourHint'),
      run: () => {
        openWelcomeTour();
        useToastsStore.getState().success(t('cmd.welcomeTourOpened'));
      },
    },
    {
      id: 'help.markdown',
      title: t('cmd.helpMarkdown'),
      shortcut: 'F1 / Ctrl+/',
      hint: t('cmd.helpMarkdownHint'),
      run: () => { window.dispatchEvent(new CustomEvent('eidon:open-help')); },
    },
  ];

  return all;
}
