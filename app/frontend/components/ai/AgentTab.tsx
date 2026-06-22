/**
 * AgentTab —— 智能体设置「助手」子页（P5）。
 *
 * 顶部助手卡片行（选择/新建/删除/设为主）+ 富编辑器：
 *   身份简介(identity) · 意识(ishiki) · 经验(experience+开关) · 置顶记忆(pinned) · 工具 · 技能 · 行为 · 定时。
 * 文本经「保存」按钮一次性提交；开关/下拉即时保存。读写走现有 `agents:get`/`agents:update` 通道。
 */
import { useEffect, useState } from 'react';

import { aiBridge } from '@bridge/ipc';
import { useAiStore } from '../../stores/ai';
import { useToastsStore } from '../../stores/toasts';
import type {
  AgentDetail,
  AgentVisibility,
  ModelRef,
  SkillInfo,
  ThinkingLevel,
  ToolInfo,
  UpdateAgentPatch,
} from '@shared/models';
import { AgentCron } from './AgentCron';
import { SettingsSection, SettingsRow, Toggle, Select, TextInput, Textarea } from '../settings/kit';

const THINKING_LEVELS: ThinkingLevel[] = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh'];

function modelKey(m: ModelRef | null): string {
  return m ? `${m.provider}/${m.id}` : '';
}
function parseModel(v: string): ModelRef | null {
  if (!v) return null;
  const i = v.indexOf('/');
  return i > 0 ? { provider: v.slice(0, i), id: v.slice(i + 1) } : null;
}

