/**
 * SettingsPanel.tsx — 设置面板容器（UI/UX 重构：对齐 HanaAgent）。
 *
 * 左侧分类导航 + 右侧内容；可见性沿用 data-cat / data-active-cat 的 CSS 机制
 * （body 的 data-active-cat 决定哪一组 [data-cat] 子节点显示）。
 * AI 相关 5 个子页（助手/技能/工具/供应商/社交接入）收敛进单个「智能体设置」分类，
 * 其内顶部用 TabBar 切换。全部分区改用 settings/kit 基元（卡片 + 开关），统一观感。
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Icon } from '../shared/Icons';
import { useSettingsStore, type PdfDefaults } from '../../stores/settings';
import { useToastsStore } from '../../stores/toasts';
import { themeLabels } from '../../lib/themes';
import { useI18n } from '../../i18n';
import { checkForUpdate, openReleaseUrl, isMasBuild } from '../../lib/check-update';
import { CommitInput } from './CommitInput';
import { CitationPickerSettings } from './CitationPickerSettings';
import { HistorySettings } from './HistorySettings';
import { TemplateManager } from './TemplateManager';
import { AgentTab } from '../ai/AgentTab';
import { ProvidersTab } from '../ai/ProvidersTab';
import { SkillsTab } from '../ai/SkillsTab';
import { ToolsTab } from '../ai/ToolsTab';
import { CronTab } from '../ai/CronTab';
import { BridgeTab } from '../ai/BridgeTab';
import { AiChannels } from '../ai/AiChannels';
import { SettingsSection, SettingsRow, Toggle, Select, TabBar, type TabItem } from '../settings/kit';
import type { Theme, ViewMode } from '../../types';

type SettingsCategory = 'basics' | 'templates' | 'ai' | 'writing' | 'export' | 'advanced';
type AiTab = 'agent' | 'cron' | 'skills' | 'tools' | 'providers' | 'bridge';

const VALID_CATEGORIES = new Set<SettingsCategory>([
  'basics', 'templates', 'ai', 'writing', 'export', 'advanced',
]);

const categories: { id: SettingsCategory; icon: string; labelKey?: string; label?: string }[] = [
  { id: 'basics', icon: 'settings', labelKey: 'settings.catBasics' },
  { id: 'templates', icon: 'package', labelKey: 'settings.catTemplates' },
  { id: 'ai', icon: 'sparkles', label: '智能体设置' },
  { id: 'writing', icon: 'pen', labelKey: 'settings.catWriting' },
  { id: 'export', icon: 'export', labelKey: 'settings.catExport' },
  { id: 'advanced', icon: 'tool', labelKey: 'settings.catAdvanced' },
];

/** AI 子页顶部 TAB 的内联图标（移植自 HanaAgent 导航图标）。 */
function TabIcon({ d }: { d: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: d }} />
  );
}
const AI_TABS: TabItem[] = [
  { id: 'agent', label: '助手', icon: <TabIcon d='<path d="M12 2a5 5 0 0 1 5 5c0 2.76-2.24 5-5 5s-5-2.24-5-5a5 5 0 0 1 5-5z"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>' /> },
  { id: 'cron', label: '定时', icon: <TabIcon d='<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>' /> },
  { id: 'skills', label: '技能', icon: <TabIcon d='<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>' /> },
  { id: 'tools', label: '工具', icon: <TabIcon d='<rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>' /> },
  { id: 'providers', label: '供应商', icon: <TabIcon d='<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>' /> },
  { id: 'bridge', label: '社交接入', icon: <TabIcon d='<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>' /> },
];

/** 把外部 deep-link 的 section 映射到 AI 子页（含旧的拆分分类名）。 */
const AI_SECTION_MAP: Record<string, AiTab> = {
  ai: 'providers',
  agents: 'agent',
  agent: 'agent',
  skills: 'skills',
  tools: 'tools',
  providers: 'providers',
  bridge: 'bridge',
};

