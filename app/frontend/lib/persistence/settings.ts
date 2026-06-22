/**
 * M1 · settings 持久化域。`eidon.settings.v1`。
 *
 * defaults / mergePdfDefaults / buildEditorFontStack / load / serialize 纯函数，由 vitest 回归。
 * 工作台重构后布局态收敛为双抽屉视图（leftPanelView / rightPanelView）；
 * 旧侧栏字段（showFileTree / rightSidebarHidden / rsPaneOrder / 各面板显隐等）
 * 已退役，load 时做一次性迁移并从 blob 中剔除。
 */
import type { Theme, ViewMode, EditorRender } from '../../types';
import type { PersistedCodec } from './index';

export const SETTINGS_LS_KEY = 'eidon.settings.v1';

/** 左抽屉视图：文件资源 / 全局搜索 / 日历 / 待办；null = 收起。 */
export type LeftPanelView = 'explorer' | 'search' | 'calendar' | 'todos' | null;
/** 右抽屉视图：AI 对话 / 大纲 / 节点属性 / 反向链接 / 标签 / 历史；null = 收起。 */
export type RightPanelView = 'ai' | 'outline' | 'node' | 'backlinks' | 'tags' | 'history' | null;

const LEFT_PANEL_VIEWS: ReadonlyArray<Exclude<LeftPanelView, null>> = ['explorer', 'search', 'calendar', 'todos'];
const RIGHT_PANEL_VIEWS: ReadonlyArray<Exclude<RightPanelView, null>> = ['ai', 'outline', 'node', 'backlinks', 'tags', 'history'];

// CJK + generic fallback appended after the user's chosen face. This way
// Latin glyphs come from the user's pick while CJK still falls back to
// a real CJK font instead of whatever the generic `monospace` happens to be.
const CJK_FALLBACK =
  '"PingFang SC", "PingFang TC", "Hiragino Sans GB", "Microsoft YaHei", "Heiti SC", "Noto Sans CJK SC"';

