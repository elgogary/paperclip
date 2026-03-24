import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agentWakeupRequests, heartbeatRuns } from "@paperclipai/db";
import type { ScheduledJob } from "./scheduled-jobs.js";

// SSRF guard — rejects private/loopback addresses to prevent internal network probing
export function isPrivateUrl(raw: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return true; // unparseable = treat as unsafe
  }
  // URL.hostname includes brackets for IPv6: "[::1]"
  const host = parsed.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]") return true;
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 0) return true;
  }
  return false;
}

// Default timeouts by job type (seconds)
const DEFAULT_TIMEOUTS: Record<string, number> = {
  webhook: 5 * 60,
  knowledge_sync: 15 * 60,
  agent_run: 60 * 60,
};

export function getTimeoutSeconds(job: ScheduledJob): number {
  return job.timeoutSeconds ?? DEFAULT_TIMEOUTS[job.jobType] ?? 15 * 60;
}

// ── Knowledge Sync Executor ──────────────────────────────────────────────────
export async function executeKnowledgeSync(
  job: ScheduledJob,
  brainApiUrl: string,
  brainApiKey: string,
): Promise<{ output: string; error?: string }> {
  const config = job.config as Record<string, unknown>;
  const sourceId = config.source_id as string | undefined;
  if (!sourceId) return { output: "", error: "Missing source_id in job config" };

  const timeoutMs = getTimeoutSeconds(job) * 1000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${brainApiUrl}/knowledge/sync/${sourceId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": brainApiKey },
      body: JSON.stringify({ company_id: job.companyId }),
      signal: controller.signal,
    });
    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok || !data.ok) {
      return { output: JSON.stringify(data), error: (data.error as string) ?? `HTTP ${res.status}` };
    }
    return { output: `Synced: ${data.chunks} chunks in ${data.elapsed_seconds}s` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { output: "", error: msg.includes("abort") ? `Timed out after ${getTimeoutSeconds(job)}s` : msg };
  } finally {
    clearTimeout(timer);
  }
}

// ── Webhook Executor ─────────────────────────────────────────────────────────
export async function executeWebhook(
  job: ScheduledJob,
  resolveSecret: (secretId: string) => Promise<string | null>,
): Promise<{ output: string; error?: string }> {
  const config = job.config as Record<string, unknown>;
  const url = config.url as string | undefined;
  const method = (config.method as string) ?? "POST";
  const body = config.body as string | undefined;
  const authSecretId = config.auth_secret_id as string | undefined;

  if (!url) return { output: "", error: "Missing webhook URL in job config" };
  if (isPrivateUrl(url)) return { output: "", error: "Webhook URL targets a private or internal address" };

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authSecretId) {
    const secretValue = await resolveSecret(authSecretId);
    if (secretValue) headers["Authorization"] = `Bearer ${secretValue}`;
  }

  const timeoutMs = getTimeoutSeconds(job) * 1000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: method !== "GET" ? (body ?? "{}") : undefined,
      signal: controller.signal,
    });
    const responseText = await res.text().catch(() => "");
    if (!res.ok) {
      return { output: responseText, error: `HTTP ${res.status} ${res.statusText}` };
    }
    return { output: `HTTP ${res.status} OK${responseText ? ` · ${responseText.slice(0, 200)}` : ""}` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { output: "", error: msg.includes("abort") ? `Timed out after ${getTimeoutSeconds(job)}s` : msg };
  } finally {
    clearTimeout(timer);
  }
}

// ── Agent Run Executor ───────────────────────────────────────────────────────
// GAP 5 fix: checks heartbeat_runs (not just scheduled_job_runs) for running agent
export async function executeAgentRun(
  job: ScheduledJob,
  db: Db,
): Promise<{ output: string; error?: string; heartbeatRunId?: string }> {
  const config = job.config as Record<string, unknown>;
  const agentId = config.agent_id as string | undefined;
  const taskTitle = (config.task_title as string) ?? "Scheduled task";
  const taskDescription = (config.task_description as string) ?? "";

  if (!agentId) return { output: "", error: "Missing agent_id in job config" };

  // Check if agent is already running — overlap check via heartbeat_runs
  if (job.overlapPolicy === "skip") {
    const runningRuns = await db
      .select({ id: heartbeatRuns.id })
      .from(heartbeatRuns)
      .where(and(eq(heartbeatRuns.agentId, agentId), inArray(heartbeatRuns.status, ["queued", "running"])))
      .limit(1);
    if (runningRuns.length > 0) {
      return { output: "", error: "Agent is already running — skipped (overlap policy: skip)" };
    }
  }

  try {
    const rows = await db
      .insert(agentWakeupRequests)
      .values({
        agentId,
        companyId: job.companyId,
        source: "scheduled_job",
        triggerDetail: taskTitle,
        reason: taskDescription,
        payload: { jobId: job.id, taskTitle, taskDescription },
        requestedByActorType: "system",
        requestedByActorId: "scheduler",
        status: "queued",
      })
      .returning();
    return { output: `Wakeup request created: ${rows[0].id}` };
  } catch (err: unknown) {
    return { output: "", error: err instanceof Error ? err.message : String(err) };
  }
}
