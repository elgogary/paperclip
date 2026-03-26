// heartbeat.ts — Heartbeat service factory (thin orchestrator stub).
// Logic lives in sibling modules; this file wires them together.
import { desc, eq, gt, asc, and } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  agents,
  agentRuntimeState,
  agentTaskSessions,
  heartbeatRunEvents,
  heartbeatRuns,
} from "@paperclipai/db";
import { notFound } from "../errors.js";
import { getRunLogStore } from "./run-log-store.js";
import { companySkillService } from "./company-skills.js";
import { budgetService } from "./budgets.js";
import { secretService } from "./secrets.js";
import { summarizeHeartbeatRunResultJson } from "./heartbeat-run-summary.js";
import { issueService } from "./issues.js";
import { executionWorkspaceService } from "./execution-workspaces.js";
import { workspaceOperationService } from "./workspace-operations.js";
import { instanceSettingsService } from "./instance-settings.js";
import { redactCurrentUserText } from "../log-redaction.js";

// Import helpers
import {
  type ResolvedWorkspaceForRun,
  heartbeatRunListColumns,
  readNonEmptyString,
  parseSessionCompactionPolicy,
  resolveRuntimeSessionParamsForWorkspace,
  shouldResetTaskSessionForWake,
  formatRuntimeWorkspaceWarningLog,
  prioritizeProjectWorkspaceCandidatesForRun,
  buildExplicitResumeSessionOverride,
} from "./heartbeat-helpers.js";

// Import sub-modules
import { createSessionOps } from "./heartbeat-session.js";
import { createWorkspaceOps } from "./heartbeat-workspace.js";
import { createRunOps } from "./heartbeat-run-ops.js";
import { createExecutionOps } from "./heartbeat-execution.js";
import { createWakeupOps } from "./heartbeat-wakeup.js";
import { createCancellationOps } from "./heartbeat-cancellation.js";

// Re-export test-facing API surface (preserves import paths for tests)
export type { ResolvedWorkspaceForRun };
export {
  prioritizeProjectWorkspaceCandidatesForRun,
  buildExplicitResumeSessionOverride,
  parseSessionCompactionPolicy,
  resolveRuntimeSessionParamsForWorkspace,
  shouldResetTaskSessionForWake,
  formatRuntimeWorkspaceWarningLog,
};

