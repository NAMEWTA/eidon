/**
 * SkillsTab —— 智能体设置「技能」子页。
 *
 * 选一个助手 → 列出已发现 skill（工作区 .agents/skills + 全局 ~/.eidon/skills）+ per-agent 启用开关。
 * 技能渲染为带区隔的卡片（名称 + 描述 + 右侧开关）。读写走 `skills:list` + `agents:get`/`agents:update`。
 */
import { useEffect, useState } from 'react';

import { aiBridge } from '@bridge/ipc';
import { useAiStore } from '../../stores/ai';
import type { AgentDetail, SkillInfo } from '@shared/models';
import { SettingsSection, Toggle, Select } from '../settings/kit';

export function SkillsTab() {
  const store = useAiStore();
  const [agentId, setAgentId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AgentDetail | null>(null);
  const [skills, setSkills] = useState<SkillInfo[]>([]);

  useEffect(() => {
    void store.init();
    void aiBridge.listSkills().then(setSkills);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!agentId && store.agents.length > 0) setAgentId(store.agents[0].id);
  }, [store.agents, agentId]);

  useEffect(() => {
    if (!agentId) return;
    let active = true;
    void aiBridge.getAgent(agentId).then((d) => {
      if (active) setDetail(d);
    });
    return () => {
      active = false;
    };
  }, [agentId]);

  const enabled = new Set(detail?.config.skills.enabled ?? []);

  async function toggle(name: string, on: boolean) {
    if (!agentId) return;
    const next = new Set(enabled);
    if (on) next.add(name);
    else next.delete(name);
    await aiBridge.updateAgent(agentId, { skills: { enabled: [...next] } });
    setDetail(await aiBridge.getAgent(agentId));
  }

  return (
    <div>
      <SettingsSection
        title="技能"
        hint="技能放在工作区 .agents/skills/ 或全局 ~/.eidon/skills/，对每个助手单独启用。"
        context={
          <Select value={agentId ?? ''} onChange={(e) => setAgentId(e.target.value || null)} style={{ width: 180 }}>
            {store.agents.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </Select>
        }
      >
        {skills.length === 0 ? (
          <div className="set-empty">
            未发现 skill。新增方式：在工作区 <code>.agents/skills/&lt;name&gt;/SKILL.md</code> 或全局 <code>~/.eidon/skills/</code> 放置 skill 目录。
          </div>
        ) : (
          <div className="skills-list">
            {skills.map((skill) => (
              <div key={skill.name} className={`skills-list-item${enabled.has(skill.name) ? ' is-on' : ''}`}>
                <div className="skills-list-info">
                  <span className="skills-list-name">{skill.name}</span>
                  <span className="skills-list-desc">{skill.description}</span>
                </div>
                <div className="skills-list-actions">
                  <Toggle on={enabled.has(skill.name)} onChange={(on) => void toggle(skill.name, on)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </SettingsSection>
    </div>
  );
}

export default SkillsTab;
