/**
 * ModelEditPanel —— 逐模型元数据覆盖编辑（展示名/上下文/最大输出/能力开关）。
 * 内联展开在已添加模型行下；保存走 `providers:setModelMeta`。
 */
import { useState } from 'react';

import { aiBridge } from '@bridge/ipc';
import type { ModelMeta } from '@shared/contracts';
import { TextInput } from '../../settings/kit';

const CAPS = ['image', 'video', 'audio', 'reasoning'] as const;

export function ModelEditPanel({
  provider,
  modelId,
  initial,
  onClose,
  onSaved,
}: {
  provider: string;
  modelId: string;
  initial: ModelMeta;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [meta, setMeta] = useState<ModelMeta>(initial);

  async function save() {
    await aiBridge.setModelMeta(provider, modelId, meta);
    onSaved();
    onClose();
  }

  return (
    <div className="pv-model-edit">
      <label className="pv-cred-label" style={{ width: 'auto', display: 'block', marginBottom: 4 }}>显示名</label>
      <TextInput value={meta.displayName ?? ''} placeholder={modelId} onChange={(e) => setMeta((x) => ({ ...x, displayName: e.target.value || null }))} />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <TextInput type="number" placeholder="上下文长度" value={meta.context ?? ''} onChange={(e) => setMeta((x) => ({ ...x, context: e.target.value ? parseInt(e.target.value) : null }))} />
        <TextInput type="number" placeholder="最大输出" value={meta.maxOutput ?? ''} onChange={(e) => setMeta((x) => ({ ...x, maxOutput: e.target.value ? parseInt(e.target.value) : null }))} />
      </div>
      <div className="pv-model-edit-caps">
        {CAPS.map((cap) => (
          <label key={cap}>
            <input type="checkbox" checked={meta[cap]} onChange={(e) => setMeta((x) => ({ ...x, [cap]: e.target.checked }))} />
            {cap}
          </label>
        ))}
      </div>
      <div className="pv-model-edit-actions">
        <button className="set-btn" onClick={onClose}>取消</button>
        <button className="set-btn set-btn--primary" onClick={() => void save()}>保存</button>
      </div>
    </div>
  );
}

export default ModelEditPanel;
