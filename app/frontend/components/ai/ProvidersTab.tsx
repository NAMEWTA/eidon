/**
 * ProvidersTab —— 智能体设置「供应商」子页（完整移植 HanaAgent，按 EIDON pi-ai 数据落地）。
 *
 * 左栏：按目录分组（OAuth / Coding Plan / API）的 provider 列表（状态点 + 品牌图标 + 名 + 已添加模型数 + 选中态）。
 * 右栏：ProviderDetail（凭证 + 模型）。底部：全局默认模型。读写走 providers:* 通道。
 */
import { useEffect, useMemo, useState } from 'react';

import { useAiStore } from '../../stores/ai';
import type { ModelRef, ProviderInfo } from '@shared/models';
import { SettingsSection, Select } from '../settings/kit';
import { ProviderIcon } from './ProviderIcon';
import { ProviderDetail } from './providers/ProviderDetail';
import {
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  providerCategory,
  providerLabel,
  type ProviderCategory,
} from './provider-catalog';

function modelKey(m: ModelRef | null): string {
  return m ? `${m.provider}/${m.id}` : '';
}

export function ProvidersTab() {
  const store = useAiStore();
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    void store.init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 默认选中第一个已配置的 provider，否则第一个。
  useEffect(() => {
    if (selected || store.providers.length === 0) return;
    const firstConfigured = store.providers.find((p) => p.configured);
    setSelected((firstConfigured ?? store.providers[0]).id);
  }, [store.providers, selected]);

  // 分组：已配置在前，再按展示名排序。
  const groups = useMemo(() => {
    const by: Record<ProviderCategory, ProviderInfo[]> = { oauth: [], coding: [], api: [] };
    for (const p of store.providers) by[providerCategory(p.id)].push(p);
    for (const cat of CATEGORY_ORDER) {
      by[cat].sort((a, b) => {
        if (a.configured !== b.configured) return a.configured ? -1 : 1;
        return providerLabel(a.id, a.label).localeCompare(providerLabel(b.id, b.label));
      });
    }
    return by;
  }, [store.providers]);

  const provider = useMemo(
    () => store.providers.find((p) => p.id === selected) ?? null,
    [store.providers, selected],
  );

  const renderItem = (p: ProviderInfo) => {
    const count = Object.keys(p.models).length;
    return (
      <button
        key={p.id}
        className={`pv-list-item${selected === p.id ? ' is-selected' : ''}${!p.configured ? ' is-dim' : ''}`}
        onClick={() => setSelected(p.id)}
      >
        <span className={`pv-status-dot${p.configured ? ' is-on' : ''}`} />
        <ProviderIcon provider={p.id} className="pv-list-item-icon" />
        <span className="pv-list-item-name">{providerLabel(p.id, p.label)}</span>
        {count > 0 && <span className="pv-list-item-count">{count}</span>}
      </button>
    );
  };

  return (
    <div>
      <div className="pv-layout">
        {/* 左栏：分组列表 */}
        <div className="pv-list">
          {CATEGORY_ORDER.map((cat) =>
            groups[cat].length === 0 ? null : (
              <div key={cat}>
                <div className="pv-list-group-label">{CATEGORY_LABEL[cat]}</div>
                {groups[cat].map(renderItem)}
              </div>
            ),
          )}
        </div>

        {/* 右栏：详情 */}
        <div className="pv-detail">
          {provider ? (
            <ProviderDetail key={provider.id} provider={provider} onRefresh={() => store.refreshConfig()} />
          ) : (
            <div className="pv-empty">选择一个供应商进行配置。</div>
          )}
        </div>
      </div>

      {/* 全局默认模型 */}
      <SettingsSection title="全局默认模型" hint="新建助手 / 助手未指定模型时回退到此模型。">
        <Select
          style={{ maxWidth: 380 }}
          value={modelKey(store.defaultModel)}
          onChange={(e) => {
            const v = e.target.value;
            const i = v.indexOf('/');
            void store.setDefaultModel(i > 0 ? { provider: v.slice(0, i), id: v.slice(i + 1) } : null);
          }}
        >
          <option value="">（未设置）</option>
          {store.models.map((m) => (
            <option key={modelKey(m)} value={modelKey(m)}>
              {providerLabel(m.provider, m.provider)} / {m.name}
            </option>
          ))}
        </Select>
      </SettingsSection>
    </div>
  );
}

export default ProvidersTab;
