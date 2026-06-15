/**
 * CitationPickerSettings.tsx — F5 引用设置（从 CitationPickerSettings.vue 迁移）。
 * 工作区 bibliography（.bib/.csl-json）与 CSL 样式两个文件选择器，嵌入 SettingsPanel。
 * 容器/按钮样式来自 SettingsPanel 的全局 settings 样式。
 */
import { open as openFileDialog } from '@tauri-apps/plugin-dialog';
import { useSettingsStore } from '../stores/settings';
import { useToastsStore } from '../stores/toasts';
import { useI18n } from '../i18n';
import { usePandocExport } from '../composables/usePandocExport';

export function CitationPickerSettings() {
  const { t } = useI18n();
  const { invalidateCitationsCache } = usePandocExport();
  const workspaceBibliography = useSettingsStore((s) => s.workspaceBibliography);
  const workspaceCsl = useSettingsStore((s) => s.workspaceCsl);

  async function pickBibliography() {
    const path = await openFileDialog({
      multiple: false,
      filters: [{ name: 'BibTeX / CSL-JSON', extensions: ['bib', 'json', 'cslj', 'csl-json'] }],
    });
    if (path && typeof path === 'string') {
      useSettingsStore.getState().setWorkspaceBibliography(path);
      invalidateCitationsCache();
      useToastsStore.getState().success(t('settings.bibliographyPicked'));
    }
  }

  async function pickCsl() {
    const path = await openFileDialog({ multiple: false, filters: [{ name: 'CSL Style', extensions: ['csl', 'xml'] }] });
    if (path && typeof path === 'string') {
      useSettingsStore.getState().setWorkspaceCsl(path);
      useToastsStore.getState().success(t('settings.cslPicked'));
    }
  }

  function clearBibliography() {
    useSettingsStore.getState().setWorkspaceBibliography('');
    invalidateCitationsCache();
  }
  function clearCsl() {
    useSettingsStore.getState().setWorkspaceCsl('');
  }

  return (
    <>
      <section>
        <label>{t('settings.bibliography')}</label>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <button onClick={pickBibliography}>{t('settings.pickBibliography')}</button>
          {workspaceBibliography && <button onClick={clearBibliography}>{t('settings.clear')}</button>}
        </div>
        {workspaceBibliography && (
          <div style={{ fontSize: 11, color: 'var(--text-faint)', wordBreak: 'break-all', marginTop: 4 }}>
            {workspaceBibliography}
          </div>
        )}
        <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4, lineHeight: 1.5 }}>
          {t('settings.bibliographyHint')}
        </div>
      </section>
      <section>
        <label>{t('settings.csl')}</label>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <button onClick={pickCsl}>{t('settings.pickCsl')}</button>
          {workspaceCsl && <button onClick={clearCsl}>{t('settings.clear')}</button>}
        </div>
        {workspaceCsl && (
          <div style={{ fontSize: 11, color: 'var(--text-faint)', wordBreak: 'break-all', marginTop: 4 }}>{workspaceCsl}</div>
        )}
        <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4, lineHeight: 1.5 }}>{t('settings.cslHint')}</div>
      </section>
    </>
  );
}

export default CitationPickerSettings;
