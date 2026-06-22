/**
 * ProviderDetail —— 供应商详情右栏：标题(图标+名+启停) + 凭证表单 + 模型列表。
 */
import { aiBridge } from '@bridge/ipc';
import type { ProviderInfo } from '@shared/models';
import { Toggle } from '../../settings/kit';
import { ProviderIcon } from '../ProviderIcon';
import { providerLabel, providerDefaultApi, providerDefaultUrl } from '../provider-catalog';
import { ApiKeyCredentials } from './ApiKeyCredentials';
import { ProviderModelList } from './ProviderModelList';

export function ProviderDetail({
  provider,
  onRefresh,
}: {
  provider: ProviderInfo;
  onRefresh: () => Promise<void>;
}) {
  const defaultUrl = providerDefaultUrl(provider.id);
  const effectiveBaseUrl = provider.baseUrl ?? defaultUrl;
  const effectiveApi = provider.api ?? providerDefaultApi(provider.id);

  return (
    <div>
      <div className="pv-detail-header">
        <h3 className="pv-detail-title">
          <ProviderIcon provider={provider.id} className="pv-list-item-icon" />
          {providerLabel(provider.id, provider.label)}
        </h3>
        <Toggle on={provider.enabled} onChange={(on) => void aiBridge.setProviderConfig(provider.id, { enabled: on }).then(onRefresh)} />
      </div>

      <ApiKeyCredentials
        provider={provider}
        effectiveBaseUrl={effectiveBaseUrl}
        effectiveApi={effectiveApi}
        defaultBaseUrl={defaultUrl}
        onRefresh={onRefresh}
      />

      <ProviderModelList
        provider={provider}
        effectiveBaseUrl={effectiveBaseUrl}
        effectiveApi={effectiveApi}
        onRefresh={onRefresh}
      />
    </div>
  );
}

export default ProviderDetail;
