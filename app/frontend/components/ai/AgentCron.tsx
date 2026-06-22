/**
 * AgentCron —— 单个 Agent 的定时任务管理（嵌在「定时」子页内，按选中的 agent 渲染）。
 *
 * 「何时」= type(at/every/cron) + schedule；「做什么」= prompt。到期由 main 进程 60s 调度器触发，
 * 用该 Agent 跑一个后台会话执行 prompt（托盘常驻使关窗后仍生效）。
 */
import { useEffect, useState } from 'react';

import { aiBridge } from '@bridge/ipc';
import type { CronJob, CronJobType } from '@shared/models';
import { Toggle, Select, TextInput } from '../settings/kit';

const SCHEDULE_HINT: Record<CronJobType, string> = {
  at: '选择日期时间（一次性）',
  every: '间隔分钟数，如 30',
  cron: '5 段表达式，如 0 9 * * 1-5',
};

function describe(job: CronJob): string {
  if (job.type === 'at') return `一次 @ ${new Date(job.schedule).toLocaleString()}`;
  if (job.type === 'every') return `每 ${job.schedule} 分钟`;
  return `cron: ${job.schedule}`;
}

export function AgentCron({ agentId }: { agentId: string }) {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [type, setType] = useState<CronJobType>('every');
  const [schedule, setSchedule] = useState('');
  const [prompt, setPrompt] = useState('');
  const [label, setLabel] = useState('');

  async function reload() {
    setJobs(await aiBridge.listCron(agentId));
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  async function add() {
    if (!schedule.trim() || !prompt.trim()) return;
    const normalized = type === 'at' ? new Date(schedule).toISOString() : schedule.trim();
    await aiBridge.addCron(agentId, { type, schedule: normalized, prompt: prompt.trim(), label: label.trim() });
    setSchedule('');
    setPrompt('');
    setLabel('');
    await reload();
  }

  return (
    <div>
      <div className="skills-list" style={{ marginBottom: 12 }}>
        {jobs.length === 0 && <div className="set-empty">暂无定时任务。</div>}
        {jobs.map((job) => (
          <div key={job.id} className={`skills-list-item${job.enabled ? ' is-on' : ''}`}>
            <Toggle on={job.enabled} onChange={() => void aiBridge.toggleCron(agentId, job.id).then(reload)} />
            <div className="skills-list-info">
              <span className="skills-list-name">{job.label || job.prompt}</span>
              <span className="skills-list-desc">{describe(job)}{job.label ? ` · ${job.prompt}` : ''}</span>
            </div>
            <div className="skills-list-actions">
              <button className="set-btn set-btn--danger" onClick={() => void aiBridge.removeCron(agentId, job.id).then(reload)}>删除</button>
            </div>
          </div>
        ))}
      </div>

      <div className="set-card">
        <div className="pv-cred-row">
          <span className="pv-cred-label">周期</span>
          <div className="pv-cred-field" style={{ gap: 6 }}>
            <Select value={type} onChange={(e) => { setType(e.target.value as CronJobType); setSchedule(''); }} style={{ width: 130 }}>
              <option value="at">一次性</option>
              <option value="every">周期（分钟）</option>
              <option value="cron">cron 表达式</option>
            </Select>
            <TextInput
              type={type === 'at' ? 'datetime-local' : 'text'}
              value={schedule}
              placeholder={SCHEDULE_HINT[type]}
              onChange={(e) => setSchedule(e.target.value)}
            />
          </div>
        </div>
        <div className="pv-cred-row">
          <span className="pv-cred-label">标签</span>
          <div className="pv-cred-field"><TextInput value={label} placeholder="可选，便于识别" onChange={(e) => setLabel(e.target.value)} /></div>
        </div>
        <div className="pv-cred-row">
          <span className="pv-cred-label">做什么</span>
          <div className="pv-cred-field">
            <TextInput
              value={prompt}
              placeholder="到点要这个助手做什么…"
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void add(); }}
            />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
          <button className="set-btn set-btn--primary" disabled={!schedule.trim() || !prompt.trim()} onClick={() => void add()}>添加任务</button>
        </div>
      </div>
    </div>
  );
}

export default AgentCron;
