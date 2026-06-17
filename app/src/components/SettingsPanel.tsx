/**
 * SettingsPanel.tsx — 设置面板容器（从 SettingsPanel.vue 迁移）。
 *
 * 左侧分类导航 + 右侧内容；可见性沿用 data-cat / data-active-cat 的 CSS 机制
 * （body 的 data-active-cat 决定哪一组 [data-cat] 子节点显示），逐字保留以零行为漂移。
 * 内嵌全部 Settings 子面板。ref→useState，computed→内联派生，watch(open)→useEffect。
 */
import { useEffect, useState } from 'react';
import { Icon } from './Icons';
import { useSettingsStore, type PdfDefaults } from '../stores/settings';
import { useToastsStore } from '../stores/toasts';
import { themeLabels } from '../lib/themes';
import { useI18n } from '../i18n';
import { checkForUpdate, openReleaseUrl, isMasBuild } from '../lib/check-update';
import { CommitInput } from './CommitInput';
import { CitationPickerSettings } from './CitationPickerSettings';
import { HistorySettings } from './HistorySettings';
import { TemplateManager } from './TemplateManager';
import { isIOS } from '../lib/platform';
import type { Theme, ViewMode } from '../types';

type SettingsCategory = 'basics' | 'templates' | 'writing' | 'export' | 'advanced';

const VALID_CATEGORIES = new Set<SettingsCategory>([
  'basics', 'templates', 'writing', 'export', 'advanced',
]);

const categories: { id: SettingsCategory; icon: string; labelKey?: string; label?: string }[] = [
  { id: 'basics', icon: 'settings', labelKey: 'settings.catBasics' },
  { id: 'templates', icon: 'package', labelKey: 'settings.catTemplates' },
  { id: 'writing', icon: 'pen', labelKey: 'settings.catWriting' },
  { id: 'export', icon: 'export', labelKey: 'settings.catExport' },
  { id: 'advanced', icon: 'tool', labelKey: 'settings.catAdvanced' },
];

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

// 复用的内联样式（逐字对应 Vue 的 style 字符串）。
const hintMt4: React.CSSProperties = { fontSize: '11px', color: 'var(--text-faint)', margin: '4px 0 0', lineHeight: 1.5 };
const subHeading: React.CSSProperties = { fontSize: '13px', fontWeight: 600, color: 'var(--text)', margin: '18px 0 6px' };
const advHint: React.CSSProperties = { fontSize: '11px', color: 'var(--text-faint)', marginTop: '4px', lineHeight: 1.5 };
const textInputStyle: React.CSSProperties = { padding: '6px 8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', borderRadius: '4px', font: 'inherit' };

interface SettingsPanelProps {
  open: boolean;
  initialSection?: string | null;
  onClose: () => void;
}

