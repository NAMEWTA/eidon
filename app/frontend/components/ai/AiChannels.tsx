/**
 * AiChannels —— 智能体设置「助手」子页内的群聊频道管理（多 Agent 协作）。
 *
 * 频道 = 一组成员 Agent。在 AI 面板顶部下拉选中频道后，发言会广播给成员，各自依次作答。
 */
import { useEffect, useState } from 'react';

import { aiBridge } from '@bridge/ipc';
import { useAiStore } from '../../stores/ai';
import { SettingsSection, TextInput } from '../settings/kit';

export function AiChannels() {
  const store = useAiStore();
  const [name, setName] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    void store.init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleMember(id: string) {
    setMembers((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
  }

  async function create() {
    if (!name.trim() || members.length === 0) return;
    await aiBridge.createChannel(name.trim(), members);
    setName('');
    setMembers([]);
    setOpen(false);
    await store.refreshChannels();
  }

  async function remove(id: string) {
    await aiBridge.deleteChannel(id);
    if (store.activeChannelId === id) store.setActiveChannel(null);
    await store.refreshChannels();
  }

  const nameOf = (id: string) => store.agents.find((a) => a.id === id)?.name ?? id;

  return (
    <SettingsSection
      title="群聊频道"
      hint="频道里的成员会依次对群聊消息作答。"
      context={<button className="set-btn" onClick={() => setOpen((v) => !v)}>＋ 新建频道</button>}
    >
      <div className="skills-list">
        {store.channels.length === 0 && <div className="set-empty">暂无频道。</div>}
        {store.channels.map((c) => (
          <div key={c.id} className="skills-list-item">
            <div className="skills-list-info">
              <span className="skills-list-name">＃{c.name}</span>
              <span className="skills-list-desc">{c.members.map(nameOf).join('、') || '（无成员）'}</span>
            </div>
            <div className="skills-list-actions">
              <button className="set-btn set-btn--danger" onClick={() => void remove(c.id)}>删除</button>
            </div>
          </div>
        ))}
      </div>

      {open && (
        <div className="set-card" style={{ marginTop: 12 }}>
          <TextInput value={name} placeholder="频道名" onChange={(e) => setName(e.target.value)} style={{ marginBottom: 10 }} />
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>成员（按勾选顺序发言）</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
            {store.agents.length === 0 && <span className="set-empty">请先创建助手。</span>}
            {store.agents.map((a) => (
              <label key={a.id} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
                <input type="checkbox" checked={members.includes(a.id)} onChange={() => toggleMember(a.id)} />
                {a.name}
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="set-btn" onClick={() => setOpen(false)}>取消</button>
            <button className="set-btn set-btn--primary" disabled={!name.trim() || members.length === 0} onClick={() => void create()}>创建</button>
          </div>
        </div>
      )}
    </SettingsSection>
  );
}

export default AiChannels;
