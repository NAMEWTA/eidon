/**
 * CronTab —— 智能体设置「定时」子页。
 *
 * 顶部选「哪个助手」去执行，下面管理该助手的定时任务（周期/时间 + 做什么）。
 * 定时任务是 per-agent 的（cron:* 通道按 agentId）。
 */
import { useEffect, useState } from 'react';

import { useAiStore } from '../../stores/ai';
import { SettingsSection, Select } from '../settings/kit';
import { AgentCron } from './AgentCron';

export function CronTab() {
  const store = useAiStore();
  const [agentId, setAgentId] = useState<string | null>(null);

  useEffect(() => {
    void store.init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!agentId && store.agents.length > 0) setAgentId(store.agents[0].id);
  }, [store.agents, agentId]);

  return (
    <div>
      <SettingsSection
        title="定时任务"
        hint="到点由所选助手用其人格/模型跑一个后台会话执行指令。需保持应用在托盘常驻才能持续触发。"
        context={
          <Select value={agentId ?? ''} onChange={(e) => setAgentId(e.target.value || null)} style={{ width: 180 }}>
            {store.agents.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </Select>
        }
      >
        {agentId ? <AgentCron agentId={agentId} /> : <div className="set-empty">请先创建一个助手。</div>}
      </SettingsSection>
    </div>
  );
}

export default CronTab;
