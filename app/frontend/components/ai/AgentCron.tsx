/**
 * AgentCron —— 单个 Agent 的定时任务管理（P3，嵌在 Agent 编辑器内）。
 *
 * 「何时」= type(at/every/cron) + schedule；「做什么」= prompt。到期由 main 进程 60s 调度器触发，
 * 用该 Agent 跑一个后台会话执行 prompt（托盘常驻使关窗后仍生效）。
 */
import { useEffect, useState } from 'react';

import { aiBridge } from '@bridge/ipc';
import type { CronJob, CronJobType } from '@shared/models';

const inputStyle: React.CSSProperties = {
  padding: '5px 7px',
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text)',
  borderRadius: 4,
  font: 'inherit',
  fontSize: 12,
};

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
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px dashed var(--border)' }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>定时任务</label>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
        {jobs.length === 0 && <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>暂无定时任务。</div>}
        {jobs.map((job) => (
          <div key={job.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <input
              type="checkbox"
              checked={job.enabled}
              onChange={() => void aiBridge.toggleCron(agentId, job.id).then(reload)}
            />
            <span style={{ minWidth: 130, color: 'var(--text-faint)' }}>{describe(job)}</span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {job.label || job.prompt}
            </span>
            <button className="btn" onClick={() => void aiBridge.removeCron(agentId, job.id).then(reload)}>删除</button>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
        <select style={inputStyle} value={type} onChange={(e) => { setType(e.target.value as CronJobType); setSchedule(''); }}>
          <option value="at">一次性</option>
          <option value="every">周期（分钟）</option>
          <option value="cron">cron 表达式</option>
        </select>
        <input
          style={{ ...inputStyle, flex: 1, minWidth: 150 }}
          type={type === 'at' ? 'datetime-local' : 'text'}
          value={schedule}
          placeholder={SCHEDULE_HINT[type]}
          onChange={(e) => setSchedule(e.target.value)}
        />
        <input
          style={{ ...inputStyle, width: 110 }}
          value={label}
          placeholder="标签（可选）"
          onChange={(e) => setLabel(e.target.value)}
        />
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          style={{ ...inputStyle, flex: 1 }}
          value={prompt}
          placeholder="到点要这个 Agent 做什么…"
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void add(); }}
        />
        <button className="btn" disabled={!schedule.trim() || !prompt.trim()} onClick={() => void add()}>
          添加任务
        </button>
      </div>
    </div>
  );
}

export default AgentCron;