export function heartbeatService(db: Db) {
  // ── Shared context bag: all modules read/write cross-module refs here ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const $: Record<string, any> = {};

  // ── Factory-level services ──────────────────────────────────────────────
  const instanceSettings = instanceSettingsService(db);
  $.instanceSettings = instanceSettings;
  $.getCurrentUserRedactionOptions = async () => ({
    enabled: (await instanceSettings.getGeneral()).censorUsernameInLogs,
  });
  $.runLogStore = getRunLogStore();
  $.secretsSvc = secretService(db);
  $.companySkills = companySkillService(db);
  $.issuesSvc = issueService(db);
  $.executionWorkspacesSvc = executionWorkspaceService(db);
  $.workspaceOperationsSvc = workspaceOperationService(db);
  $.activeRunExecutions = new Set<string>();

  // ── Simple DB query closures (stay inline) ─────────────────────────────
  $.getAgent = async (agentId: string) =>
    db.select().from(agents).where(eq(agents.id, agentId)).then((rows) => rows[0] ?? null);

  $.getRun = async (runId: string) =>
    db.select().from(heartbeatRuns).where(eq(heartbeatRuns.id, runId)).then((rows) => rows[0] ?? null);

  $.getRuntimeState = async (agentId: string) =>
    db.select().from(agentRuntimeState).where(eq(agentRuntimeState.agentId, agentId)).then((rows) => rows[0] ?? null);

  // ── Initialize sub-modules (each populates $ with its functions) ───────
  const sessionOps = createSessionOps(db, $);
  Object.assign($, sessionOps);

  const workspaceOps = createWorkspaceOps(db, $);
  Object.assign($, workspaceOps);

  const runOps = createRunOps(db, $);
  Object.assign($, runOps);

  const executionOps = createExecutionOps(db, $);
  Object.assign($, executionOps);

  const wakeupOps = createWakeupOps(db, $);
  Object.assign($, wakeupOps);

  const cancellationOps = createCancellationOps(db, $);
  Object.assign($, cancellationOps);

  // ── Budget service (needs cancelBudgetScopeWork from cancellation) ─────
  // NOTE: $.budgets and $.budgetHooks must be set before any function is
  // called at runtime. Order matters — modules reference these lazily via $.
  $.budgetHooks = { cancelWorkForScope: cancellationOps.cancelBudgetScopeWork };
  $.budgets = budgetService(db, $.budgetHooks);
  if (!$.budgets) throw new Error("heartbeat: budgetService failed to initialize");

  // ── Public API ─────────────────────────────────────────────────────────
  return {
    list: async (companyId: string, agentId?: string, limit?: number) => {
      const query = db
        .select(heartbeatRunListColumns)
        .from(heartbeatRuns)
        .where(
          agentId
            ? and(eq(heartbeatRuns.companyId, companyId), eq(heartbeatRuns.agentId, agentId))
            : eq(heartbeatRuns.companyId, companyId),
        )
        .orderBy(desc(heartbeatRuns.createdAt));

      const rows = limit ? await query.limit(limit) : await query;
      return rows.map((row) => ({
        ...row,
        resultJson: summarizeHeartbeatRunResultJson(row.resultJson),
      }));
    },

    getRun: $.getRun,

    getRuntimeState: async (agentId: string) => {
      const state = await $.getRuntimeState(agentId);
      const agent = await $.getAgent(agentId);
      if (!agent) return null;
      const ensured = state ?? (await $.ensureRuntimeState(agent));
      const latestTaskSession = await db
        .select()
        .from(agentTaskSessions)
        .where(and(eq(agentTaskSessions.companyId, agent.companyId), eq(agentTaskSessions.agentId, agent.id)))
        .orderBy(desc(agentTaskSessions.updatedAt))
        .limit(1)
        .then((rows: any[]) => rows[0] ?? null);
      return {
        ...ensured,
        sessionDisplayId: latestTaskSession?.sessionDisplayId ?? ensured.sessionId,
        sessionParamsJson: latestTaskSession?.sessionParamsJson ?? null,
      };
    },

    listTaskSessions: async (agentId: string) => {
      const agent = await $.getAgent(agentId);
      if (!agent) throw notFound("Agent not found");

      return db
        .select()
        .from(agentTaskSessions)
        .where(and(eq(agentTaskSessions.companyId, agent.companyId), eq(agentTaskSessions.agentId, agentId)))
        .orderBy(desc(agentTaskSessions.updatedAt), desc(agentTaskSessions.createdAt));
    },

    resetRuntimeSession: async (agentId: string, opts?: { taskKey?: string | null }) => {
      const agent = await $.getAgent(agentId);
      if (!agent) throw notFound("Agent not found");
      await $.ensureRuntimeState(agent);
      const taskKey = readNonEmptyString(opts?.taskKey);
      const clearedTaskSessions = await $.clearTaskSessions(
        agent.companyId,
        agent.id,
        taskKey ? { taskKey, adapterType: agent.adapterType } : undefined,
      );
      const runtimePatch: Partial<typeof agentRuntimeState.$inferInsert> = {
        sessionId: null,
        lastError: null,
        updatedAt: new Date(),
      };
      if (!taskKey) {
        runtimePatch.stateJson = {};
      }

      const updated = await db
        .update(agentRuntimeState)
        .set(runtimePatch)
        .where(eq(agentRuntimeState.agentId, agentId))
        .returning()
        .then((rows) => rows[0] ?? null);

      if (!updated) return null;
      return {
        ...updated,
        sessionDisplayId: null,
        sessionParamsJson: null,
        clearedTaskSessions,
      };
    },

    listEvents: (runId: string, afterSeq = 0, limit = 200) =>
      db
        .select()
        .from(heartbeatRunEvents)
        .where(and(eq(heartbeatRunEvents.runId, runId), gt(heartbeatRunEvents.seq, afterSeq)))
        .orderBy(asc(heartbeatRunEvents.seq))
        .limit(Math.max(1, Math.min(limit, 1000))),

    readLog: async (runId: string, opts?: { offset?: number; limitBytes?: number }) => {
      const run = await $.getRun(runId);
      if (!run) throw notFound("Heartbeat run not found");
      if (!run.logStore || !run.logRef) throw notFound("Run log not found");

      const result = await $.runLogStore.read(
        {
          store: run.logStore as "local_file",
          logRef: run.logRef,
        },
        opts,
      );

      return {
        runId,
        store: run.logStore,
        logRef: run.logRef,
        ...result,
        content: redactCurrentUserText(result.content, await $.getCurrentUserRedactionOptions()),
      };
    },

    invoke: async (
      agentId: string,
      source: "timer" | "assignment" | "on_demand" | "automation" = "on_demand",
      contextSnapshot: Record<string, unknown> = {},
      triggerDetail: "manual" | "ping" | "callback" | "system" = "manual",
      actor?: { actorType?: "user" | "agent" | "system"; actorId?: string | null },
    ) =>
      $.enqueueWakeup(agentId, {
        source,
        triggerDetail,
        contextSnapshot,
        requestedByActorType: actor?.actorType,
        requestedByActorId: actor?.actorId ?? null,
      }),

    wakeup: wakeupOps.enqueueWakeup,

    reportRunActivity: runOps.clearDetachedRunWarning,

    reapOrphanedRuns: runOps.reapOrphanedRuns,

    resumeQueuedRuns: runOps.resumeQueuedRuns,

    tickTimers: async (now = new Date()) => {
      const allAgents = await db.select().from(agents);
      let checked = 0;
      let enqueued = 0;
      let skipped = 0;

      for (const agent of allAgents) {
        if (agent.status === "paused" || agent.status === "terminated" || agent.status === "pending_approval") continue;
        const policy = $.parseHeartbeatPolicy(agent);
        if (!policy.enabled || policy.intervalSec <= 0) continue;

        checked += 1;
        const baseline = new Date(agent.lastHeartbeatAt ?? agent.createdAt).getTime();
        const elapsedMs = now.getTime() - baseline;
        if (elapsedMs < policy.intervalSec * 1000) continue;

        const run = await $.enqueueWakeup(agent.id, {
          source: "timer",
          triggerDetail: "system",
          reason: "heartbeat_timer",
          requestedByActorType: "system",
          requestedByActorId: "heartbeat_scheduler",
          contextSnapshot: {
            source: "scheduler",
            reason: "interval_elapsed",
            now: now.toISOString(),
          },
        });
        if (run) enqueued += 1;
        else skipped += 1;
      }

      return { checked, enqueued, skipped };
    },

    cancelRun: (runId: string) => $.cancelRunInternal(runId),

    cancelActiveForAgent: (agentId: string) => $.cancelActiveForAgentInternal(agentId),

    cancelBudgetScopeWork: cancellationOps.cancelBudgetScopeWork,

    getActiveRunForAgent: async (agentId: string) => {
      const [run] = await db
        .select()
        .from(heartbeatRuns)
        .where(
          and(
            eq(heartbeatRuns.agentId, agentId),
            eq(heartbeatRuns.status, "running"),
          ),
        )
        .orderBy(desc(heartbeatRuns.startedAt))
        .limit(1);
      return run ?? null;
    },
  };
}