const fontFamilies = [
  // Monospace — for code-heavy editing
  { label: 'JetBrains Mono', value: 'JetBrains Mono' },
  { label: 'SF Mono', value: 'SF Mono' },
  { label: 'Menlo', value: 'Menlo' },
  { label: 'Consolas', value: 'Consolas' },
  { label: 'Fira Code', value: 'Fira Code' },
  // Proportional — for prose / long-form writing
  { label: 'System Sans', value: '-apple-system, "Segoe UI", system-ui, sans-serif' },
  { label: 'Georgia (Serif)', value: 'Georgia' },
  { label: 'Times New Roman (Serif)', value: 'Times New Roman' },
  // Common CJK faces that already ship on the OS
  { label: 'PingFang SC', value: 'PingFang SC' },
  { label: 'Microsoft YaHei', value: 'Microsoft YaHei' },
  { label: 'Source Han Sans', value: 'Source Han Sans SC' },
  { label: 'Source Han Serif', value: 'Source Han Serif SC' },
  // Writing-friendly CJK faces (open source, install separately if missing)
  { label: 'LXGW WenKai 霞鹜文楷', value: 'LXGW WenKai' },
  { label: 'LXGW Bright 霞鹜新晨宋', value: 'LXGW Bright' },
  { label: 'TsangerJinKai 仓耳今楷', value: 'TsangerJinKai03 W04' },
];
const fontFamilyPresetValues = new Set(fontFamilies.map((f) => f.value));

// PDF 自定义毫米输入的内联尺寸样式（保留细颗粒布局）。
const mmInput: React.CSSProperties = { width: 90 };
const mmInputSm: React.CSSProperties = { width: 70 };
const textInputStyle: React.CSSProperties = { padding: '7px 10px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', borderRadius: 6, font: 'inherit', fontSize: 13 };

interface SettingsPanelProps {
  open: boolean;
  initialSection?: string | null;
  onClose: () => void;
}

