import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agents, agentMetrics, heartbeatRuns } from "@paperclipai/db";

interface DimensionResult {
  score: number;
  status: "ok" | "warn" | "critical";
  missing: string[];
}

export interface ReadinessResult {
  score: number;
  canExecute: boolean;
  dimensions: {
    identity: DimensionResult;
    ethics: DimensionResult;
    expertise: DimensionResult;
    experience: DimensionResult;
    operations: DimensionResult;
    knowledge: DimensionResult;
  };
  blockers: string[];
  radar: number[];
}

function dimStatus(score: number): "ok" | "warn" | "critical" {
  if (score >= 60) return "ok";
  if (score >= 30) return "warn";
  return "critical";
}

export const agentReadinessService = {
  async calculate(db: Db, agentId: string): Promise<ReadinessResult> {
    const agent = await db.query.agents.findFirst({
      where: eq(agents.id, agentId),
    });
    if (!agent) throw new Error("Agent not found");

    // Identity (15%) — name, role, title, icon
    const identityMissing: string[] = [];
    if (!agent.name) identityMissing.push("name missing");
    if (!agent.role || agent.role === "general") identityMissing.push("role not set");
    if (!agent.title) identityMissing.push("title missing");
    const identityScore = Math.max(0, 100 - identityMissing.length * 33);

    // Ethics (20%) — metadata includes company law markers
    const meta = (agent.metadata ?? {}) as Record<string, unknown>;
    const hasLaw = meta.companyLaw === true
      || (typeof agent.capabilities === "string" && agent.capabilities.includes("Company Law"));
    const ethicsMissing: string[] = [];
    if (!hasLaw) ethicsMissing.push("Company Law not configured");
    const ethicsScore = hasLaw ? 100 : 0;

    // Expertise (25%) — capabilities text length as proxy for SOUL depth
    const capLen = (agent.capabilities ?? "").length;
    const expertiseMissing: string[] = [];
    if (capLen < 200) expertiseMissing.push("capabilities description too short (< 200 chars)");
    const expertiseScore = Math.min(100, Math.round((capLen / 500) * 100));

    // Experience (15%) — completed tasks from metrics table
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [metricsResult] = await db
      .select({ total: count() })
      .from(agentMetrics)
      .where(and(eq(agentMetrics.agentId, agentId), gte(agentMetrics.createdAt, thirtyDaysAgo)));
    const taskCount = metricsResult?.total ?? 0;
    const experienceMissing: string[] = [];
    if (taskCount < 10) experienceMissing.push(`only ${taskCount} tasks in last 30 days (need 10+)`);
    const experienceScore = Math.min(100, Math.round((taskCount / 30) * 100));

    // Operations (15%) — heartbeat recency
    const [lastRun] = await db
      .select({ finishedAt: heartbeatRuns.finishedAt })
      .from(heartbeatRuns)
      .where(eq(heartbeatRuns.agentId, agentId))
      .orderBy(desc(heartbeatRuns.finishedAt))
      .limit(1);
    const operationsMissing: string[] = [];
    const lastRunTime = lastRun?.finishedAt?.getTime() ?? 0;
    const ranRecently = lastRunTime > Date.now() - 24 * 60 * 60 * 1000;
    if (!lastRun) operationsMissing.push("no heartbeat runs found");
    else if (!ranRecently) operationsMissing.push("last heartbeat > 24h ago");
    const operationsScore = lastRun ? (ranRecently ? 100 : 50) : 0;

    // Knowledge (10%) — agent notes count as knowledge proxy
    const knowledgeMissing: string[] = [];
    const hasMetadata = meta && Object.keys(meta).length > 2;
    if (!hasMetadata) knowledgeMissing.push("agent metadata sparse (< 3 keys)");
    const knowledgeScore = hasMetadata ? 100 : 30;

    // Weighted total
    const totalScore = Math.round(
      (identityScore * 15 +
        ethicsScore * 20 +
        expertiseScore * 25 +
        experienceScore * 15 +
        operationsScore * 15 +
        knowledgeScore * 10) /
        100,
    );

    const dimensions = {
      identity: { score: identityScore, status: dimStatus(identityScore), missing: identityMissing },
      ethics: { score: ethicsScore, status: dimStatus(ethicsScore), missing: ethicsMissing },
      expertise: { score: expertiseScore, status: dimStatus(expertiseScore), missing: expertiseMissing },
      experience: { score: experienceScore, status: dimStatus(experienceScore), missing: experienceMissing },
      operations: { score: operationsScore, status: dimStatus(operationsScore), missing: operationsMissing },
      knowledge: { score: knowledgeScore, status: dimStatus(knowledgeScore), missing: knowledgeMissing },
    };

    const blockers: string[] = [];
    for (const [name, dim] of Object.entries(dimensions)) {
      if (dim.status === "critical") {
        blockers.push(`${name} score ${dim.score} — ${dim.missing.join(", ")}`);
      }
    }

    return {
      score: totalScore,
      canExecute: totalScore >= 50,
      dimensions,
      blockers,
      radar: [
        identityScore,
        ethicsScore,
        expertiseScore,
        experienceScore,
        operationsScore,
        knowledgeScore,
      ],
    };
  },

  async recordMetric(
    db: Db,
    data: {
      companyId: string;
      agentId: string;
      taskId?: string;
      toolsUsed?: string[];
      skillsApplied?: string[];
      skillsFailed?: string[];
      fallbacksUsed?: string[];
      durationMinutes?: number;
      tokensUsed?: number;
      errors?: string[];
      success: boolean;
      notes?: string;
    },
  ) {
    const [row] = await db
      .insert(agentMetrics)
      .values({
        companyId: data.companyId,
        agentId: data.agentId,
        taskId: data.taskId ?? null,
        toolsUsed: data.toolsUsed ?? [],
        skillsApplied: data.skillsApplied ?? [],
        skillsFailed: data.skillsFailed ?? [],
        fallbacksUsed: data.fallbacksUsed ?? [],
        durationMinutes: data.durationMinutes ?? null,
        tokensUsed: data.tokensUsed ?? null,
        errors: data.errors ?? [],
        success: data.success,
        notes: data.notes ?? null,
      })
      .returning();
    return row;
  },

  async getMetrics(db: Db, agentId: string, limit = 50) {
    return db
      .select()
      .from(agentMetrics)
      .where(eq(agentMetrics.agentId, agentId))
      .orderBy(desc(agentMetrics.createdAt))
      .limit(limit);
  },
};
