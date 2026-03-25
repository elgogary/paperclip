import { api } from "./client";

export type ScheduledJobType = "knowledge_sync" | "webhook" | "agent_run" | "dream" | "memory_ingest";
export type OverlapPolicy = "skip" | "queue";
export type MissedRunPolicy = "skip" | "run_once";
export type ScheduledJobRunStatus = "running" | "success" | "failed";
export type ScheduledJobRunTrigger = "scheduler" | "manual" | "retry";

export interface ScheduledJob {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  scope: string;
  scopeTargetId: string | null;
  jobType: ScheduledJobType;
  config: Record<string, unknown>;
  cronExpression: string;
  timezone: string;
  timeoutSeconds: number | null;
  overlapPolicy: OverlapPolicy;
  missedRunPolicy: MissedRunPolicy;
  retryMax: number;
  retryDelaySeconds: number;
  onFailureNotifyInApp: boolean;
  onFailureWebhookUrl: string | null;
  onFailureWebhookSecretId: string | null;
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduledJobRun {
  id: string;
  jobId: string;
  companyId: string;
  status: ScheduledJobRunStatus;
  attempt: number;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  output: string | null;
  error: string | null;
  heartbeatRunId: string | null;
  triggeredBy: ScheduledJobRunTrigger;
  createdAt: string;
}

export interface CreateJobInput {
  name: string;
  description?: string | null;
  scope: string;
  scopeTargetId?: string | null;
  jobType: ScheduledJobType;
  config: Record<string, unknown>;
  cronExpression: string;
  timezone?: string;
  timeoutSeconds?: number | null;
  overlapPolicy?: OverlapPolicy;
  missedRunPolicy?: MissedRunPolicy;
  retryMax?: number;
  retryDelaySeconds?: number;
  onFailureNotifyInApp?: boolean;
  onFailureWebhookUrl?: string | null;
  onFailureWebhookSecretId?: string | null;
}

export type UpdateJobInput = Partial<CreateJobInput & { enabled: boolean }>;

export const scheduledJobsApi = {
  list: (companyId: string) =>
    api.get<{ jobs: ScheduledJob[] }>(`/companies/${companyId}/scheduled-jobs`),

  get: (companyId: string, jobId: string) =>
    api.get<{ job: ScheduledJob }>(`/companies/${companyId}/scheduled-jobs/${jobId}`),

  create: (companyId: string, data: CreateJobInput) =>
    api.post<{ job: ScheduledJob }>(`/companies/${companyId}/scheduled-jobs`, data),

  update: (companyId: string, jobId: string, data: UpdateJobInput) =>
    api.patch<{ job: ScheduledJob }>(`/companies/${companyId}/scheduled-jobs/${jobId}`, data),

  remove: (companyId: string, jobId: string) =>
    api.delete<{ ok: true }>(`/companies/${companyId}/scheduled-jobs/${jobId}`),

  pause: (companyId: string, jobId: string) =>
    api.post<{ job: ScheduledJob }>(`/companies/${companyId}/scheduled-jobs/${jobId}/pause`, {}),

  resume: (companyId: string, jobId: string) =>
    api.post<{ job: ScheduledJob }>(`/companies/${companyId}/scheduled-jobs/${jobId}/resume`, {}),

  runNow: (companyId: string, jobId: string) =>
    api.post<{ ok: true; message: string }>(
      `/companies/${companyId}/scheduled-jobs/${jobId}/run`,
      {},
    ),

  listRuns: (companyId: string, jobId: string, limit = 20) =>
    api.get<{ runs: ScheduledJobRun[] }>(
      `/companies/${companyId}/scheduled-jobs/${jobId}/runs?limit=${limit}`,
    ),
};
