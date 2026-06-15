/**
 * settings store（Zustand v5）。从 Vue/Pinia `defineStore('settings')` 1:1 迁移：
 * 字段名、action 名逐一照搬。纯逻辑（默认值合并/迁移/序列化、视图模式循环、
 * 右侧栏快照恢复、各类钳制）抽到 M1 持久化模块与 M3 reducers，store 仅薄包装。
 *
 * 跨 store 访问统一用 `useXStore.getState()`；组件内用选择器订阅最小切片。
 */
import { create } from 'zustand';
import type { Theme, ViewMode, EditorRender } from '../types';
import * as R from '../lib/reducers';
import {
  type Settings,
  type PdfDefaults,
  type LeftPanelView,
  type RightPanelView,
  SETTINGS_LS_KEY,
  buildEditorFontStack,
  defaultPdfDefaults,
  mergePdfDefaults,
  loadSettings,
  serializeSettings,
} from '../lib/persistence/settings';

// 向后兼容再导出：历史上这些从 stores/settings 导出，沿用同一出口避免改动调用点。
export { buildEditorFontStack, defaultPdfDefaults, mergePdfDefaults };
export type { Settings, PdfDefaults, LeftPanelView, RightPanelView };

interface SettingsActions {
  persist(): void;
  setTheme(theme: Theme): void;
  toggleTheme(): void;
  setStartupViewMode(mode: ViewMode | null): void;
  setViewMode(mode: ViewMode): void;
  setEditorRender(render: EditorRender): void;
  toggleEditorRender(): void;
  cycleViewMode(): void;
  toggleReadingMode(): void;
  exitReadingMode(): void;
  toggleReadingByDefaultOnMobile(): void;
  setFontSize(n: number): void;
  setFontFamily(f: string): void;
  toggleWordWrap(): void;
  toggleLineNumbers(): void;
  setLeftPanelView(view: LeftPanelView): void;
  /** 再点同视图按钮收起抽屉，点其他视图切换（ActivityBar 的 toggle 语义）。 */
  toggleLeftPanelView(view: Exclude<LeftPanelView, null>): void;
  setRightPanelView(view: RightPanelView): void;
  toggleRightPanelView(view: Exclude<RightPanelView, null>): void;
  toggleSpellCheck(): void;
  toggleFocusMode(): void;
  toggleTypewriterMode(): void;
  toggleVimMode(): void;
  toggleAutoCheckUpdate(): void;
  toggleRestoreSession(): void;
  togglePerWorkspaceTabs(): void;
  toggleAutoReloadExternalChanges(): void;
  toggleAutoSaveOnBlur(): void;
  toggleRevealInFileTreeOnOpen(): void;
  markWelcomeShown(): void;
  toggleSpellcheckEnabled(): void;
  setFileTreeWidth(w: number): void;
  setSideSidebarWidth(w: number): void;
  setDailyNotesTemplate(t: string): void;
  setWorkspaceBibliography(p: string): void;
  setWorkspaceCsl(p: string): void;
  toggleAutoGit(): void;
  setAutoGitDebounceSeconds(n: number): void;
  setUiFontSize(n: number): void;
  setLanguage(lang: Settings['language']): void;
  setCustomCssPath(p: string): void;
  togglePreviewFitWidth(): void;
  toggleWritingStats(): void;
  toggleWorkspaceDailyTotal(): void;
  setPdfDefaults(patch: Partial<PdfDefaults>): void;
  resetPdfDefaults(): void;
  togglePomodoroShowControls(): void;
  togglePomodoroAutoEngageFocus(): void;
  setPomodoroDefaultMinutes(n: number): void;
  toggleSlashCommandsEnabled(): void;
  toggleImageExportBranding(): void;
  setGlobalZoom(n: number): void;
  zoomIn(): void;
  zoomOut(): void;
  resetZoom(): void;
  toggleCodeBlockLineNumbers(): void;
  setPreviewFontSize(n: number): void;
  previewFontIn(): void;
  previewFontOut(): void;
  resetPreviewFontSize(): void;
  setAttachmentMode(mode: 'shared' | 'per-file'): void;
  setAssetsDirName(name: string): void;
  editorFontIn(): void;
  editorFontOut(): void;
  resetEditorFontSize(): void;
}

export type SettingsStore = Settings & SettingsActions;

