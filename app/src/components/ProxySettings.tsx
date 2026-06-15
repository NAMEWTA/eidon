/**
 * ProxySettings.tsx — 网络代理设置（从 ProxySettings.vue 迁移）。
 * 全局 ~/.eidon-sync/proxy，影响 libgit2 push/pull。挂载读取，保存/清除 toast。
 */
import { useEffect, useState } from 'react';
import { useGithubSyncStore } from '../stores/githubSync';
import { useToastsStore } from '../stores/toasts';
import { useI18n } from '../i18n';

export function ProxySettings() {
  const { t } = useI18n();
  const [proxyUrl, setProxyUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    useGithubSyncStore
      .getState()
      .getProxy()
      .then((v) => setProxyUrl(v))
      .catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    try {
      await useGithubSyncStore.getState().setProxy(proxyUrl);
      useToastsStore.getState().success(proxyUrl.trim() ? t('githubSync.proxySavedToast') : t('githubSync.proxyClearedToast'));
    } catch (e) {
      useToastsStore.getState().error(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="proxy">
      <h3 className="proxy__heading">{t('githubSync.proxyTitle')}</h3>
      <div className="proxy__row">
        <input
          value={proxyUrl}
          onChange={(e) => setProxyUrl(e.target.value)}
          type="text"
          className="proxy__input"
          placeholder={t('githubSync.proxyPlaceholder')}
          spellCheck={false}
        />
        <button className="proxy__btn" disabled={saving} onClick={save}>
          {saving ? t('githubSync.proxySaving') : t('githubSync.proxySaveBtn')}
        </button>
      </div>
      <p className="proxy__hint">{t('githubSync.proxyHint')}</p>
    </section>
  );
}

export default ProxySettings;