export function AgentTab() {
  const store = useAiStore();
  const toasts = useToastsStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AgentDetail | null>(null);
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [identity, setIdentity] = useState('');
  const [ishiki, setIshiki] = useState('');
  const [experience, setExperience] = useState('');
  const [pinned, setPinned] = useState('');

  useEffect(() => {
    void store.init();
    void aiBridge.listTools().then(setTools);
    void aiBridge.listSkills().then(setSkills);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedId && store.agents.length > 0) setSelectedId(store.agents[0].id);
  }, [store.agents, selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let active = true;
    void aiBridge.getAgent(selectedId).then((d) => {
      if (!active || !d) return;
      setDetail(d);
      setName(d.config.name);
      setIdentity(d.persona);
      setIshiki(d.ishiki);
      setExperience(d.experience);
      setPinned(d.pinned);
    });
    return () => {
      active = false;
    };
  }, [selectedId]);

  async function reloadDetail() {
    if (!selectedId) return;
    const d = await aiBridge.getAgent(selectedId);
    if (d) setDetail(d);
    await store.refreshAgents();
  }

  async function patch(p: UpdateAgentPatch) {
    if (!selectedId) return;
    await aiBridge.updateAgent(selectedId, p);
    await reloadDetail();
  }

  async function saveText() {
    if (!selectedId) return;
    setBusy(true);
    try {
      await aiBridge.updateAgent(selectedId, {
        name: name.trim() || undefined,
        persona: identity,
        ishiki,
        experienceText: experience,
        pinned,
      });
      await reloadDetail();
      toasts.success('已保存');
    } catch (err) {
      toasts.error('保存失败：' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  }

  async function createAgent() {
    const summary = await aiBridge.createAgent({ name: '新助手' });
    await store.refreshAgents();
    setSelectedId(summary.id);
  }

  async function removeAgent(id: string) {
    if (store.agents.length <= 1) {
      toasts.error('至少保留一个助手');
      return;
    }
    await aiBridge.deleteAgent(id);
    if (store.activeAgentId === id) store.setActiveAgent(null);
    await store.refreshAgents();
    setSelectedId(store.agents.find((a) => a.id !== id)?.id ?? null);
  }

  function pickAvatar() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => void patch({ avatar: String(reader.result) });
      reader.readAsDataURL(file);
    };
    input.click();
  }

  const cfg = detail?.config;
  const disabledTools = new Set(cfg?.tools.disabled ?? []);
  const enabledSkills = new Set(cfg?.skills.enabled ?? []);

  return (
    <div>
      {/* 助手卡片行 */}
      <div className="agent-cardstack">
        {store.agents.map((a) => (
          <button key={a.id} className={`agent-card${selectedId === a.id ? ' is-selected' : ''}`} onClick={() => setSelectedId(a.id)} title={a.name}>
            <div className="agent-card__avatar">
              {a.avatar ? <img src={a.avatar} alt="" /> : a.name.slice(0, 1)}
            </div>
            <span className="agent-card__name">{a.name}</span>
          </button>
        ))}
        <button className="agent-card agent-card--add" onClick={() => void createAgent()} title="新建助手">
          <div className="agent-card__avatar" style={{ background: 'transparent', fontSize: 22 }}>＋</div>
          <span className="agent-card__name">新建</span>
        </button>
      </div>

      {!cfg ? (
        <div className="set-empty">选择或新建一个助手开始配置。</div>
      ) : (
        <>
          {/* 基本 */}
          <SettingsSection title="基本">
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <button onClick={pickAvatar} title="更换头像" className="agent-card__avatar" style={{ width: 56, height: 56, flexShrink: 0, cursor: 'pointer', border: '1px solid var(--border)' }}>
                {cfg.avatar ? <img src={cfg.avatar} alt="" /> : <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>头像</span>}
              </button>
              <div style={{ flex: 1 }}>
                <div className="pv-cred-row"><span className="pv-cred-label">名称</span><div className="pv-cred-field"><TextInput value={name} onChange={(e) => setName(e.target.value)} /></div></div>
                <div className="pv-cred-row"><span className="pv-cred-label">默认模型</span><div className="pv-cred-field">
                  <Select value={modelKey(cfg.model)} onChange={(e) => void patch({ model: parseModel(e.target.value) })}>
                    <option value="">（继承全局默认）</option>
                    {store.models.map((m) => (<option key={modelKey(m)} value={modelKey(m)}>{m.provider} / {m.name}</option>))}
                  </Select>
                </div></div>
              </div>
            </div>
          </SettingsSection>

          {/* 身份简介 + 意识 */}
          <SettingsSection title="关于 Ta" hint="身份简介=一句话画像（也进团队名册）；意识=详细人格/语气/行为，是系统提示主体。支持 {{agentName}} / {{userName}} 占位。">
            <label className="pv-cred-label" style={{ width: 'auto', display: 'block', margin: '0 0 4px' }}>身份简介（identity）</label>
            <Textarea value={identity} onChange={(e) => setIdentity(e.target.value)} style={{ minHeight: 60 }} />
            <label className="pv-cred-label" style={{ width: 'auto', display: 'block', margin: '10px 0 4px' }}>意识（ishiki）</label>
            <Textarea value={ishiki} onChange={(e) => setIshiki(e.target.value)} style={{ minHeight: 180 }} />
          </SettingsSection>

          {/* 经验 */}
          <SettingsSection
            title="经验"
            hint="开启后助手会参考下列经验；经验可能污染上下文，明确需要时再开。格式：# 类目 + 编号条目。"
            context={<Toggle on={cfg.experience.enabled} onChange={(on) => void patch({ experienceEnabled: on })} />}
          >
            <Textarea value={experience} onChange={(e) => setExperience(e.target.value)} placeholder={'# 写作\n1. 先列提纲再展开'} style={{ minHeight: 100, opacity: cfg.experience.enabled ? 1 : 0.5 }} />
          </SettingsSection>

          {/* 置顶记忆 */}
          <SettingsSection title="置顶记忆" hint="直接注入上下文、永不衰减。每行一条，建议 markdown 列表。">
            <Textarea value={pinned} onChange={(e) => setPinned(e.target.value)} placeholder={'- 我的生日是 1 月 1 日'} style={{ minHeight: 80 }} />
          </SettingsSection>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 22 }}>
            <button className="set-btn set-btn--primary" disabled={busy} onClick={() => void saveText()}>
              {busy ? '保存中…' : '保存身份/意识/经验/置顶'}
            </button>
          </div>

          {/* 工具 */}
          <SettingsSection title="工具" hint="本助手可用的内置工具（全局禁用的不会出现）。">
            <div className="skills-list">
              {tools.map((tool) => {
                const on = tool.enabled && !disabledTools.has(tool.name);
                return (
                  <div key={tool.name} className={`skills-list-item${on ? ' is-on' : ''}`}>
                    <div className="skills-list-info">
                      <span className="skills-list-name"><code>{tool.name}</code></span>
                      <span className="skills-list-desc">{tool.description}</span>
                    </div>
                    <div className="skills-list-actions">
                      <Toggle on={on} disabled={!tool.enabled} onChange={(next) => {
                        const set = new Set(disabledTools);
                        if (next) set.delete(tool.name); else set.add(tool.name);
                        void patch({ tools: { enabled: cfg.tools.enabled, disabled: [...set] } });
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </SettingsSection>

          {/* 技能 */}
          <SettingsSection title="技能" hint="本助手启用的 skill（来自工作区 .agents/skills 与全局 ~/.eidon/skills）。">
            {skills.length === 0 ? (
              <div className="set-empty">未发现 skill。</div>
            ) : (
              <div className="skills-list">
                {skills.map((skill) => (
                  <div key={skill.name} className={`skills-list-item${enabledSkills.has(skill.name) ? ' is-on' : ''}`}>
                    <div className="skills-list-info">
                      <span className="skills-list-name">{skill.name}</span>
                      <span className="skills-list-desc">{skill.description}</span>
                    </div>
                    <div className="skills-list-actions">
                      <Toggle on={enabledSkills.has(skill.name)} onChange={(on) => {
                        const set = new Set(enabledSkills);
                        if (on) set.add(skill.name); else set.delete(skill.name);
                        void patch({ skills: { enabled: [...set] } });
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SettingsSection>

          {/* 行为 */}
          <SettingsSection title="行为">
            <SettingsRow
              label="推理强度"
              control={
                <Select value={cfg.params.thinkingLevel} onChange={(e) => void patch({ thinkingLevel: e.target.value as ThinkingLevel })} style={{ width: 120 }}>
                  {THINKING_LEVELS.map((l) => (<option key={l} value={l}>{l}</option>))}
                </Select>
              }
            />
            <SettingsRow label="可被其他 Agent 发现" hint="进入团队名册，可被 @agent 协作。" control={<Toggle on={cfg.visibility === 'public'} onChange={(on) => void patch({ visibility: (on ? 'public' : 'private') as AgentVisibility })} />} />
            <SettingsRow label="允许被激活为子 Agent" hint="仅在「可被发现」开启时生效。" control={<Toggle on={cfg.activatableByAgents} onChange={(on) => void patch({ activatableByAgents: on })} />} />
            <SettingsRow label="参与群聊频道" control={<Toggle on={cfg.channelsEnabled} onChange={(on) => void patch({ channelsEnabled: on })} />} />
          </SettingsSection>

          {/* 定时任务 */}
          <SettingsSection title="定时任务">
            <AgentCron agentId={cfg.id} />
          </SettingsSection>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="set-btn set-btn--danger" onClick={() => void removeAgent(cfg.id)}>删除此助手</button>
          </div>
        </>
      )}
    </div>
  );
}

export default AgentTab;
