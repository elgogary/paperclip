import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { evolutionEvents, skills } from "@paperclipai/db";
import { parseSkillFeedback } from "./skill-feedback-parser.js";
import { skillVersionsService } from "./skill-versions.js";

export type EvolutionEvent = typeof evolutionEvents.$inferSelect;

const MAX_FIX_PER_SKILL_24H = 3;

export function skillEvolutionService(db: Db) {
  const versionsSvc = skillVersionsService(db);

  return {
    async analyzeRun(input: {
      runId: string;
      companyId: string;
      agentId: string;
      transcript: string;
    }): Promise<EvolutionEvent | null> {
      const feedback = parseSkillFeedback(input.transcript);

      // Check for skills that were used but unhelpful → potential FIX
      for (const fb of feedback.skillFeedbacks) {
        if (fb.used && fb.helpful === "no") {
          const skill = await findSkillBySlug(db, input.companyId, fb.skillSlug);
          if (!skill) continue;

          return createEvent(db, {
            companyId: input.companyId,
            skillId: skill.id,
            eventType: "fix",
            sourceMonitor: "post_run",
            heartbeatRunId: input.runId,
            agentId: input.agentId,
            analysis: {
              reason: "skill_unhelpful",
              skillSlug: fb.skillSlug,
              version: fb.version,
            },
          });
        }
      }

      // Check for novel patterns → potential CAPTURED skill
      if (feedback.novelPatterns.length > 0) {
        const pattern = feedback.novelPatterns[0];
        return createEvent(db, {
          companyId: input.companyId,
          skillId: null,
          eventType: "captured",
          sourceMonitor: "post_run",
          heartbeatRunId: input.runId,
          agentId: input.agentId,
          analysis: {
            reason: "novel_pattern",
            description: pattern.description,
            tools: pattern.tools,
          },
        });
      }

      // TODO: Add LLM-based transcript analysis for deeper pattern detection

      return null;
    },

    async handleToolDegradation(input: {
      toolName: string;
      errorMessage: string;
      companyId: string;
    }): Promise<EvolutionEvent[]> {
      // Find all skills whose instructions mention the degraded tool
      const companySkills = await db
        .select()
        .from(skills)
        .where(and(eq(skills.companyId, input.companyId), eq(skills.enabled, true)));

      const affected = companySkills.filter(
        (s) => s.instructions.toLowerCase().includes(input.toolName.toLowerCase()),
      );

      if (affected.length === 0) return [];

      // Batch: count recent fixes for all affected skills in a single query
      const affectedIds = affected.map((s) => s.id);
      const recentFixCounts = await countRecentFixesBatch(db, affectedIds);

      const events: EvolutionEvent[] = [];
      for (const skill of affected) {
        // Anti-loop: skip if skill was already FIXed 3x in 24h
        const fixes = recentFixCounts.get(skill.id) ?? 0;
        if (fixes >= MAX_FIX_PER_SKILL_24H) continue;

        const event = await createEvent(db, {
          companyId: input.companyId,
          skillId: skill.id,
          eventType: "fix",
          sourceMonitor: "tool_degradation",
          heartbeatRunId: null,
          agentId: null,
          analysis: {
            reason: "tool_degradation",
            toolName: input.toolName,
            errorMessage: input.errorMessage,
          },
        });
        events.push(event);
      }

      return events;
    },

    // Acceptable: runs every 6h, typically <100 skills per company
    async sweepMetrics(companyId: string): Promise<EvolutionEvent[]> {
      const companySkills = await db
        .select()
        .from(skills)
        .where(and(eq(skills.companyId, companyId), eq(skills.enabled, true)));

      const events: EvolutionEvent[] = [];

      for (const skill of companySkills) {
        const metrics = skill.qualityMetrics;
        if (!metrics) continue;

        // Flag for FIX if completion rate is below 70%
        if (metrics.completion_rate !== undefined && metrics.completion_rate < 0.7) {
          const event = await createEvent(db, {
            companyId,
            skillId: skill.id,
            eventType: "flagged",
            sourceMonitor: "metric_sweep",
            heartbeatRunId: null,
            agentId: null,
            analysis: {
              reason: "low_completion_rate",
              completionRate: metrics.completion_rate,
            },
          });
          events.push(event);
          continue;
        }

        // Mark as dormant if applied rate is below 10%
        if (metrics.applied_rate !== undefined && metrics.applied_rate < 0.1) {
          await db
            .update(skills)
            .set({ evolutionStatus: "dormant", updatedAt: new Date() })
            .where(eq(skills.id, skill.id));

          const event = await createEvent(db, {
            companyId,
            skillId: skill.id,
            eventType: "flagged",
            sourceMonitor: "metric_sweep",
            heartbeatRunId: null,
            agentId: null,
            analysis: {
              reason: "dormant_low_applied_rate",
              appliedRate: metrics.applied_rate,
            },
          });
          events.push(event);
        }
      }

      return events;
    },

    async scanBrainMemories(_companyId: string): Promise<EvolutionEvent[]> {
      // TODO: Wire to Brain API — GET /memory/search?type=LESSON
      // Will scan for recurring LESSON/PATTERN memories and propose new skills
      return [];
    },

    async applyEvolution(eventId: string): Promise<void> {
      const event = await getEventById(db, eventId);
      if (!event) throw new Error(`Evolution event ${eventId} not found`);
      if (event.status === "applied") return;

      const now = new Date();

      // If there's proposed content and a skill, create a new version
      if (event.proposedContent && event.skillId) {
        await versionsSvc.createVersion(event.skillId, {
          origin: event.eventType,
          fullContent: event.proposedContent,
          triggerReason: `evolution: ${event.eventType} from ${event.sourceMonitor}`,
          createdBy: "evolution_engine",
        });
      }

      await db
        .update(evolutionEvents)
        .set({ status: "applied", appliedAt: now })
        .where(eq(evolutionEvents.id, eventId));
    },

    async rejectEvolution(eventId: string, reason: string): Promise<void> {
      const event = await getEventById(db, eventId);
      const existingAnalysis = (event?.analysis ?? {}) as Record<string, unknown>;

      await db
        .update(evolutionEvents)
        .set({
          status: "rejected",
          reviewedBy: "board",
          analysis: { ...existingAnalysis, rejectionReason: reason },
        })
        .where(eq(evolutionEvents.id, eventId));
    },

    async listEvents(companyId: string, opts?: { limit?: number; status?: string }): Promise<EvolutionEvent[]> {
      const limit = opts?.limit ?? 50;
      const conditions = [eq(evolutionEvents.companyId, companyId)];
      if (opts?.status) {
        conditions.push(eq(evolutionEvents.status, opts.status));
      }
      return db
        .select()
        .from(evolutionEvents)
        .where(and(...conditions))
        .orderBy(desc(evolutionEvents.createdAt))
        .limit(limit);
    },

    async getEvent(eventId: string): Promise<EvolutionEvent | null> {
      return getEventById(db, eventId);
    },
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function findSkillBySlug(db: Db, companyId: string, slug: string) {
  const rows = await db
    .select()
    .from(skills)
    .where(and(eq(skills.companyId, companyId), eq(skills.slug, slug)))
    .limit(1);
  return rows[0] ?? null;
}

async function getEventById(db: Db, eventId: string) {
  const rows = await db
    .select()
    .from(evolutionEvents)
    .where(eq(evolutionEvents.id, eventId))
    .limit(1);
  return rows[0] ?? null;
}

async function countRecentFixesBatch(db: Db, skillIds: string[]): Promise<Map<string, number>> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rows = await db
    .select({
      skillId: evolutionEvents.skillId,
      count: sql<number>`count(*)::int`,
    })
    .from(evolutionEvents)
    .where(
      and(
        inArray(evolutionEvents.skillId, skillIds),
        eq(evolutionEvents.eventType, "fix"),
        gte(evolutionEvents.createdAt, cutoff),
      ),
    )
    .groupBy(evolutionEvents.skillId);

  const map = new Map<string, number>();
  for (const row of rows) {
    if (row.skillId) map.set(row.skillId, row.count);
  }
  return map;
}

async function createEvent(
  db: Db,
  input: {
    companyId: string;
    skillId: string | null;
    eventType: string;
    sourceMonitor: string;
    heartbeatRunId: string | null;
    agentId: string | null;
    analysis: Record<string, unknown>;
    proposedContent?: string;
  },
): Promise<EvolutionEvent> {
  const rows = await db
    .insert(evolutionEvents)
    .values({
      companyId: input.companyId,
      skillId: input.skillId,
      eventType: input.eventType,
      sourceMonitor: input.sourceMonitor,
      heartbeatRunId: input.heartbeatRunId,
      agentId: input.agentId,
      analysis: input.analysis,
      proposedContent: input.proposedContent ?? null,
      status: "pending",
    })
    .returning();
  return rows[0];
}
