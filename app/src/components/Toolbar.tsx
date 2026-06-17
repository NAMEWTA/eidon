/**
 * Toolbar.tsx — 顶部工具栏（从 Toolbar.vue 迁移）。
 *
 * 文件操作 / 视图模式 / 插入 / 导出·复制 / 焦点·番茄钟 / 搜索·命令面板·帮助·设置·主题。
 * 下拉菜单经 createPortal 挂到 <body>（复刻 Vue <Teleport to="body">），用 fixed 定位从按钮 rect 计算。
 * emits→回调 props；ref→useState/useRef；onMounted/onBeforeUnmount→mount effect。
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icons';
import { PomodoroPopover } from './PomodoroPopover';
import { useTabsStore } from '../stores/tabs';
import { useSettingsStore } from '../stores/settings';
import { useWorkspaceStore } from '../stores/workspace';
import { useTilesStore } from '../stores/tiles';
import { useFiles } from '../composables/useFiles';
import { useExport } from '../composables/useExport';
import { useI18n } from '../i18n';
import { open as openFileDialog } from '@tauri-apps/plugin-dialog';

interface ToolbarProps {
  onOpenPalette: () => void;
  onOpenHelp: () => void;
}

export function Toolbar({ onOpenPalette, onOpenHelp }: ToolbarProps) {
  const { t } = useI18n();
  const settings = useSettingsStore();
  const workspace = useWorkspaceStore();
  const files = useFiles();
  const exporter = useExport();
  const isMarkdown = useTabsStore((s) => s.activeTab()?.language === 'markdown');

  const [recentOpen, setRecentOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [insertOpen, setInsertOpen] = useState(false);
  const [pomoOpen, setPomoOpen] = useState(false);
  const [wsSwitcherOpen, setWsSwitcherOpen] = useState(false);

  const newBtnRef = useRef<HTMLButtonElement | null>(null);
  const recentBtnRef = useRef<HTMLButtonElement | null>(null);
  const exportBtnRef = useRef<HTMLButtonElement | null>(null);
  const insertBtnRef = useRef<HTMLButtonElement | null>(null);
  const copyBtnRef = useRef<HTMLButtonElement | null>(null);
  const wsBtnRef = useRef<HTMLButtonElement | null>(null);

  const [menuPos, setMenuPos] = useState<{ top: number; left?: number; right?: number } | null>(null);
  const floatStyle: React.CSSProperties | undefined = (() => {
    if (!menuPos) return undefined;
    const s: React.CSSProperties = { position: 'fixed', top: `${menuPos.top}px`, zIndex: 1000 };
    if (menuPos.left !== undefined) s.left = `${menuPos.left}px`;
    if (menuPos.right !== undefined) s.right = `${menuPos.right}px`;
    return s;
  })();

  function positionMenuFromButton(btn: HTMLElement | null, align: 'left' | 'right' = 'left') {
    if (!btn) { setMenuPos(null); return; }
    const rect = btn.getBoundingClientRect();
    if (align === 'right') {
      setMenuPos({ top: rect.bottom + 4, right: Math.max(8, window.innerWidth - rect.right) });
    } else {
      setMenuPos({ top: rect.bottom + 4, left: Math.min(rect.left, window.innerWidth - 16) });
    }
  }

  function closeAllDropdowns() {
    setNewOpen(false);
    setRecentOpen(false);
    setExportOpen(false);
    setCopyOpen(false);
    setInsertOpen(false);
    setPomoOpen(false);
    setWsSwitcherOpen(false);
  }

  function togglePomo() {
    closeAllDropdowns();
    setPomoOpen((v) => !v);
  }

  // 互斥开：开一个下拉就关其它。读当前 open 态判断切换。
  function toggleDropdown(name: 'new' | 'recent' | 'export' | 'copy' | 'insert') {
    const isOpen =
      (name === 'new' && newOpen) ||
      (name === 'recent' && recentOpen) ||
      (name === 'export' && exportOpen) ||
      (name === 'copy' && copyOpen) ||
      (name === 'insert' && insertOpen);
    closeAllDropdowns();
    if (!isOpen) {
      if (name === 'new') { positionMenuFromButton(newBtnRef.current); setNewOpen(true); }
      else if (name === 'recent') { positionMenuFromButton(recentBtnRef.current); setRecentOpen(true); }
      else if (name === 'export') { positionMenuFromButton(exportBtnRef.current); setExportOpen(true); }
      else if (name === 'copy') { positionMenuFromButton(copyBtnRef.current, 'right'); setCopyOpen(true); }
      else if (name === 'insert') { positionMenuFromButton(insertBtnRef.current); setInsertOpen(true); }
    }
  }

  function onOpenCjkProofread() {
    window.dispatchEvent(new CustomEvent('eidon:open-cjk-proofread'));
  }

  function dispatchInsert(snippet: string) {
    window.dispatchEvent(
      new CustomEvent('eidon:insert-markdown', { detail: { snippet, paneId: useTilesStore.getState().focusedPaneId } }),
    );
    setInsertOpen(false);
  }

  async function pickAndInsertImage() {
    setInsertOpen(false);
    const sel = await openFileDialog({
      multiple: false,
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif', 'tiff'] }],
    });
    if (typeof sel !== 'string') return;
    window.dispatchEvent(
      new CustomEvent('eidon:insert-image-path', { detail: { path: sel, paneId: useTilesStore.getState().focusedPaneId } }),
    );
  }

  function shortPath(p: string) {
    const parts = p.split(/[\\/]/);
    return parts[parts.length - 1] || p;
  }

  // 点击外部 / 视口变化关闭下拉。
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      // 菜单 teleport 到 <body>，从菜单项 closest('.dropdown') 够不到原 wrapper，故也查菜单自身标记类。
      const target = e.target as HTMLElement | null;
      if (target && (target.closest('.dropdown') || target.closest('.dropdown__menu'))) return;
      closeAllDropdowns();
    };
    const onViewportChange = () => {
      // teleport 菜单按打开时的 rect 定位；resize/scroll 后坐标过期。
      closeAllDropdowns();
    };
    document.addEventListener('click', onDocClick, true);
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);
    return () => {
      document.removeEventListener('click', onDocClick, true);
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
    };
  }, []);

  return (
    <div className="toolbar">
      {/* 品牌标识统一由左 ActivityBar 顶部的像素宠物承担，顶栏不再重复 logo/字标。 */}
      <div className="toolbar__group">
        <div className="dropdown">
          <button ref={newBtnRef} className="icon-btn" onClick={() => toggleDropdown('new')} title={t('toolbar.newFile')}>
            <Icon name="new" />
            <Icon name="chevron-down" size={10} />
          </button>
          {newOpen && createPortal(
            <div className="dropdown__menu dropdown__menu--narrow" style={floatStyle}>
              <button className="dropdown__item dropdown__item--single" onMouseDown={(e) => { e.preventDefault(); files.newFile(); setNewOpen(false); }}>
                <Icon name="new" />
                <span className="dropdown__name">{t('toolbar.newMarkdown')}</span>
                <span className="dropdown__shortcut">Ctrl+N</span>
              </button>
              <button className="dropdown__item dropdown__item--single" onMouseDown={(e) => { e.preventDefault(); files.newTextFile(); setNewOpen(false); }}>
                <Icon name="new-text" />
                <span className="dropdown__name">{t('toolbar.newPlainText')}</span>
                <span className="dropdown__shortcut">Ctrl+Alt+N</span>
              </button>
            </div>,
            document.body,
          )}
        </div>
        <div className="dropdown">
          <button ref={recentBtnRef} className="icon-btn" onClick={() => toggleDropdown('recent')} title={t('toolbar.recent')}>
            <Icon name="recent" />
            <Icon name="chevron-down" size={10} />
          </button>
          {recentOpen && createPortal(
            <div className="dropdown__menu" style={floatStyle}>
              {!workspace.recentFiles.length && <div className="dropdown__empty">{t('toolbar.noRecent')}</div>}
              {workspace.recentFiles.map((p) => (
                <button key={p} className="dropdown__item" onMouseDown={(e) => { e.preventDefault(); files.openPath(p); setRecentOpen(false); }} title={p}>
                  <span className="dropdown__name">{shortPath(p)}</span>
                  <span className="dropdown__path">{p}</span>
                </button>
              ))}
              {workspace.recentFiles.length > 0 && <div className="dropdown__sep"></div>}
              {workspace.recentFiles.length > 0 && (
                <button className="dropdown__item dropdown__item--muted" onMouseDown={(e) => { e.preventDefault(); workspace.clearRecent(); setRecentOpen(false); }}>
                  {t('toolbar.clearRecent')}
                </button>
              )}
            </div>,
            document.body,
          )}
        </div>
        <button className="icon-btn" onClick={() => files.saveActive()} title={t('toolbar.save') + ' (Ctrl+S)'}>
          <Icon name="save" />
        </button>
        <button className="icon-btn" onClick={() => files.saveActiveAs()} title={t('toolbar.saveAsTooltip')}>
          <Icon name="save-as" />
        </button>
        <div className="dropdown">
          <button ref={exportBtnRef} className="icon-btn" onClick={() => toggleDropdown('export')} title={t('toolbar.exportTooltip')}>
            <Icon name="export" />
            <Icon name="chevron-down" size={10} />
          </button>
          {exportOpen && createPortal(
            <div className="dropdown__menu" style={floatStyle}>
              <button className="dropdown__item dropdown__item--single" onMouseDown={(e) => { e.preventDefault(); exporter.exportHtml(); setExportOpen(false); }}>
                <span className="dropdown__name">{t('toolbar.exportHtml')}</span>
              </button>
              <button className="dropdown__item dropdown__item--single" onMouseDown={(e) => { e.preventDefault(); exporter.exportDocx(); setExportOpen(false); }}>
                <span className="dropdown__name">{t('toolbar.exportDocx')}</span>
              </button>
              <button className="dropdown__item dropdown__item--single" onMouseDown={(e) => { e.preventDefault(); exporter.exportPdf(); setExportOpen(false); }}>
                <span className="dropdown__name">{t('toolbar.exportPdf')}</span>
              </button>
              <button className="dropdown__item dropdown__item--single" onMouseDown={(e) => { e.preventDefault(); exporter.exportPdfPrint(); setExportOpen(false); }}>
                <span className="dropdown__name">{t('toolbar.exportPdfPrint')}</span>
              </button>
              <button className="dropdown__item dropdown__item--single" onMouseDown={(e) => { e.preventDefault(); exporter.exportImage(); setExportOpen(false); }}>
                <span className="dropdown__name">{t('toolbar.exportImage')}</span>
              </button>
              <div className="dropdown__sep"></div>
              <button className="dropdown__item dropdown__item--single" onMouseDown={(e) => { e.preventDefault(); exporter.copyAsHtml(); setExportOpen(false); }}>
                <span className="dropdown__name">{t('toolbar.copyHtml')}</span>
              </button>
              <button className="dropdown__item dropdown__item--single" onMouseDown={(e) => { e.preventDefault(); exporter.copyAsPlainText(); setExportOpen(false); }}>
                <span className="dropdown__name">{t('toolbar.copyPlain')}</span>
              </button>
              <button className="dropdown__item dropdown__item--single" onMouseDown={(e) => { e.preventDefault(); exporter.copyAsMarkdown(); setExportOpen(false); }}>
                <span className="dropdown__name">{t('toolbar.copyMarkdown')}</span>
              </button>
            </div>,
            document.body,
          )}
        </div>
      </div>

      <span className="toolbar__divider"></span>

      {isMarkdown && (
        <div className="toolbar__group">
          <div className="dropdown">
            <button ref={insertBtnRef} className="icon-btn" onClick={() => toggleDropdown('insert')} title={t('toolbar.insertTooltip')}>
              <Icon name="insert" />
              <Icon name="chevron-down" size={10} />
            </button>
            {insertOpen && createPortal(
              <div className="dropdown__menu" style={floatStyle}>
                <button className="dropdown__item dropdown__item--single" onMouseDown={(e) => { e.preventDefault(); dispatchInsert('\n```\n$|$\n```\n'); }}>
                  <span className="dropdown__name">{t('toolbar.insertCodeBlock')}</span>
                </button>
                <button className="dropdown__item dropdown__item--single" onMouseDown={(e) => { e.preventDefault(); dispatchInsert('`$|$`'); }}>
                  <span className="dropdown__name">{t('toolbar.insertInlineCode')}</span>
                </button>
                <div className="dropdown__sep"></div>
                <button className="dropdown__item dropdown__item--single" onMouseDown={(e) => { e.preventDefault(); dispatchInsert('\n$$\n$|$\n$$\n'); }}>
                  <span className="dropdown__name">{t('toolbar.insertMathBlock')}</span>
                </button>
                <button className="dropdown__item dropdown__item--single" onMouseDown={(e) => { e.preventDefault(); dispatchInsert('$$|$$'); }}>
                  <span className="dropdown__name">{t('toolbar.insertMathInline')}</span>
                </button>
                <div className="dropdown__sep"></div>
                <button className="dropdown__item dropdown__item--single" onMouseDown={(e) => { e.preventDefault(); dispatchInsert('\n| $|$ | Header |\n| --- | --- |\n| cell | cell |\n'); }}>
                  <span className="dropdown__name">{t('toolbar.insertTable')}</span>
                </button>
                <button className="dropdown__item dropdown__item--single" onMouseDown={(e) => { e.preventDefault(); dispatchInsert('\n```mermaid\ngraph TD\n  A[$|$] --> B[End]\n```\n'); }}>
                  <span className="dropdown__name">{t('toolbar.insertMermaid')}</span>
                </button>
                <div className="dropdown__sep"></div>
                <button className="dropdown__item dropdown__item--single" onMouseDown={(e) => { e.preventDefault(); dispatchInsert('[$|$](url)'); }}>
                  <span className="dropdown__name">{t('toolbar.insertLink')}</span>
                </button>
                <button className="dropdown__item dropdown__item--single" onMouseDown={(e) => { e.preventDefault(); pickAndInsertImage(); }}>
                  <span className="dropdown__name">{t('toolbar.insertImage')}</span>
                </button>
                <button className="dropdown__item dropdown__item--single" onMouseDown={(e) => { e.preventDefault(); dispatchInsert('> $|$'); }}>
                  <span className="dropdown__name">{t('toolbar.insertQuote')}</span>
                </button>
                <button className="dropdown__item dropdown__item--single" onMouseDown={(e) => { e.preventDefault(); dispatchInsert('\n---\n'); }}>
                  <span className="dropdown__name">{t('toolbar.insertDivider')}</span>
                </button>
              </div>,
              document.body,
            )}
          </div>
        </div>
      )}

      <div className="toolbar__group">
        <div className="copy-split">
          <button className="copy-split__main" onClick={() => exporter.copyAsHtml()} title={t('toolbar.copyTooltip')}>
            <Icon name="export" size={14} />
            {t('toolbar.copy')}
          </button>
          <div className="dropdown">
            <button ref={copyBtnRef} className="copy-split__arrow" onClick={() => toggleDropdown('copy')} title={t('toolbar.copyFormats')}>
              <Icon name="chevron-down" size={10} />
            </button>
            {copyOpen && createPortal(
              <div className="dropdown__menu dropdown__menu--narrow copy-dropdown" style={floatStyle}>
                <button className="dropdown__item dropdown__item--single" onMouseDown={(e) => { e.preventDefault(); exporter.copyAsHtml(); setCopyOpen(false); }}>
                  <span className="dropdown__name"><><Icon name="clipboard" size={13} /> {t('toolbar.copyHtml')}</></span>
                  <span className="dropdown__shortcut">⇧⌘C</span>
                </button>
                <button className="dropdown__item dropdown__item--single" onMouseDown={(e) => { e.preventDefault(); exporter.copyAsMarkdown(); setCopyOpen(false); }}>
                  <span className="dropdown__name"><><Icon name="new-text" size={13} /> {t('toolbar.copyMarkdown')}</></span>
                </button>
                <button className="dropdown__item dropdown__item--single" onMouseDown={(e) => { e.preventDefault(); exporter.copyAsPlainText(); setCopyOpen(false); }}>
                  <span className="dropdown__name"><><Icon name="file" size={13} /> {t('toolbar.copyPlain')}</></span>
                </button>
                <button className="dropdown__item dropdown__item--single" onMouseDown={(e) => { e.preventDefault(); exporter.copyAsImage(); setCopyOpen(false); }}>
                  <span className="dropdown__name"><><Icon name="image" size={13} /> {t('toolbar.copyImage')}</></span>
                </button>
              </div>,
              document.body,
            )}
          </div>
        </div>
      </div>

      {/* 工作区快速切换（原在文件树内，移至此处以方便触达） */}
      {workspace.currentFolder && (
        <div className="toolbar__group">
          <div className="copy-split">
            <button
              ref={wsBtnRef}
              className="copy-split__main"
              title={workspace.currentFolder}
              onClick={() => {
                closeAllDropdowns();
                positionMenuFromButton(wsBtnRef.current);
                setWsSwitcherOpen((v) => !v);
              }}
            >
              <Icon name="folder" size={14} />
              <span className="toolbar__ws-name">
                {workspace.currentFolder.split(/[\\/]/).filter(Boolean).pop() ?? workspace.currentFolder}
              </span>
            </button>
            <div className="dropdown">
              <button className="copy-split__arrow" onClick={() => {
                closeAllDropdowns();
                positionMenuFromButton(wsBtnRef.current);
                setWsSwitcherOpen((v) => !v);
              }} title={t('explorer.recentFolders')}>
                <Icon name="chevron-down" size={10} />
              </button>
              {wsSwitcherOpen && createPortal(
                <div className="dropdown__menu" style={floatStyle}>
                  <div className="dropdown__label">{t('explorer.recentFolders')}</div>
                  {workspace.recentFolders.map((f) => {
                    const parts = f.split(/[\\/]/).filter(Boolean);
                    const name = parts[parts.length - 1] ?? f;
                    const parent = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
                    return (
                      <button
                        key={f}
                        className={`dropdown__item${f === workspace.currentFolder ? ' dropdown__item--active' : ''}`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setWsSwitcherOpen(false);
                          if (f !== workspace.currentFolder) workspace.setFolder(f);
                        }}
                      >
                        <span className="dropdown__name">{name}</span>
                        <span className="dropdown__hint">{parent}</span>
                      </button>
                    );
                  })}
                  {workspace.recentFolders.length === 0 && (
                    <div className="dropdown__empty">{t('explorer.noRecentFolders')}</div>
                  )}
                  <div className="dropdown__sep" />
                  <button
                    className="dropdown__item"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setWsSwitcherOpen(false);
                      void files.openFolder();
                    }}
                  >
                    <Icon name="folder" size={14} /> {t('explorer.openFolder')}
                  </button>
                </div>,
                document.body,
              )}
            </div>
          </div>
        </div>
      )}

      <div className="toolbar__spacer"></div>

      {isMarkdown && (
        <div className="toolbar__group">
          {/* 布局（互斥）：单栏编辑 / 分栏 / 仅预览 / 阅读。 */}
          <button className={`icon-btn${settings.viewMode === 'edit' ? ' active' : ''}`} onClick={() => settings.setViewMode('edit')} title={t('toolbar.editLayout')}>
            <Icon name="view-edit" />
          </button>
          <button className={`icon-btn${settings.viewMode === 'split' ? ' active' : ''}`} onClick={() => settings.setViewMode('split')} title={t('toolbar.splitPane')}>
            <Icon name="view-split" />
          </button>
          <button className={`icon-btn${settings.viewMode === 'preview' ? ' active' : ''}`} onClick={() => settings.setViewMode('preview')} title={t('toolbar.previewOnly')}>
            <Icon name="view-preview" />
          </button>
          <button className={`icon-btn${settings.viewMode === 'reading' ? ' active' : ''}`} onClick={() => settings.setViewMode('reading')} title={t('toolbar.readingMode')}>
            <Icon name="view-reading" />
          </button>
          {/* 编辑器渲染（与布局正交）：源码 ⇄ 实时编辑，仅在有编辑器的布局（edit / split）下可切。 */}
          {(settings.viewMode === 'edit' || settings.viewMode === 'split') && (
            <>
              <span className="toolbar__divider"></span>
              <button
                className={`icon-btn${settings.editorRender === 'live' ? ' active' : ''}`}
                onClick={() => settings.toggleEditorRender()}
                title={settings.editorRender === 'live' ? t('toolbar.liveEditActive') : t('toolbar.sourceMode')}
              >
                <Icon name={settings.editorRender === 'live' ? 'live' : 'source'} />
              </button>
            </>
          )}
          {(settings.viewMode === 'split' || settings.viewMode === 'preview') && (
            <button className={`icon-btn${settings.previewFitWidth ? ' active' : ''}`} onClick={() => settings.togglePreviewFitWidth()} title={t('toolbar.fitWidthTooltip')}>
              <Icon name="fit-width" />
            </button>
          )}
        </div>
      )}

      {isMarkdown && <span className="toolbar__divider"></span>}

      <div className="toolbar__group">
        <div className="dropdown focus-with-pomo">
          <button
            className={`icon-btn${settings.focusMode ? ' active' : ''}`}
            disabled={settings.viewMode === 'preview'}
            onClick={() => settings.toggleFocusMode()}
            title={t('toolbar.focusModeTooltip')}
          >
            <Icon name="focus" />
          </button>
          {settings.pomodoroShowControls && (
            <button
              className="icon-btn pomo-chevron"
              onClick={togglePomo}
              title={t('pomodoro.openMenu')}
              aria-haspopup="dialog"
              aria-expanded={pomoOpen}
            >
              <Icon name="chevron-down" size={10} />
            </button>
          )}
          <PomodoroPopover open={pomoOpen} onClose={() => setPomoOpen(false)} />
        </div>
        <button
          className={`icon-btn${settings.typewriterMode ? ' active' : ''}`}
          disabled={settings.viewMode === 'preview'}
          onClick={() => settings.toggleTypewriterMode()}
          title={t('toolbar.typewriterTooltip')}
        >
          <Icon name="typewriter" />
        </button>
        <button
          className={`icon-btn${settings.spellCheck ? ' active' : ''}`}
          disabled={settings.viewMode === 'preview'}
          onClick={() => settings.toggleSpellCheck()}
          title={t('toolbar.spellCheckTooltip')}
        >
          <Icon name="spellcheck" />
        </button>
        <button
          className="icon-btn cjk-proof-btn"
          disabled={settings.viewMode === 'preview'}
          onClick={onOpenCjkProofread}
          title={t('toolbar.cjkProofreadTooltip')}
        >
          <span className="cjk-proof-glyph">中</span>
        </button>
        <span className="toolbar__divider"></span>
        <button className="icon-btn" onClick={() => onOpenPalette()} title={t('toolbar.paletteTooltip')}>
          <Icon name="palette" />
        </button>
        <button className="icon-btn" onClick={() => onOpenHelp()} title={t('toolbar.helpTooltip')}>
          <Icon name="help" />
        </button>
        <button
          className="icon-btn"
          onClick={() => settings.toggleTheme()}
          title={settings.theme === 'dark' ? t('toolbar.lightMode') : t('toolbar.darkMode')}
        >
          <Icon name={settings.theme === 'dark' ? 'theme-light' : 'theme-dark'} />
        </button>
      </div>
    </div>
  );
}

export default Toolbar;