export function buildEditorFontStack(face: string): string {
  const trimmed = face.trim();
  if (!trimmed) return `${CJK_FALLBACK}, sans-serif`;
  // If user pasted a full stack already (contains comma), use as-is but still
  // append CJK fallback for safety.
  if (trimmed.includes(',')) return `${trimmed}, ${CJK_FALLBACK}`;
  const needsQuote = /\s/.test(trimmed) && !/^["']/.test(trimmed);
  const quoted = needsQuote ? `"${trimmed}"` : trimmed;
  return `${quoted}, ${CJK_FALLBACK}, "JetBrains Mono", Menlo, Consolas, monospace`;
}

export interface Settings {
  theme: Theme;
  viewMode: ViewMode;
  editorRender: EditorRender;
  /** 编辑器内 diff 对比的版式：split=并排双栏 / stacked=统一单列（瞬态目标在 stores/diffView）。 */
  diffLayout: 'split' | 'stacked';
  /** diff 是否折叠未改动行：false=显示全部内容（默认）/ true=仅看修改处（折叠未改动区段）。 */
  diffCollapseUnchanged: boolean;
  startupViewMode: ViewMode | null;
  fontSize: number;
  fontFamily: string;
  wordWrap: boolean;
  showLineNumbers: boolean;
  /** 文件资源管理器是否显示 `.` 开头的隐藏文件/文件夹（系统项如 .eidon/.node/.git 始终隐藏）。 */
  showHiddenFiles: boolean;
  /** 左/右抽屉当前视图（替代旧 showFileTree / rightSidebarHidden / 各面板显隐字段）。 */
  leftPanelView: LeftPanelView;
  rightPanelView: RightPanelView;
  fileTreeWidth: number;
  spellCheck: boolean;
  focusMode: boolean;
  typewriterMode: boolean;
  vimMode: boolean;
  uiFontSize: number;
  language: 'zh' | 'en';
  autoCheckUpdate: boolean;
  previewFitWidth: boolean;
  restoreSession: boolean;
  perWorkspaceTabs: boolean;
  autoReloadExternalChanges: boolean;
  autoSaveOnBlur: boolean;
  welcomeShown: boolean;
  spellcheckEnabled: boolean;
  /** 日记模板内容（路径与文件名固定走日历整理箱规则，不再可配置）。 */
  dailyNotesTemplate: string;
  sideSidebarWidth: number;
  workspaceBibliography: string;
  workspaceCsl: string;
  autoGitEnabled: boolean;
  autoGitDebounceSeconds: number;
  /** 单文件历史面板显示的最大版本数（仅显示上限，不改写历史）。 */
  historyMaxVersionsPerFile: number;
  /** 整仓保留的最大提交数（0=不限）；超出则自动修剪最旧提交（破坏性，见 ADR-0023）。 */
  historyMaxCommits: number;
  /** `.git` 最大体积 MB（0=不限）；超出则进一步修剪 + gc。 */
  historyMaxGitSizeMb: number;
  lastNonReadingViewMode: ViewMode;
  showWritingStats: boolean;
  showWorkspaceDailyTotal: boolean;
  pdfDefaults: PdfDefaults;
  pomodoroShowControls: boolean;
  pomodoroAutoEngageFocus: boolean;
  pomodoroDefaultMinutes: 25 | 50 | 90 | number;
  slashCommandsEnabled: boolean;
  imageExportBranding: boolean;
  globalZoom: number;
  codeBlockLineNumbers: boolean;
  previewFontSize: number;
  attachmentMode: 'shared' | 'per-file';
  assetsDirName: string;
}

/** v2.5 PDF / print export defaults. */
export interface PdfDefaults {
  pageSize: 'A4' | 'A5' | 'Letter' | 'Legal' | 'Custom';
  customWidthMm: number;
  customHeightMm: number;
  margin: 'Narrow' | 'Normal' | 'Wide' | 'Custom';
  customMarginTopMm: number;
  customMarginRightMm: number;
  customMarginBottomMm: number;
  customMarginLeftMm: number;
  fontFamily: string;
  fontSize: number;
  footer: boolean;
  codeTheme: 'preview' | 'light' | 'dark';
}

export function defaultPdfDefaults(): PdfDefaults {
  return {
    pageSize: 'A4',
    customWidthMm: 210,
    customHeightMm: 297,
    margin: 'Normal',
    customMarginTopMm: 15,
    customMarginRightMm: 15,
    customMarginBottomMm: 15,
    customMarginLeftMm: 15,
    fontFamily: '',
    fontSize: 11,
    footer: true,
    codeTheme: 'preview',
  };
}

export function defaultSettings(): Settings {
  const prefersDark =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  return {
    theme: prefersDark ? 'dark' : 'light',
    viewMode: 'edit',
    editorRender: 'source',
    diffLayout: 'stacked',
    diffCollapseUnchanged: false,
    startupViewMode: null,
    fontSize: 14,
    fontFamily: 'JetBrains Mono',
    wordWrap: true,
    showLineNumbers: true,
    showHiddenFiles: false,
    leftPanelView: 'explorer',
    rightPanelView: null,
    fileTreeWidth: 260,
    spellCheck: true,
    focusMode: false,
    typewriterMode: false,
    vimMode: false,
    uiFontSize: 13,
    autoCheckUpdate: true,
    language: 'zh',
    previewFitWidth: false,
    restoreSession: true,
    perWorkspaceTabs: true,
    autoReloadExternalChanges: true,
    autoSaveOnBlur: false,
    welcomeShown: false,
    spellcheckEnabled: false,
    dailyNotesTemplate: '',
    sideSidebarWidth: 260,
    workspaceBibliography: '',
    workspaceCsl: '',
    autoGitEnabled: true,
    autoGitDebounceSeconds: 30,
    historyMaxVersionsPerFile: 50,
    historyMaxCommits: 0,
    historyMaxGitSizeMb: 0,
    lastNonReadingViewMode: 'edit',
    showWritingStats: true,
    showWorkspaceDailyTotal: false,
    pdfDefaults: defaultPdfDefaults(),
    pomodoroShowControls: true,
    pomodoroAutoEngageFocus: true,
    pomodoroDefaultMinutes: 25,
    slashCommandsEnabled: true,
    imageExportBranding: true,
    globalZoom: 1,
    codeBlockLineNumbers: false,
    previewFontSize: 15,
    attachmentMode: 'shared',
    assetsDirName: '_assets',
  };
}

/**
 * Merge a (possibly partial / legacy) saved `pdfDefaults` blob with the
 * current schema defaults. Treats unknown / out-of-range numeric values
 * as "use the default" so a 5MB margin can never sneak in via tampered
 * localStorage.
 */
export function mergePdfDefaults(saved: unknown): PdfDefaults {
  const base = defaultPdfDefaults();
  if (!saved || typeof saved !== 'object') return base;
  const s = saved as Partial<PdfDefaults>;
  const clamp = (n: unknown, min: number, max: number, fallback: number) => {
    const v = typeof n === 'number' && Number.isFinite(n) ? n : fallback;
    return Math.max(min, Math.min(max, v));
  };
  const okPageSize = ['A4', 'A5', 'Letter', 'Legal', 'Custom'] as const;
  const okMargin = ['Narrow', 'Normal', 'Wide', 'Custom'] as const;
  const okCodeTheme = ['preview', 'light', 'dark'] as const;
  return {
    pageSize: okPageSize.includes(s.pageSize as never) ? (s.pageSize as PdfDefaults['pageSize']) : base.pageSize,
    customWidthMm: clamp(s.customWidthMm, 50, 500, base.customWidthMm),
    customHeightMm: clamp(s.customHeightMm, 50, 500, base.customHeightMm),
    margin: okMargin.includes(s.margin as never) ? (s.margin as PdfDefaults['margin']) : base.margin,
    customMarginTopMm: clamp(s.customMarginTopMm, 5, 100, base.customMarginTopMm),
    customMarginRightMm: clamp(s.customMarginRightMm, 5, 100, base.customMarginRightMm),
    customMarginBottomMm: clamp(s.customMarginBottomMm, 5, 100, base.customMarginBottomMm),
    customMarginLeftMm: clamp(s.customMarginLeftMm, 5, 100, base.customMarginLeftMm),
    fontFamily: typeof s.fontFamily === 'string' ? s.fontFamily : base.fontFamily,
    fontSize: clamp(s.fontSize, 9, 16, base.fontSize),
    footer: typeof s.footer === 'boolean' ? s.footer : base.footer,
    codeTheme: okCodeTheme.includes(s.codeTheme as never) ? (s.codeTheme as PdfDefaults['codeTheme']) : base.codeTheme,
  };
}

/** 已退役键（旧侧栏布局 / 旧每日笔记路径 / 历史遥测 / 旧移动端阅读默认）：load 时剥离，不再写回 blob。 */
const RETIRED_KEYS = [
  'telemetryEnabled',
  'telemetryNoticeAck',
  'showOutline',
  'outlineSide',
  'showFileTree',
  'fileTreeDefaultDesktopMigrated',
  'rightSidebarHidden',
  'showBacklinks',
  'showTagsPanel',
  'showHistoryPanel',
  'rightSidebarPaneHeights',
  'rsPaneOrder',
  'dailyNotesFolder',
  'dailyNotesFormat',
  '_rsPanesBeforeHide',
  // 已删移动端：iOS/iPad 自动阅读模式默认（桌面端 isIOS() 恒 false，整块死代码已移除）。
  'readingByDefaultOnMobile',
] as const;

/** raw → 校验/迁移后的 Settings。 */
export function loadSettings(raw: string | null): Settings {
  try {
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Settings> & Record<string, unknown>;
      const rest: Record<string, unknown> = { ...parsed };
      for (const key of RETIRED_KEYS) delete rest[key];
      const merged: Settings = { ...defaultSettings(), ...(rest as Partial<Settings>) };
      // pdfDefaults 嵌套对象：钳制合并，缺失子键不会变 undefined，篡改数值钳回范围。
      merged.pdfDefaults = mergePdfDefaults(parsed.pdfDefaults);
      merged.fileTreeWidth = Math.max(180, Math.min(520, Number.isFinite(merged.fileTreeWidth) ? merged.fileTreeWidth : 260));
      // 抽屉视图枚举校验（篡改 / 旧值兜底）。
      if (merged.leftPanelView !== null && !LEFT_PANEL_VIEWS.includes(merged.leftPanelView)) {
        merged.leftPanelView = 'explorer';
      }
      if (merged.rightPanelView !== null && !RIGHT_PANEL_VIEWS.includes(merged.rightPanelView)) {
        merged.rightPanelView = null;
      }
      // 迁移：旧的耦合式视图模式把「渲染」塞进了 viewMode（source / liveEdit）；现已拆成
      // viewMode(布局) + editorRender(渲染)。旧 liveEdit → edit 布局 + live 渲染；
      // 旧 source / edit → edit 布局 + source 渲染。
      if ((merged.viewMode as string) === 'liveEdit') { merged.viewMode = 'edit'; merged.editorRender = 'live'; }
      else if ((merged.viewMode as string) === 'source') merged.viewMode = 'edit';
      const toLayout = (v: unknown): ViewMode | null =>
        v == null ? null : (v === 'source' || v === 'liveEdit') ? 'edit' : (v as ViewMode);
      merged.startupViewMode = toLayout(merged.startupViewMode);
      merged.lastNonReadingViewMode = (toLayout(merged.lastNonReadingViewMode) ?? 'edit') as ViewMode;
      // editorRender 缺省 / 篡改兜底。
      if (merged.editorRender !== 'source' && merged.editorRender !== 'live') merged.editorRender = 'source';
      // diffLayout 缺省 / 篡改兜底。
      if (merged.diffLayout !== 'split' && merged.diffLayout !== 'stacked') merged.diffLayout = 'split';
      // 主题精简迁移：仅保留 light / dark。旧的 6 套主题（nord / solarized-* /
      // monokai / github-light / dracula）按明暗回落，避免老用户读到失效主题空白。
      if (merged.theme !== 'light' && merged.theme !== 'dark') {
        merged.theme = String(merged.theme).includes('dark') || merged.theme === 'monokai' || merged.theme === 'dracula'
          ? 'dark'
          : 'light';
      }
      // 一次性迁移：旧「文件树显隐」→ 左抽屉视图（仅当新键还未写入过）。
      if (parsed.leftPanelView === undefined && typeof parsed.showFileTree === 'boolean') {
        merged.leftPanelView = parsed.showFileTree ? 'explorer' : null;
      }
      const savedLanguage = (rest as { language?: unknown }).language;
      if (savedLanguage !== 'zh' && savedLanguage !== 'en') merged.language = 'zh';
      return merged;
    }
  } catch {}
  return defaultSettings();
}

/** Settings → 写盘字符串。 */
export function serializeSettings(state: Settings): string {
  return JSON.stringify({
    ...state,
    fileTreeWidth: Math.max(180, Math.min(520, Number.isFinite(state.fileTreeWidth) ? state.fileTreeWidth : 260)),
  });
}

export const settingsCodec: PersistedCodec<Settings> = {
  key: SETTINGS_LS_KEY,
  load: loadSettings,
  serialize: serializeSettings,
};