export const useSettingsStore = create<SettingsStore>()((set, get) => ({
  ...loadSettings(typeof localStorage !== 'undefined' ? localStorage.getItem(SETTINGS_LS_KEY) : null),

  persist() {
    try {
      localStorage.setItem(SETTINGS_LS_KEY, serializeSettings(get()));
    } catch {}
  },
  setTheme(theme) {
    set({ theme });
    get().persist();
  },
  toggleTheme() {
    get().setTheme(get().theme === 'light' ? 'dark' : 'light');
  },
  setStartupViewMode(mode) {
    set({ startupViewMode: mode });
    get().persist();
  },
  setViewMode(mode) {
    set({
      lastNonReadingViewMode: R.lastNonReadingFor(mode, get().lastNonReadingViewMode),
      viewMode: mode,
    });
    get().persist();
  },
  setEditorRender(render) {
    set({ editorRender: render });
    get().persist();
  },
  toggleEditorRender() {
    set({ editorRender: get().editorRender === 'live' ? 'source' : 'live' });
    get().persist();
  },
  cycleViewMode() {
    get().setViewMode(R.nextViewMode(get().viewMode));
  },
  toggleReadingMode() {
    if (get().viewMode === 'reading') {
      get().exitReadingMode();
    } else {
      set({ lastNonReadingViewMode: get().viewMode, viewMode: 'reading' });
      get().persist();
    }
  },
  exitReadingMode() {
    set({ viewMode: R.exitReadingTarget(get().lastNonReadingViewMode) });
    get().persist();
  },
  toggleReadingByDefaultOnMobile() {
    set({ readingByDefaultOnMobile: !get().readingByDefaultOnMobile });
    get().persist();
  },
  setFontSize(n) {
    set({ fontSize: Math.max(10, Math.min(28, n)) });
    get().persist();
  },
  setFontFamily(f) {
    set({ fontFamily: f });
    get().persist();
  },
  toggleWordWrap() {
    set({ wordWrap: !get().wordWrap });
    get().persist();
  },
  toggleLineNumbers() {
    set({ showLineNumbers: !get().showLineNumbers });
    get().persist();
  },
  setLeftPanelView(view) {
    set({ leftPanelView: view });
    get().persist();
  },
  toggleLeftPanelView(view) {
    get().setLeftPanelView(get().leftPanelView === view ? null : view);
  },
  setRightPanelView(view) {
    set({ rightPanelView: view });
    get().persist();
  },
  toggleRightPanelView(view) {
    get().setRightPanelView(get().rightPanelView === view ? null : view);
  },
  toggleSpellCheck() {
    set({ spellCheck: !get().spellCheck });
    get().persist();
  },
  toggleFocusMode() {
    set({ focusMode: !get().focusMode });
    get().persist();
  },
  toggleTypewriterMode() {
    set({ typewriterMode: !get().typewriterMode });
    get().persist();
  },
  toggleVimMode() {
    set({ vimMode: !get().vimMode });
    get().persist();
  },
  toggleAutoCheckUpdate() {
    set({ autoCheckUpdate: !get().autoCheckUpdate });
    get().persist();
  },
  toggleRestoreSession() {
    set({ restoreSession: !get().restoreSession });
    get().persist();
  },
  togglePerWorkspaceTabs() {
    set({ perWorkspaceTabs: !get().perWorkspaceTabs });
    get().persist();
  },
  toggleAutoReloadExternalChanges() {
    set({ autoReloadExternalChanges: !get().autoReloadExternalChanges });
    get().persist();
  },
  toggleAutoSaveOnBlur() {
    set({ autoSaveOnBlur: !get().autoSaveOnBlur });
    get().persist();
  },
  toggleRevealInFileTreeOnOpen() {
    set({ revealInFileTreeOnOpen: !get().revealInFileTreeOnOpen });
    get().persist();
  },
  markWelcomeShown() {
    set({ welcomeShown: true });
    get().persist();
  },
  toggleSpellcheckEnabled() {
    set({ spellcheckEnabled: !get().spellcheckEnabled });
    get().persist();
  },
  setFileTreeWidth(w) {
    set({ fileTreeWidth: Math.max(180, Math.min(520, Math.round(w) || 260)) });
    get().persist();
  },
  setSideSidebarWidth(w) {
    set({ sideSidebarWidth: Math.max(220, Math.min(800, Math.round(w) || 260)) });
    get().persist();
  },
  setDailyNotesTemplate(t) {
    set({ dailyNotesTemplate: t });
    get().persist();
  },
  setWorkspaceBibliography(p) {
    set({ workspaceBibliography: p });
    get().persist();
  },
  setWorkspaceCsl(p) {
    set({ workspaceCsl: p });
    get().persist();
  },
  toggleAutoGit() {
    const autoGitEnabled = !get().autoGitEnabled;
    // 开启 sync 时顺带把右抽屉切到历史面板，便于立刻看到提交流（延续 #55 意图）。
    const patch: Partial<Settings> = { autoGitEnabled };
    if (autoGitEnabled && get().rightPanelView === null) patch.rightPanelView = 'history';
    set(patch);
    get().persist();
  },
  setAutoGitDebounceSeconds(n) {
    set({ autoGitDebounceSeconds: Math.max(5, Math.min(600, Math.round(n) || 30)) });
    get().persist();
  },
  setUiFontSize(n) {
    set({ uiFontSize: Math.max(10, Math.min(20, n)) });
    get().persist();
  },
  setLanguage(lang) {
    set({ language: lang });
    get().persist();
  },
  setCustomCssPath(p) {
    set({ customCssPath: p });
    get().persist();
  },
  togglePreviewFitWidth() {
    set({ previewFitWidth: !get().previewFitWidth });
    get().persist();
  },
  toggleWritingStats() {
    set({ showWritingStats: !get().showWritingStats });
    get().persist();
  },
  toggleWorkspaceDailyTotal() {
    set({ showWorkspaceDailyTotal: !get().showWorkspaceDailyTotal });
    get().persist();
  },
  setPdfDefaults(patch) {
    set({ pdfDefaults: mergePdfDefaults({ ...get().pdfDefaults, ...patch }) });
    get().persist();
  },
  resetPdfDefaults() {
    set({ pdfDefaults: defaultPdfDefaults() });
    get().persist();
  },
  togglePomodoroShowControls() {
    set({ pomodoroShowControls: !get().pomodoroShowControls });
    get().persist();
  },
  togglePomodoroAutoEngageFocus() {
    set({ pomodoroAutoEngageFocus: !get().pomodoroAutoEngageFocus });
    get().persist();
  },
  setPomodoroDefaultMinutes(n) {
    set({ pomodoroDefaultMinutes: Math.max(1, Math.min(600, Math.round(n) || 25)) });
    get().persist();
  },
  toggleSlashCommandsEnabled() {
    set({ slashCommandsEnabled: !get().slashCommandsEnabled });
    get().persist();
  },
  toggleImageExportBranding() {
    set({ imageExportBranding: !get().imageExportBranding });
    get().persist();
  },
  setGlobalZoom(n) {
    set({ globalZoom: R.clampGlobalZoom(n) });
    get().persist();
  },
  zoomIn() {
    get().setGlobalZoom((get().globalZoom || 1) + 0.1);
  },
  zoomOut() {
    get().setGlobalZoom((get().globalZoom || 1) - 0.1);
  },
  resetZoom() {
    get().setGlobalZoom(1);
  },
  toggleCodeBlockLineNumbers() {
    set({ codeBlockLineNumbers: !get().codeBlockLineNumbers });
    get().persist();
  },
  setPreviewFontSize(n) {
    set({ previewFontSize: Math.max(10, Math.min(32, Math.round(n || 15))) });
    get().persist();
  },
  previewFontIn() {
    get().setPreviewFontSize((get().previewFontSize || 15) + 1);
  },
  previewFontOut() {
    get().setPreviewFontSize((get().previewFontSize || 15) - 1);
  },
  resetPreviewFontSize() {
    get().setPreviewFontSize(15);
  },
  setAttachmentMode(mode) {
    set({ attachmentMode: mode === 'per-file' ? 'per-file' : 'shared' });
    get().persist();
  },
  setAssetsDirName(name) {
    const cleaned = (name || '').replace(/[\\/]/g, '').trim();
    set({ assetsDirName: cleaned || '_assets' });
    get().persist();
  },
  editorFontIn() {
    get().setFontSize((get().fontSize || 14) + 1);
  },
  editorFontOut() {
    get().setFontSize((get().fontSize || 14) - 1);
  },
  resetEditorFontSize() {
    get().setFontSize(14);
  },
}));
