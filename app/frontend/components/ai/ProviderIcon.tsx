/**
 * ProviderIcon —— 按 provider id 渲染单色品牌图标（fill: currentColor）。
 *
 * 图标 key 经 provider-catalog 映射；无图标的 provider 回退首字母 monogram（仍随 className 尺寸缩放）。
 */
import { PROVIDER_ICONS } from './provider-icons';
import { PROVIDER_CATALOG } from './provider-catalog';

export function ProviderIcon({ provider, className }: { provider: string; className?: string }) {
  const key = PROVIDER_CATALOG[provider]?.icon ?? provider;
  const icon = PROVIDER_ICONS[key];
  if (icon) {
    return (
      <svg
        className={className}
        viewBox={icon.viewBox}
        fill="currentColor"
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: icon.content }}
      />
    );
  }
  const ch = (provider.replace(/[^a-z0-9]/i, '')[0] || '?').toUpperCase();
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <text x="12" y="17" textAnchor="middle" fontSize="14" fontWeight="600" fill="currentColor">{ch}</text>
    </svg>
  );
}

export default ProviderIcon;
