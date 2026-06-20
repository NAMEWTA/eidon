/**
 * CloudFolderBanner.tsx — 云文件夹横幅。
 * 当前工作区在 iCloud/Dropbox/OneDrive/Google Drive 时显示；无工作区或非云盘自隐藏。
 */
import { useCloudSyncStore } from '../../stores/cloudSync';
import { useI18n } from '../../i18n';

const PROVIDER_ICON: Record<string, string> = {
  icloud: '☁️',
  dropbox: '📦',
  onedrive: '🪟',
  google_drive: '🅖',
  none: '',
};

export function CloudFolderBanner() {
  const { t } = useI18n();
  const cloud = useCloudSyncStore((s) => s.cloud);
  const siblings = useCloudSyncStore((s) => s.siblings);
  if (cloud.provider === 'none') return null;
  return (
    <section className="cfb">
      <div className="cfb__row">
        <span className="cfb__icon" aria-hidden="true">{PROVIDER_ICON[cloud.provider]}</span>
        <div className="cfb__copy">
          <strong>{t('cloudSync.detectedTitle', { label: cloud.label })}</strong>
          <p>{t('cloudSync.detectedHint')}</p>
          {siblings.length > 0 && (
            <p className="cfb__siblings">{t('cloudSync.siblingCount', { n: String(siblings.length) })}</p>
          )}
        </div>
      </div>
    </section>
  );
}

export default CloudFolderBanner;
