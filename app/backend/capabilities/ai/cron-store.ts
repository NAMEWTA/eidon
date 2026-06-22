/**
 * backend/capabilities/ai/cron-store —— 每 Agent 定时任务 `cron-jobs.json` IO（纯 node）。
 *
 * 「何时触发」（type/schedule/nextRunAt）与「做什么」（prompt）解耦（参考 HanaAgent）。
 * nextRunAt 的纯计算在 @shared/utils（computeNextRun），本模块只做读写 + 推进。
 */
import { CronJobsFileSchema, type CronJob, type CronJobsFile } from "@shared/contracts";
import type { CronJobInput, CronJobPatch } from "@shared/models";
import { computeNextRun, createNodeId } from "@shared/utils";

import { agentCronPath, assertSafeId } from "./paths";
import { listAgentIds } from "./agent-store";
import { readJson, writeJson } from "./store";

const empty = (agentId: string): CronJobsFile => ({ version: 1, agentId, jobs: [] });

export async function readJobs(agentId: string): Promise<CronJob[]> {
  assertSafeId(agentId);
  const file = await readJson(CronJobsFileSchema, agentCronPath(agentId), empty(agentId));
  return file.jobs;
}

async function writeJobs(agentId: string, jobs: CronJob[]): Promise<void> {
  assertSafeId(agentId);
  await writeJson(CronJobsFileSchema, agentCronPath(agentId), { version: 1, agentId, jobs });
}

export async function addJob(agentId: string, input: CronJobInput): Promise<CronJob> {
  const now = new Date();
  const job: CronJob = {
    id: createNodeId(),
    label: input.label ?? "",
    type: input.type,
    schedule: input.schedule,
    prompt: input.prompt,
    enabled: true,
    nextRunAt: computeNextRun(input.type, input.schedule, now),
    lastRunAt: null,
    createdAt: now.toISOString(),
  };
  const jobs = await readJobs(agentId);
  jobs.push(job);
  await writeJobs(agentId, jobs);
  return job;
}

export async function updateJob(
  agentId: string,
  jobId: string,
  patch: CronJobPatch,
): Promise<CronJob | null> {
  const jobs = await readJobs(agentId);
  const idx = jobs.findIndex((j) => j.id === jobId);
  if (idx < 0) return null;
  const merged: CronJob = { ...jobs[idx], ...patch };
  // schedule/type/启停变化 → 重算 nextRunAt（禁用则清空）。
  merged.nextRunAt = merged.enabled
    ? computeNextRun(merged.type, merged.schedule, new Date())
    : null;
  jobs[idx] = merged;
  await writeJobs(agentId, jobs);
  return merged;
}

export async function toggleJob(agentId: string, jobId: string): Promise<CronJob | null> {
  const jobs = await readJobs(agentId);
  const idx = jobs.findIndex((j) => j.id === jobId);
  if (idx < 0) return null;
  const enabled = !jobs[idx].enabled;
  jobs[idx] = {
    ...jobs[idx],
    enabled,
    nextRunAt: enabled ? computeNextRun(jobs[idx].type, jobs[idx].schedule, new Date()) : null,
  };
  await writeJobs(agentId, jobs);
  return jobs[idx];
}

export async function removeJob(agentId: string, jobId: string): Promise<void> {
  await writeJobs(agentId, (await readJobs(agentId)).filter((j) => j.id !== jobId));
}

/** 跨所有 Agent 收集到期任务（enabled && nextRunAt ≤ now）。 */
export async function listDueJobs(now: Date): Promise<{ agentId: string; job: CronJob }[]> {
  const out: { agentId: string; job: CronJob }[] = [];
  for (const agentId of await listAgentIds()) {
    for (const job of await readJobs(agentId)) {
      if (job.enabled && job.nextRunAt && new Date(job.nextRunAt).getTime() <= now.getTime()) {
        out.push({ agentId, job });
      }
    }
  }
  return out;
}

/** 任务跑后推进：`at` 置 disabled（一次性）；`every`/`cron` 计算下次触发。 */
export async function markRun(agentId: string, jobId: string, now: Date): Promise<void> {
  const jobs = await readJobs(agentId);
  const idx = jobs.findIndex((j) => j.id === jobId);
  if (idx < 0) return;
  const job = jobs[idx];
  const lastRunAt = now.toISOString();
  jobs[idx] =
    job.type === "at"
      ? { ...job, enabled: false, lastRunAt, nextRunAt: null }
      : {
          ...job,
          lastRunAt,
          // 从「下一分钟」起算，避免同一分钟内重复触发。
          nextRunAt: computeNextRun(job.type, job.schedule, new Date(now.getTime() + 60_000)),
        };
  await writeJobs(agentId, jobs);
}
