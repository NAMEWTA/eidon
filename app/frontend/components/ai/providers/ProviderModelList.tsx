/**
 * ProviderModelList —— 供应商详情「已添加模型」+「添加模型 / 读取模型」。
 *
 * 已添加模型 = provider.models（逐模型元数据覆盖）的键集，带能力图标 / 上下文 / 编辑·删除。
 * 「添加模型」下拉列 pi-ai 该 provider 可用模型 ∪「读取模型」(providers:fetchModels) 发现 ∪ 自定义输入。
 * 添加 = setModelMeta(空 meta)；删除 = removeModelMeta。
 */
import { useMemo, useState } from 'react';

import { aiBridge } from '@bridge/ipc';
import { useAiStore } from '../../../stores/ai';
import { useToastsStore } from '../../../stores/toasts';
import type { ProviderInfo } from '@shared/models';
import type { ModelMeta } from '@shared/contracts';
import { ModelEditPanel } from './ModelEditPanel';

const emptyMeta = (): ModelMeta => ({
  displayName: null,
  context: null,
  maxOutput: null,
  image: false,
  video: false,
  audio: false,
  reasoning: false,
});

type Cap = 'image' | 'video' | 'audio' | 'reasoning';
const CAP_PATH: Record<Cap, string> = {
  image: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
  video: '<rect x="3" y="5" width="13" height="14" rx="2"/><path d="m16 9 5-3v12l-5-3"/>',
  audio: '<path d="M4 10v4"/><path d="M8 7v10"/><path d="M12 4v16"/><path d="M16 8v8"/><path d="M20 11v2"/>',
  reasoning: '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.74V16a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-1.26A7 7 0 0 0 12 2Z"/>',
};
function CapIcon({ kind }: { kind: Cap }) {
  return (
    <span className="pv-capability-icon" title={kind}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: CAP_PATH[kind] }} />
    </span>
  );
}

function fmtCtx(n: number | null): string {
  if (!n) return '';
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`;
  return `${Math.round(n / 1000)}K`;
}

export function ProviderModelList({
  provider,
  effectiveBaseUrl,
  effectiveApi,
  onRefresh,
}: {
  provider: ProviderInfo;
  effectiveBaseUrl: string;
  effectiveApi: string;
  onRefresh: () => Promise<void>;
}) {
  const store = useAiStore();
  const toasts = useToastsStore();
  const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [custom, setCustom] = useState('');
  const [discovered, setDiscovered] = useState<string[]>([]);
  const [fetching, setFetching] = useState(false);

  const added = useMemo(() => Object.entries(provider.models), [provider.models]);
  const addedSet = useMemo(() => new Set(added.map(([id]) => id)), [added]);

  const candidates = useMemo(() => {
    const pi = store.models.filter((m) => m.provider === provider.id).map((m) => m.id);
    const all = [...new Set([...pi, ...discovered])].filter((id) => !addedSet.has(id));
    const q = search.trim().toLowerCase();
    return q ? all.filter((id) => id.toLowerCase().includes(q)) : all;
  }, [store.models, provider.id, discovered, addedSet, search]);

  async function addModel(id: string) {
    if (!id.trim() || addedSet.has(id)) return;
    await aiBridge.setModelMeta(provider.id, id.trim(), emptyMeta());
    await onRefresh();
  }
  async function removeModel(id: string) {
    await aiBridge.removeModelMeta(provider.id, id);
    await onRefresh();
  }
  async function fetchModels() {
    setFetching(true);
    try {
      const ids = await aiBridge.fetchProviderModels({ provider: provider.id, baseUrl: effectiveBaseUrl, api: effectiveApi });
      if (ids.length === 0) {
        toasts.error('未读取到模型（检查 Base URL / API Key / API 类型）');
        return;
      }
      setDiscovered(ids);
      setSearch('');
      setOpen(true);
      toasts.success(`读取到 ${ids.length} 个模型`);
    } finally {
      setFetching(false);
    }
  }

  return (
    <div>
      <div className="pv-models-title">
        模型
        {added.length > 0 && <span className="pv-models-count">{added.length}</span>}
      </div>

      {added.length > 0 && (
        <div className="pv-fav-list">
          {added.map(([id, meta]) => {
            const name = meta.displayName || id;
            return (
              <div key={id}>
                <div className="pv-fav-item">
                  <span className="pv-fav-item-name" title={String(name)}>{name}</span>
                  {name !== id && <span className="pv-fav-item-id" title={id}>{id}</span>}
                  {meta.image && <CapIcon kind="image" />}
                  {meta.video && <CapIcon kind="video" />}
                  {meta.audio && <CapIcon kind="audio" />}
                  {meta.reasoning && <CapIcon kind="reasoning" />}
                  {meta.context ? <span className="pv-model-ctx">{fmtCtx(meta.context)}</span> : null}
                  <div className="pv-fav-item-actions">
                    <button className="pv-icon-btn-sm" title="编辑" onClick={() => setEditing(editing === id ? null : id)}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                    </button>
                    <button className="pv-icon-btn-sm is-danger" title="移除" onClick={() => void removeModel(id)}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                  </div>
                </div>
                {editing === id && (
                  <ModelEditPanel provider={provider.id} modelId={id} initial={meta} onClose={() => setEditing(null)} onSaved={onRefresh} />
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="pv-models-action-row">
        <button className="pv-model-dropdown-trigger" onClick={() => setOpen((v) => !v)}>
          <span>添加模型</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
        </button>
        <button className={`pv-fetch-btn${fetching ? ' is-spinning' : ''}`} title="读取模型" onClick={() => void fetchModels()}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
          读取模型
        </button>

        {open && (
          <div className="pv-model-dropdown">
            <input className="pv-model-dropdown-search" type="text" placeholder="搜索模型…" value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
            <div className="pv-model-dropdown-list">
              {candidates.length === 0 ? (
                <div className="pv-model-dropdown-empty">{provider.configured ? '无更多模型，可在下方手动添加。' : '配置 API Key 或点「读取模型」后列出。'}</div>
              ) : (
                candidates.map((id) => (
                  <button key={id} className="pv-model-dropdown-option" onClick={() => void addModel(id)}>
                    <span className="pv-model-dropdown-option-name">{id}</span>
                  </button>
                ))
              )}
            </div>
            <div className="pv-model-dropdown-custom">
              <input type="text" placeholder="自定义模型 id…" value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { void addModel(custom); setCustom(''); } }} />
              <button className="set-btn set-btn--primary" onClick={() => { void addModel(custom); setCustom(''); }}>添加</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProviderModelList;