export function SettingsPanel({ open, initialSection, onClose }: SettingsPanelProps) {
  const isMobilePlatform = isIOS();
  const masBuild = isMasBuild();
  const { t } = useI18n();

  const settings = useSettingsStore();

  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('basics');
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  // Track custom-mode independently of settings.fontFamily 以便选 "自定义…" 时即使没输入也露出输入框。
  const [inCustomMode, setInCustomMode] = useState(() => !fontFamilyPresetValues.has(settings.fontFamily));
  const [customFontFamily, setCustomFontFamily] = useState(() =>
    !fontFamilyPresetValues.has(settings.fontFamily) ? settings.fontFamily : '',
  );
  const [pdfMmRangeError, setPdfMmRangeError] = useState(false);

  // Deep-link：open 变 true 时按 initialSection 落到指定分类（复刻 watch(open)）。
  useEffect(() => {
    if (!open) return;
    const target = initialSection;
    if (target && VALID_CATEGORIES.has(target as SettingsCategory)) {
      setActiveCategory(target as SettingsCategory);
    }
  }, [open, initialSection]);

  async function manualCheckUpdate() {
    const toasts = useToastsStore.getState();
    setCheckingUpdate(true);
    try {
      const r = await checkForUpdate();
      if (r.error) {
        // GitHub releases 查询失败（离线 / DNS / 限流）。不撒谎说 "up to date"。
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
    // 宽高接受 50–500mm；边距 5–100mm。越界静默钳制（store 也钳），但内联标红反馈误输入。
    const isMargin = field.startsWith('customMargin');
    const min = isMargin ? 5 : 50;
    const max = isMargin ? 100 : 500;
    if (!Number.isFinite(n) || n < min || n > max) {
      setPdfMmRangeError(true);
    } else {
      setPdfMmRangeError(false);
    }
    // 转发现值——store 会钳到安全范围，typo 不会产生半页宽边距。
    settings.setPdfDefaults({ [field]: n } as Partial<PdfDefaults>);
  }

  // PDF 字体下拉：空值表示 "继承 / 用样式表默认"。
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
            <div data-cat="templates"><TemplateManager /></div>

            <section data-cat="basics">
              <label>{t('settings.language')}</label>
              <select
                value={settings.language}
                onChange={(e) => settings.setLanguage(e.target.value as 'zh' | 'en')}
              >
                <option value="zh">中文</option>
                <option value="en">English</option>
              </select>
            </section>

            <section data-cat="basics">
              <label>{t('settings.theme')}</label>
              <select value={settings.theme} onChange={(e) => settings.setTheme(e.target.value as Theme)}>
                {themeLabels.map((th) => (
                  <option key={th.value} value={th.value}>{th.label}</option>
                ))}
              </select>
            </section>

            <section data-cat="basics">
              <label>{t('settings.fontFamily')}</label>
              <select value={fontFamilySelectValue} onChange={(e) => onSelectFontFamily(e.target.value)}>
                {fontFamilies.map((f) => (
                  <option key={f.label} value={f.value}>{f.label}</option>
                ))}
                <option value="__custom__">{t('settings.customFont')}</option>
              </select>
              {fontFamilySelectValue === '__custom__' && (
                <input
                  type="text"
                  placeholder={t('settings.customFontPlaceholder')}
                  value={customFontFamily}
                  onChange={(e) => onCustomFontInput(e.target.value)}
                  style={{ marginTop: '6px', padding: '6px 8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', borderRadius: '4px', font: 'inherit', width: '100%' }}
                />
              )}
              <p className="setting-hint">{t('settings.fontFamilyHint')}</p>
            </section>

            <section data-cat="basics">
              <label>{t('settings.fontSize')}: {settings.fontSize}px</label>
              <input type="range" min="10" max="28" value={settings.fontSize} onChange={(e) => settings.setFontSize(+e.target.value)} />
            </section>

            <section data-cat="basics">
              <label>{t('settings.uiFontSize')}: {settings.uiFontSize}px</label>
              <input type="range" min="10" max="20" value={settings.uiFontSize} onChange={(e) => settings.setUiFontSize(+e.target.value)} />
            </section>

            <section data-cat="basics">
              <label>
                {t('settings.globalZoom')}:
                {' '}{Math.round((settings.globalZoom || 1) * 100)}%
              </label>
              <input type="range" min="0.75" max="2.5" step="0.05" value={settings.globalZoom} onChange={(e) => settings.setGlobalZoom(+e.target.value)} />
              <p className="setting-hint">
                {t('settings.globalZoomHint')}
                <button type="button" className="link-button" style={{ marginLeft: '8px' }} onClick={() => settings.resetZoom()}>
                  {t('settings.globalZoomReset')}
                </button>
              </p>
            </section>

            <section data-cat="basics">
              <label>
                <input type="checkbox" checked={settings.wordWrap} onChange={() => settings.toggleWordWrap()} />
                {t('settings.wordWrap')}
              </label>
            </section>

            <section data-cat="basics">
              <label>
                <input type="checkbox" checked={settings.showLineNumbers} onChange={() => settings.toggleLineNumbers()} />
                {t('settings.lineNumbers')}
              </label>
            </section>

            <section data-cat="basics">
              <label>
                <input type="checkbox" checked={settings.showHiddenFiles} onChange={() => settings.toggleShowHiddenFiles()} />
                {t('settings.showHiddenFiles')}
              </label>
              <p style={hintMt4}>{t('settings.showHiddenFilesHint')}</p>
            </section>

            <section data-cat="basics">
              <label>
                <input type="checkbox" checked={settings.previewFitWidth} onChange={() => settings.togglePreviewFitWidth()} />
                {t('settings.previewFitWidth')}
              </label>
            </section>

            <section data-cat="basics">
              <label>
                <input type="checkbox" checked={settings.codeBlockLineNumbers} onChange={() => settings.toggleCodeBlockLineNumbers()} />
                {t('settings.codeBlockLineNumbers')}
              </label>
              <p className="setting-hint">{t('settings.codeBlockLineNumbersHint')}</p>
            </section>

            <section data-cat="basics">
              <label>
                <input type="checkbox" checked={settings.readingByDefaultOnMobile} onChange={() => settings.toggleReadingByDefaultOnMobile()} />
                {t('reading.readingByDefaultOnMobile')}
              </label>
              <p style={hintMt4}>{t('reading.readingByDefaultOnMobileHint')}</p>
            </section>

            <section data-cat="writing">
              <h3 style={subHeading}>{t('writingStats.settingsHeading')}</h3>
              <label>
                <input type="checkbox" checked={settings.showWritingStats} onChange={() => settings.toggleWritingStats()} />
                {t('writingStats.showInStatusBar')}
              </label>
              <label style={{ marginTop: '6px' }}>
                <input type="checkbox" checked={settings.showWorkspaceDailyTotal} onChange={() => settings.toggleWorkspaceDailyTotal()} disabled={!settings.showWritingStats} />
                {t('writingStats.showWorkspaceDailyTotal')}
              </label>
              <p style={hintMt4}>{t('writingStats.frontMatterHint')}</p>
            </section>

            <section data-cat="advanced">
              <h3 style={subHeading}>{t('settings.versionHistoryHeading')}</h3>
              <label>
                <input type="checkbox" checked={settings.autoGitEnabled} onChange={() => settings.toggleAutoGit()} />
                {t('settings.autoGitEnabled')}
              </label>
              <p style={hintMt4}>{t('settings.autoGitHelp')}</p>
              <HistorySettings />
            </section>

            <section data-cat="writing">
              <label>
                <input type="checkbox" checked={settings.spellcheckEnabled} onChange={() => settings.toggleSpellcheckEnabled()} />
                {t('settings.spellcheckEnabled')}
              </label>
            </section>

            {/* v2.5 F3: PDF / print export defaults. */}
            <section data-cat="export">
              <h3 style={subHeading}>{t('settings.pdfDefaults.heading')}</h3>
              <p className="setting-hint">{t('settings.pdfDefaults.headingHint')}</p>
            </section>

            <section data-cat="export">
              <label>{t('settings.pdfDefaults.pageSize')}</label>
              <select value={settings.pdfDefaults.pageSize} onChange={(e) => settings.setPdfDefaults({ pageSize: e.target.value as PdfDefaults['pageSize'] })}>
                <option value="A4">A4 (210 × 297 mm)</option>
                <option value="A5">A5 (148 × 210 mm)</option>
                <option value="Letter">{t('settings.pdfDefaults.letter')} (8.5 × 11 in)</option>
                <option value="Legal">{t('settings.pdfDefaults.legal')} (8.5 × 14 in)</option>
                <option value="Custom">{t('settings.pdfDefaults.custom')}</option>
              </select>
              {settings.pdfDefaults.pageSize === 'Custom' && (
                <div className="row" style={{ gap: '6px', alignItems: 'center', marginTop: '6px' }}>
                  <input
                    type="number" min="50" max="500" step="1"
                    value={settings.pdfDefaults.customWidthMm}
                    onChange={(e) => onCustomMmChange('customWidthMm', e.target.value)}
                    style={{ width: '90px', padding: '6px 8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', borderRadius: '4px' }}
                    aria-label={t('settings.pdfDefaults.widthMm')}
                  />
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>×</span>
                  <input
                    type="number" min="50" max="500" step="1"
                    value={settings.pdfDefaults.customHeightMm}
                    onChange={(e) => onCustomMmChange('customHeightMm', e.target.value)}
                    style={{ width: '90px', padding: '6px 8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', borderRadius: '4px' }}
                    aria-label={t('settings.pdfDefaults.heightMm')}
                  />
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>mm</span>
                </div>
              )}
            </section>

            <section data-cat="export">
              <label>{t('settings.pdfDefaults.margin')}</label>
              <select value={settings.pdfDefaults.margin} onChange={(e) => settings.setPdfDefaults({ margin: e.target.value as PdfDefaults['margin'] })}>
                <option value="Narrow">{t('settings.pdfDefaults.marginNarrow')} (10 mm)</option>
                <option value="Normal">{t('settings.pdfDefaults.marginNormal')} (15 mm)</option>
                <option value="Wide">{t('settings.pdfDefaults.marginWide')} (25 mm)</option>
                <option value="Custom">{t('settings.pdfDefaults.custom')}</option>
              </select>
              {settings.pdfDefaults.margin === 'Custom' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 10px', marginTop: '6px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                    <span style={{ minWidth: '56px', color: 'var(--text-muted)' }}>{t('settings.pdfDefaults.marginTop')}</span>
                    <input type="number" min="5" max="100" step="1" value={settings.pdfDefaults.customMarginTopMm} onChange={(e) => onCustomMmChange('customMarginTopMm', e.target.value)} style={{ width: '70px', padding: '4px 6px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', borderRadius: '4px' }} />
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>mm</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                    <span style={{ minWidth: '56px', color: 'var(--text-muted)' }}>{t('settings.pdfDefaults.marginRight')}</span>
                    <input type="number" min="5" max="100" step="1" value={settings.pdfDefaults.customMarginRightMm} onChange={(e) => onCustomMmChange('customMarginRightMm', e.target.value)} style={{ width: '70px', padding: '4px 6px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', borderRadius: '4px' }} />
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>mm</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                    <span style={{ minWidth: '56px', color: 'var(--text-muted)' }}>{t('settings.pdfDefaults.marginBottom')}</span>
                    <input type="number" min="5" max="100" step="1" value={settings.pdfDefaults.customMarginBottomMm} onChange={(e) => onCustomMmChange('customMarginBottomMm', e.target.value)} style={{ width: '70px', padding: '4px 6px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', borderRadius: '4px' }} />
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>mm</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                    <span style={{ minWidth: '56px', color: 'var(--text-muted)' }}>{t('settings.pdfDefaults.marginLeft')}</span>
                    <input type="number" min="5" max="100" step="1" value={settings.pdfDefaults.customMarginLeftMm} onChange={(e) => onCustomMmChange('customMarginLeftMm', e.target.value)} style={{ width: '70px', padding: '4px 6px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', borderRadius: '4px' }} />
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>mm</span>
                  </label>
                </div>
              )}
              {pdfMmRangeError && (
                <p className="setting-hint" style={{ color: 'var(--danger, #d12)' }}>{t('settings.pdfDefaults.mmRangeError')}</p>
              )}
            </section>

            <section data-cat="export">
              <label>{t('settings.pdfDefaults.fontFamily')}</label>
              <select value={pdfFontSelectValue} onChange={(e) => onSelectPdfFont(e.target.value)}>
                <option value="">{t('settings.pdfDefaults.fontInherit')}</option>
                {fontFamilies.map((f) => (
                  <option key={f.label} value={f.value}>{f.label}</option>
                ))}
              </select>
            </section>

            <section data-cat="export">
              <label>{t('settings.pdfDefaults.fontSize')}: {settings.pdfDefaults.fontSize}pt</label>
              <input type="range" min="9" max="16" step="1" value={settings.pdfDefaults.fontSize} onChange={(e) => settings.setPdfDefaults({ fontSize: +e.target.value })} />
            </section>

            <section data-cat="export">
              <label>
                <input type="checkbox" checked={settings.pdfDefaults.footer} onChange={(e) => settings.setPdfDefaults({ footer: e.target.checked })} />
                {t('settings.pdfDefaults.footer')}
              </label>
            </section>

            <section data-cat="export">
              <label>{t('settings.pdfDefaults.codeTheme')}</label>
              <select value={settings.pdfDefaults.codeTheme} onChange={(e) => settings.setPdfDefaults({ codeTheme: e.target.value as PdfDefaults['codeTheme'] })}>
                <option value="preview">{t('settings.pdfDefaults.codeThemePreview')}</option>
                <option value="light">{t('settings.pdfDefaults.codeThemeLight')}</option>
                <option value="dark">{t('settings.pdfDefaults.codeThemeDark')}</option>
              </select>
              <p className="setting-hint">{t('settings.pdfDefaults.frontmatterHint')}</p>
            </section>

            <section data-cat="export">
              <label>
                <input type="checkbox" checked={settings.imageExportBranding} onChange={() => settings.toggleImageExportBranding()} />
                {t('settings.imageExportBranding')}
              </label>
              <p className="setting-hint">{t('settings.imageExportBrandingHint')}</p>
            </section>

            <section data-cat="writing">
              <label>{t('settings.attachmentMode')}</label>
              <select value={settings.attachmentMode} onChange={(e) => settings.setAttachmentMode(e.target.value as 'shared' | 'per-file')}>
                <option value="shared">{t('settings.attachmentModeShared')}</option>
                <option value="per-file">{t('settings.attachmentModePerFile')}</option>
              </select>
              <p className="setting-hint">{t('settings.attachmentModeHint')}</p>
            </section>

            {settings.attachmentMode === 'shared' && (
              <section data-cat="writing">
                <label>{t('settings.assetsDirName')}</label>
                <CommitInput type="text" value={settings.assetsDirName} onCommit={(v) => settings.setAssetsDirName(v)} placeholder="_assets" style={textInputStyle} />
                <p className="setting-hint">{t('settings.assetsDirNameHint')}</p>
              </section>
            )}

            <section data-cat="advanced">
              <label>{t('settings.dailyNotesPath')}</label>
              <p className="setting-hint" style={{ marginTop: '4px' }}>_日历/年/月/日.md</p>
            </section>

            <div data-cat="export"><CitationPickerSettings /></div>

            <section data-cat="writing">
              <label>
                <input type="checkbox" checked={settings.spellCheck} onChange={() => settings.toggleSpellCheck()} />
                {t('settings.spellCheck')}
              </label>
            </section>

            <section data-cat="writing">
              <label>
                <input type="checkbox" checked={settings.focusMode} onChange={() => settings.toggleFocusMode()} />
                {t('settings.focusMode')}
              </label>
            </section>

            <section data-cat="writing">
              <h3 style={subHeading}>{t('pomodoro.settingsHeading')}</h3>
              <label>
                <input type="checkbox" checked={settings.pomodoroShowControls} onChange={() => settings.togglePomodoroShowControls()} />
                {t('pomodoro.showControls')}
              </label>
              <p style={{ fontSize: '11px', color: 'var(--text-faint)', margin: '4px 0 8px', lineHeight: 1.5 }}>{t('pomodoro.showControlsHint')}</p>
              <label>
                <input type="checkbox" checked={settings.pomodoroAutoEngageFocus} onChange={() => settings.togglePomodoroAutoEngageFocus()} />
                {t('pomodoro.autoEngageFocus')}
              </label>
              <p style={{ fontSize: '11px', color: 'var(--text-faint)', margin: '4px 0 8px', lineHeight: 1.5 }}>{t('pomodoro.autoEngageFocusHint')}</p>
              <label style={{ display: 'block', marginTop: '4px' }}>{t('pomodoro.defaultDuration')}</label>
              <select
                value={String(settings.pomodoroDefaultMinutes)}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === 'custom') return;
                  settings.setPomodoroDefaultMinutes(parseInt(v, 10));
                }}
                style={{ marginTop: '4px' }}
              >
                <option value="25">25 {t('pomodoro.minShort')}</option>
                <option value="50">50 {t('pomodoro.minShort')}</option>
                <option value="90">90 {t('pomodoro.minShort')}</option>
              </select>
              <input
                type="number" min="1" max="600"
                value={settings.pomodoroDefaultMinutes}
                onChange={(e) => settings.setPomodoroDefaultMinutes(parseInt(e.target.value, 10) || 25)}
                aria-label={t('pomodoro.customDurationLabel')}
                style={{ marginLeft: '8px', padding: '4px 6px', width: '70px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', borderRadius: '4px', font: 'inherit' }}
              />
            </section>

            <section data-cat="writing">
              <label>
                <input type="checkbox" checked={settings.typewriterMode} onChange={() => settings.toggleTypewriterMode()} />
                {t('settings.typewriterMode')}
              </label>
            </section>

            <section data-cat="writing">
              <label>
                <input type="checkbox" checked={settings.vimMode} onChange={() => settings.toggleVimMode()} />
                {t('settings.vimMode')}
              </label>
            </section>

            <section data-cat="writing">
              <label>
                <input type="checkbox" checked={settings.slashCommandsEnabled} onChange={() => settings.toggleSlashCommandsEnabled()} />
                {t('settings.slashCommandsEnabled')}
              </label>
            </section>

            <section data-cat="advanced">
              <label>
                <input type="checkbox" checked={settings.restoreSession} onChange={() => settings.toggleRestoreSession()} />
                {t('settings.restoreSession')}
              </label>
              <div style={advHint}>{t('settings.restoreSessionHint')}</div>
            </section>

            <section data-cat="advanced">
              <label>{t('settings.startupViewMode')}</label>
              <select value={settings.startupViewMode ?? ''} onChange={(e) => settings.setStartupViewMode((e.target.value || null) as ViewMode | null)}>
                <option value="">{t('settings.startupViewModeLastUsed')}</option>
                <option value="edit">{t('settings.startupViewModeEdit')}</option>
                <option value="split">{t('settings.startupViewModeSplit')}</option>
                <option value="preview">{t('settings.startupViewModePreview')}</option>
                <option value="reading">{t('settings.startupViewModeReading')}</option>
              </select>
              <p className="setting-hint">{t('settings.startupViewModeHint')}</p>
            </section>

            <section data-cat="advanced">
              <label>
                <input type="checkbox" checked={settings.perWorkspaceTabs} onChange={() => settings.togglePerWorkspaceTabs()} />
                {t('settings.perWorkspaceTabs')}
              </label>
              <div style={advHint}>{t('settings.perWorkspaceTabsHint')}</div>
            </section>

            <section data-cat="advanced">
              <label>
                <input type="checkbox" checked={settings.autoReloadExternalChanges} onChange={() => settings.toggleAutoReloadExternalChanges()} />
                {t('settings.autoReloadExternalChanges')}
              </label>
              <div style={advHint}>{t('settings.autoReloadExternalChangesHint')}</div>
            </section>

            <section data-cat="advanced">
              <label>
                <input type="checkbox" checked={settings.autoSaveOnBlur} onChange={() => settings.toggleAutoSaveOnBlur()} />
                {t('settings.autoSaveOnBlur')}
              </label>
              <div style={advHint}>{t('settings.autoSaveOnBlurHint')}</div>
            </section>

            {!isMobilePlatform && !masBuild && (
              <section data-cat="advanced">
                <label>
                  <input type="checkbox" checked={settings.autoCheckUpdate} onChange={() => settings.toggleAutoCheckUpdate()} />
                  {t('settings.autoCheckUpdate')}
                </label>
                <div className="row" style={{ gap: '8px', alignItems: 'center', marginTop: '8px' }}>
                  <button disabled={checkingUpdate} onClick={manualCheckUpdate}>
                    {checkingUpdate ? t('settings.checkingUpdate') : t('settings.checkUpdate')}
                  </button>
                </div>
              </section>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsPanel;
