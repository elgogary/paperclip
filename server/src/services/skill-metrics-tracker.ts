import { eq, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { skillAgentMetrics } from "@paperclipai/db";

export type SkillAgentMetric = typeof skillAgentMetrics.$inferSelect;

export function skillMetricsTracker(db: Db) {
  return {
    async recordUsage(input: {
      skillId: string;
      skillVersion: number;
      agentId: string;
      used: boolean;
      successful: boolean;
      tokenCount?: number;
    }): Promise<void> {
      const now = new Date();
      const tokens = input.tokenCount ?? 0;

      await db
        .insert(skillAgentMetrics)
        .values({
          skillId: input.skillId,
          skillVersion: input.skillVersion,
          agentId: input.agentId,
          appliedCount: input.used ? 1 : 0,
          successCount: input.successful ? 1 : 0,
          failureCount: !input.successful && input.used ? 1 : 0,
          fallbackCount: 0,
          totalTokens: tokens,
          avgTokenDelta: 0,
          lastUsedAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [skillAgentMetrics.skillId, skillAgentMetrics.skillVersion, skillAgentMetrics.agentId],
          set: {
            appliedCount: input.used
              ? sql`${skillAgentMetrics.appliedCount} + 1`
              : skillAgentMetrics.appliedCount,
            successCount: input.successful
              ? sql`${skillAgentMetrics.successCount} + 1`
              : skillAgentMetrics.successCount,
            failureCount:
              !input.successful && input.used
                ? sql`${skillAgentMetrics.failureCount} + 1`
                : skillAgentMetrics.failureCount,
            totalTokens: tokens > 0
              ? sql`${skillAgentMetrics.totalTokens} + ${tokens}`
              : skillAgentMetrics.totalTokens,
            lastUsedAt: now,
            updatedAt: now,
          },
        });
    },

    async getSkillMetrics(skillId: string): Promise<SkillAgentMetric[]> {
      return db
        .select()
        .from(skillAgentMetrics)
        .where(eq(skillAgentMetrics.skillId, skillId));
    },

    async getAgentMetrics(agentId: string): Promise<SkillAgentMetric[]> {
      return db
        .select()
        .from(skillAgentMetrics)
        .where(eq(skillAgentMetrics.agentId, agentId));
    },
  };
}
