import { and, eq, gte, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { evolutionEvents } from "@paperclipai/db";

const THRESHOLD_COUNT = 3;
const THRESHOLD_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export function toolDegradationMonitor(db: Db) {
  return {
    async recordError(toolName: string, errorMessage: string, companyId: string): Promise<void> {
      // Record the error as a flagged evolution event so it persists across restarts
      await db.insert(evolutionEvents).values({
        companyId,
        skillId: null,
        eventType: "flagged",
        sourceMonitor: "tool_degradation_error",
        heartbeatRunId: null,
        agentId: null,
        analysis: { toolName, errorMessage },
        status: "pending",
      });
    },

    async checkThresholds(companyId: string): Promise<Array<{ toolName: string; errorCount: number }>> {
      const cutoff = new Date(Date.now() - THRESHOLD_WINDOW_MS);

      const rows = await db
        .select({
          toolName: sql<string>`(${evolutionEvents.analysis}->>'toolName')`,
          errorCount: sql<number>`count(*)::int`,
        })
        .from(evolutionEvents)
        .where(
          and(
            eq(evolutionEvents.companyId, companyId),
            eq(evolutionEvents.eventType, "flagged"),
            eq(evolutionEvents.sourceMonitor, "tool_degradation_error"),
            gte(evolutionEvents.createdAt, cutoff),
          ),
        )
        .groupBy(sql`${evolutionEvents.analysis}->>'toolName'`);

      return rows
        .filter((r) => r.errorCount >= THRESHOLD_COUNT)
        .map((r) => ({ toolName: r.toolName, errorCount: r.errorCount }));
    },
  };
}