export function SettingsPanel({ open, initialSection, onClose }: SettingsPanelProps) {
  const masBuild = isMasBuild();
  const { t } = useI18n();

  const settings = useSettingsStore();

  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('basics');
  const [aiTab, setAiTab] = useState<AiTab>('agent');
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  // Track custom-mode independently of settings.fontFamily 以便选 "自定义…" 时即使没输入也露出输入框。
  const [inCustomMode, setInCustomMode] = useState(() => !fontFamilyPresetValues.has(settings.fontFamily));
  const [customFontFamily, setCustomFontFamily] = useState(() =>
    !fontFamilyPresetValues.has(settings.fontFamily) ? settings.fontFamily : '',
  );
  const [pdfMmRangeError, setPdfMmRangeError] = useState(false);

  // Deep-link：open 变 true 时按 initialSection 落到指定分类（AI 子页另走 TAB）。
  useEffect(() => {
    if (!open) return;
    const target = initialSection;
    if (!target) return;
    if (target in AI_SECTION_MAP) {
      setActiveCategory('ai');
      setAiTab(AI_SECTION_MAP[target]);
      return;
    }
    if (VALID_CATEGORIES.has(target as SettingsCategory)) {
      setActiveCategory(target as SettingsCategory);
    }
  }, [open, initialSection]);

  async function manualCheckUpdate() {
    const toasts = useToastsStore.getState();
    setCheckingUpdate(true);
    try {
      const r = await checkForUpdate();
      if (r.error) {
        toasts.error(t('settings.updateCheckFailed'));
      } else if (r.hasUpdate) {
        toasts.success(t('settings.updateAvailable', { version: r.latest || '' }));
        await openReleaseUrl(r.url);
      } else {
        toasts.info(t('settings.upToDate'));
      }
    } catch (e) {
      toasts.error(String(e));
    } finally {
      setCheckingUpdate(false);
    }
  }

  function onSelectFontFamily(v: string) {
    if (v === '__custom__') {
      setInCustomMode(true);
      return;
    }
    setInCustomMode(false);
    setCustomFontFamily('');
    settings.setFontFamily(v);
  }
  function onCustomFontInput(v: string) {
    setCustomFontFamily(v);
    if (v.trim()) settings.setFontFamily(v.trim());
  }
  const fontFamilySelectValue = inCustomMode ? '__custom__' : settings.fontFamily;

  function onCustomMmChange(
    field:
      | 'customWidthMm'
      | 'customHeightMm'
      | 'customMarginTopMm'
      | 'customMarginRightMm'
      | 'customMarginBottomMm'
      | 'customMarginLeftMm',
    raw: string,
  ) {
    const n = Number(raw);
    const isMargin = field.startsWith('customMargin');
    const min = isMargin ? 5 : 50;
    const max = isMargin ? 100 : 500;
    if (!Number.isFinite(n) || n < min || n > max) {
      setPdfMmRangeError(true);
    } else {
      setPdfMmRangeError(false);
    }
    settings.setPdfDefaults({ [field]: n } as Partial<PdfDefaults>);
  }

  const pdfFontSelectValue = fontFamilyPresetValues.has(settings.pdfDefaults.fontFamily)
    ? settings.pdfDefaults.fontFamily
    : settings.pdfDefaults.fontFamily
      ? '__custom_pdf__'
      : '';
  function onSelectPdfFont(v: string) {
    if (v === '__custom_pdf__') return;
    settings.setPdfDefaults({ fontFamily: v });
  }

  if (!open) return null;

  // 一个区间滑块行（label + 值，右侧滑块）。
  const rangeRow = (label: ReactNode, node: ReactNode) => (
    <div className="set-row">
      <div className="set-row__label">{label}</div>
      <div className="set-row__control" style={{ width: 200 }}>{node}</div>
    </div>
  );

  return (
    <div className="settings__backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="settings" role="dialog" aria-label="Settings">
        <header className="settings__header">
          <h2>{t('settings.title')}</h2>
          <button className="settings__close" onClick={() => onClose()}><Icon name="close" size={18} /></button>
        </header>
        <div className="settings__layout">
          {/* 左侧分类导航：点击切右侧内容；一次只显示一个分类。 */}
          <nav className="settings__nav">
            {categories.map((c) => (
              <button
                key={c.id}
                className={`settings__nav-item${activeCategory === c.id ? ' settings__nav-item--active' : ''}`}
                onClick={() => setActiveCategory(c.id)}
              >
                <span className="settings__nav-icon"><Icon name={c.icon} size={15} /></span>
                <span className="settings__nav-label">{c.label ?? t(c.labelKey ?? '')}</span>
              </button>
            ))}
          </nav>
          <div className="settings__body" data-active-cat={activeCategory}>
            {/* ───────── 模板 ───────── */}
            <div data-cat="templates"><TemplateManager /></div>

            {/* ───────── 智能体设置（顶部 TAB） ───────── */}
            <div data-cat="ai">
              <TabBar tabs={AI_TABS} active={aiTab} onChange={(id) => setAiTab(id as AiTab)} />
              {activeCategory === 'ai' && (
                aiTab === 'agent' ? (<><AgentTab /><AiChannels /></>)
                  : aiTab === 'cron' ? <CronTab />
                    : aiTab === 'skills' ? <SkillsTab />
                      : aiTab === 'tools' ? <ToolsTab />
                        : aiTab === 'providers' ? <ProvidersTab />
                          : <BridgeTab />
              )}
            </div>

            {/* ───────── 基础 ───────── */}
            <div data-cat="basics">
              <SettingsSection title={t('settings.catBasics')}>
                <SettingsRow
                  label={t('settings.language')}
                  control={
                    <Select value={settings.language} onChange={(e) => settings.setLanguage(e.target.value as 'zh' | 'en')} style={{ width: 180 }}>
                      <option value="zh">中文</option>
                      <option value="en">English</option>
                    </Select>
                  }
                />
                <SettingsRow
                  label={t('settings.theme')}
                  control={
                    <Select value={settings.theme} onChange={(e) => settings.setTheme(e.target.value as Theme)} style={{ width: 180 }}>
                      {themeLabels.map((th) => (<option key={th.value} value={th.value}>{th.label}</option>))}
                    </Select>
                  }
                />
                <SettingsRow
                  label={t('settings.fontFamily')}
                  hint={t('settings.fontFamilyHint')}
                  control={
                    <Select value={fontFamilySelectValue} onChange={(e) => onSelectFontFamily(e.target.value)} style={{ width: 200 }}>
                      {fontFamilies.map((f) => (<option key={f.label} value={f.value}>{f.label}</option>))}
                      <option value="__custom__">{t('settings.customFont')}</option>
                    </Select>
                  }
                />
                {fontFamilySelectValue === '__custom__' && (
                  <input
                    type="text"
                    className="settings-input"
                    placeholder={t('settings.customFontPlaceholder')}
                    value={customFontFamily}
                    onChange={(e) => onCustomFontInput(e.target.value)}
                    style={{ marginTop: 4 }}
                  />
                )}
                {rangeRow(`${t('settings.fontSize')}: ${settings.fontSize}px`, <input type="range" min="10" max="28" value={settings.fontSize} onChange={(e) => settings.setFontSize(+e.target.value)} style={{ width: '100%' }} />)}
                {rangeRow(`${t('settings.uiFontSize')}: ${settings.uiFontSize}px`, <input type="range" min="10" max="20" value={settings.uiFontSize} onChange={(e) => settings.setUiFontSize(+e.target.value)} style={{ width: '100%' }} />)}
                {rangeRow(
                  <>{t('settings.globalZoom')}: {Math.round((settings.globalZoom || 1) * 100)}% <button type="button" className="link-button" style={{ marginLeft: 6 }} onClick={() => settings.resetZoom()}>{t('settings.globalZoomReset')}</button></>,
                  <input type="range" min="0.75" max="2.5" step="0.05" value={settings.globalZoom} onChange={(e) => settings.setGlobalZoom(+e.target.value)} style={{ width: '100%' }} />,
                )}
              </SettingsSection>

              <SettingsSection title={t('settings.catBasics')}>
                <SettingsRow label={t('settings.wordWrap')} control={<Toggle on={settings.wordWrap} onChange={() => settings.toggleWordWrap()} />} />
                <SettingsRow label={t('settings.lineNumbers')} control={<Toggle on={settings.showLineNumbers} onChange={() => settings.toggleLineNumbers()} />} />
                <SettingsRow label={t('settings.showHiddenFiles')} hint={t('settings.showHiddenFilesHint')} control={<Toggle on={settings.showHiddenFiles} onChange={() => settings.toggleShowHiddenFiles()} />} />
                <SettingsRow label={t('settings.previewFitWidth')} control={<Toggle on={settings.previewFitWidth} onChange={() => settings.togglePreviewFitWidth()} />} />
                <SettingsRow label={t('settings.codeBlockLineNumbers')} hint={t('settings.codeBlockLineNumbersHint')} control={<Toggle on={settings.codeBlockLineNumbers} onChange={() => settings.toggleCodeBlockLineNumbers()} />} />
              </SettingsSection>
            </div>

            {/* ───────── 写作 ───────── */}
            <div data-cat="writing">
              <SettingsSection title={t('writingStats.settingsHeading')} hint={t('writingStats.frontMatterHint')}>
                <SettingsRow label={t('writingStats.showInStatusBar')} control={<Toggle on={settings.showWritingStats} onChange={() => settings.toggleWritingStats()} />} />
                <SettingsRow label={t('writingStats.showWorkspaceDailyTotal')} control={<Toggle on={settings.showWorkspaceDailyTotal} disabled={!settings.showWritingStats} onChange={() => settings.toggleWorkspaceDailyTotal()} />} />
              </SettingsSection>

              <SettingsSection title={t('settings.catWriting')}>
                <SettingsRow label={t('settings.spellcheckEnabled')} control={<Toggle on={settings.spellcheckEnabled} onChange={() => settings.toggleSpellcheckEnabled()} />} />
                <SettingsRow label={t('settings.spellCheck')} control={<Toggle on={settings.spellCheck} onChange={() => settings.toggleSpellCheck()} />} />
                <SettingsRow label={t('settings.focusMode')} control={<Toggle on={settings.focusMode} onChange={() => settings.toggleFocusMode()} />} />
                <SettingsRow label={t('settings.typewriterMode')} control={<Toggle on={settings.typewriterMode} onChange={() => settings.toggleTypewriterMode()} />} />
                <SettingsRow label={t('settings.vimMode')} control={<Toggle on={settings.vimMode} onChange={() => settings.toggleVimMode()} />} />
                <SettingsRow label={t('settings.slashCommandsEnabled')} control={<Toggle on={settings.slashCommandsEnabled} onChange={() => settings.toggleSlashCommandsEnabled()} />} />
                <SettingsRow
                  label={t('settings.attachmentMode')}
                  hint={t('settings.attachmentModeHint')}
                  control={
                    <Select value={settings.attachmentMode} onChange={(e) => settings.setAttachmentMode(e.target.value as 'shared' | 'per-file')} style={{ width: 180 }}>
                      <option value="shared">{t('settings.attachmentModeShared')}</option>
                      <option value="per-file">{t('settings.attachmentModePerFile')}</option>
                    </Select>
                  }
                />
                {settings.attachmentMode === 'shared' && (
                  <SettingsRow
                    label={t('settings.assetsDirName')}
                    hint={t('settings.assetsDirNameHint')}
                    control={<CommitInput type="text" value={settings.assetsDirName} onCommit={(v) => settings.setAssetsDirName(v)} placeholder="_assets" style={textInputStyle} />}
                  />
                )}
              </SettingsSection>

              <SettingsSection title={t('pomodoro.settingsHeading')}>
                <SettingsRow label={t('pomodoro.showControls')} hint={t('pomodoro.showControlsHint')} control={<Toggle on={settings.pomodoroShowControls} onChange={() => settings.togglePomodoroShowControls()} />} />
                <SettingsRow label={t('pomodoro.autoEngageFocus')} hint={t('pomodoro.autoEngageFocusHint')} control={<Toggle on={settings.pomodoroAutoEngageFocus} onChange={() => settings.togglePomodoroAutoEngageFocus()} />} />
                <SettingsRow
                  label={t('pomodoro.defaultDuration')}
                  control={
                    <>
                      <Select
                        value={String(settings.pomodoroDefaultMinutes)}
                        onChange={(e) => { const v = e.target.value; if (v === 'custom') return; settings.setPomodoroDefaultMinutes(parseInt(v, 10)); }}
                        style={{ width: 120 }}
                      >
                        <option value="25">25 {t('pomodoro.minShort')}</option>
                        <option value="50">50 {t('pomodoro.minShort')}</option>
                        <option value="90">90 {t('pomodoro.minShort')}</option>
                      </Select>
                      <input
                        type="number" min="1" max="600"
                        value={settings.pomodoroDefaultMinutes}
                        onChange={(e) => settings.setPomodoroDefaultMinutes(parseInt(e.target.value, 10) || 25)}
                        aria-label={t('pomodoro.customDurationLabel')}
                        className="settings-input"
                        style={{ width: 70 }}
                      />
                    </>
                  }
                />
              </SettingsSection>
            </div>

            {/* ───────── 导出 ───────── */}
            <div data-cat="export">
              <SettingsSection title={t('settings.pdfDefaults.heading')} hint={t('settings.pdfDefaults.headingHint')}>
                <SettingsRow
                  label={t('settings.pdfDefaults.pageSize')}
                  control={
                    <Select value={settings.pdfDefaults.pageSize} onChange={(e) => settings.setPdfDefaults({ pageSize: e.target.value as PdfDefaults['pageSize'] })} style={{ width: 200 }}>
                      <option value="A4">A4 (210 × 297 mm)</option>
                      <option value="A5">A5 (148 × 210 mm)</option>
                      <option value="Letter">{t('settings.pdfDefaults.letter')} (8.5 × 11 in)</option>
                      <option value="Legal">{t('settings.pdfDefaults.legal')} (8.5 × 14 in)</option>
                      <option value="Custom">{t('settings.pdfDefaults.custom')}</option>
                    </Select>
                  }
                />
                {settings.pdfDefaults.pageSize === 'Custom' && (
                  <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                    <input type="number" min="50" max="500" step="1" value={settings.pdfDefaults.customWidthMm} onChange={(e) => onCustomMmChange('customWidthMm', e.target.value)} className="settings-input" style={mmInput} aria-label={t('settings.pdfDefaults.widthMm')} />
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>×</span>
                    <input type="number" min="50" max="500" step="1" value={settings.pdfDefaults.customHeightMm} onChange={(e) => onCustomMmChange('customHeightMm', e.target.value)} className="settings-input" style={mmInput} aria-label={t('settings.pdfDefaults.heightMm')} />
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>mm</span>
                  </div>
                )}
                <SettingsRow
                  label={t('settings.pdfDefaults.margin')}
                  control={
                    <Select value={settings.pdfDefaults.margin} onChange={(e) => settings.setPdfDefaults({ margin: e.target.value as PdfDefaults['margin'] })} style={{ width: 200 }}>
                      <option value="Narrow">{t('settings.pdfDefaults.marginNarrow')} (10 mm)</option>
                      <option value="Normal">{t('settings.pdfDefaults.marginNormal')} (15 mm)</option>
                      <option value="Wide">{t('settings.pdfDefaults.marginWide')} (25 mm)</option>
                      <option value="Custom">{t('settings.pdfDefaults.custom')}</option>
                    </Select>
                  }
                />
                {settings.pdfDefaults.margin === 'Custom' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 10px' }}>
                    {([
                      ['customMarginTopMm', 'marginTop'],
                      ['customMarginRightMm', 'marginRight'],
                      ['customMarginBottomMm', 'marginBottom'],
                      ['customMarginLeftMm', 'marginLeft'],
                    ] as const).map(([field, key]) => (
                      <label key={field} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                        <span style={{ minWidth: 56, color: 'var(--text-muted)' }}>{t(`settings.pdfDefaults.${key}`)}</span>
                        <input type="number" min="5" max="100" step="1" value={settings.pdfDefaults[field]} onChange={(e) => onCustomMmChange(field, e.target.value)} className="settings-input" style={mmInputSm} />
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>mm</span>
                      </label>
                    ))}
                  </div>
                )}
                {pdfMmRangeError && <p className="set-section__hint" style={{ color: 'var(--danger)' }}>{t('settings.pdfDefaults.mmRangeError')}</p>}
                <SettingsRow
                  label={t('settings.pdfDefaults.fontFamily')}
                  control={
                    <Select value={pdfFontSelectValue} onChange={(e) => onSelectPdfFont(e.target.value)} style={{ width: 200 }}>
                      <option value="">{t('settings.pdfDefaults.fontInherit')}</option>
                      {fontFamilies.map((f) => (<option key={f.label} value={f.value}>{f.label}</option>))}
                    </Select>
                  }
                />
                {rangeRow(`${t('settings.pdfDefaults.fontSize')}: ${settings.pdfDefaults.fontSize}pt`, <input type="range" min="9" max="16" step="1" value={settings.pdfDefaults.fontSize} onChange={(e) => settings.setPdfDefaults({ fontSize: +e.target.value })} style={{ width: '100%' }} />)}
                <SettingsRow label={t('settings.pdfDefaults.footer')} control={<Toggle on={settings.pdfDefaults.footer} onChange={(on) => settings.setPdfDefaults({ footer: on })} />} />
                <SettingsRow
                  label={t('settings.pdfDefaults.codeTheme')}
                  hint={t('settings.pdfDefaults.frontmatterHint')}
                  control={
                    <Select value={settings.pdfDefaults.codeTheme} onChange={(e) => settings.setPdfDefaults({ codeTheme: e.target.value as PdfDefaults['codeTheme'] })} style={{ width: 160 }}>
                      <option value="preview">{t('settings.pdfDefaults.codeThemePreview')}</option>
                      <option value="light">{t('settings.pdfDefaults.codeThemeLight')}</option>
                      <option value="dark">{t('settings.pdfDefaults.codeThemeDark')}</option>
                    </Select>
                  }
                />
                <SettingsRow label={t('settings.imageExportBranding')} hint={t('settings.imageExportBrandingHint')} control={<Toggle on={settings.imageExportBranding} onChange={() => settings.toggleImageExportBranding()} />} />
              </SettingsSection>

              <CitationPickerSettings />
            </div>

            {/* ───────── 高级 ───────── */}
            <div data-cat="advanced">
              <SettingsSection title={t('settings.versionHistoryHeading')} hint={t('settings.autoGitHelp')}>
                <SettingsRow label={t('settings.autoGitEnabled')} control={<Toggle on={settings.autoGitEnabled} onChange={() => settings.toggleAutoGit()} />} />
                <HistorySettings />
              </SettingsSection>

              <SettingsSection title={t('settings.catAdvanced')}>
                <SettingsRow label={t('settings.dailyNotesPath')} hint="_日历/年/月/日.md" control={<span />} />
                <SettingsRow label={t('settings.restoreSession')} hint={t('settings.restoreSessionHint')} control={<Toggle on={settings.restoreSession} onChange={() => settings.toggleRestoreSession()} />} />
                <SettingsRow
                  label={t('settings.startupViewMode')}
                  hint={t('settings.startupViewModeHint')}
                  control={
                    <Select value={settings.startupViewMode ?? ''} onChange={(e) => settings.setStartupViewMode((e.target.value || null) as ViewMode | null)} style={{ width: 180 }}>
                      <option value="">{t('settings.startupViewModeLastUsed')}</option>
                      <option value="edit">{t('settings.startupViewModeEdit')}</option>
                      <option value="split">{t('settings.startupViewModeSplit')}</option>
                      <option value="preview">{t('settings.startupViewModePreview')}</option>
                      <option value="reading">{t('settings.startupViewModeReading')}</option>
                    </Select>
                  }
                />
                <SettingsRow label={t('settings.perWorkspaceTabs')} hint={t('settings.perWorkspaceTabsHint')} control={<Toggle on={settings.perWorkspaceTabs} onChange={() => settings.togglePerWorkspaceTabs()} />} />
                <SettingsRow label={t('settings.autoReloadExternalChanges')} hint={t('settings.autoReloadExternalChangesHint')} control={<Toggle on={settings.autoReloadExternalChanges} onChange={() => settings.toggleAutoReloadExternalChanges()} />} />
                <SettingsRow label={t('settings.autoSaveOnBlur')} hint={t('settings.autoSaveOnBlurHint')} control={<Toggle on={settings.autoSaveOnBlur} onChange={() => settings.toggleAutoSaveOnBlur()} />} />
                {!masBuild && (
                  <SettingsRow
                    label={t('settings.autoCheckUpdate')}
                    control={
                      <>
                        <Toggle on={settings.autoCheckUpdate} onChange={() => settings.toggleAutoCheckUpdate()} />
                        <button className="set-btn" disabled={checkingUpdate} onClick={manualCheckUpdate}>
                          {checkingUpdate ? t('settings.checkingUpdate') : t('settings.checkUpdate')}
                        </button>
                      </>
                    }
                  />
                )}
              </SettingsSection>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsPanel;
