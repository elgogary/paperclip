import { and, eq, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { skills, skillAgentMetrics } from "@paperclipai/db";

export type Skill = typeof skills.$inferSelect;

export interface RetrievedSkill {
  skill: Skill;
  score: number;
  agentVersion?: number;
}

interface FtsRow {
  id: string;
  company_id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  category: string | null;
  source: string;
  instructions: string;
  trigger_hint: string | null;
  invoked_by: string;
  enabled: boolean;
  created_by: string | null;
  origin: string;
  parent_id: string | null;
  version: number;
  quality_metrics: Record<string, unknown>;
  embedding_id: string | null;
  evolution_status: string;
  default_version: boolean;
  created_at: string;
  updated_at: string;
  rank: number;
}

function rowToSkill(row: FtsRow): Skill {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    icon: row.icon,
    category: row.category,
    source: row.source,
    instructions: row.instructions,
    triggerHint: row.trigger_hint,
    invokedBy: row.invoked_by,
    enabled: row.enabled,
    createdBy: row.created_by,
    origin: row.origin,
    parentId: row.parent_id,
    version: row.version,
    qualityMetrics: row.quality_metrics as Skill["qualityMetrics"],
    embeddingId: row.embedding_id,
    evolutionStatus: row.evolution_status,
    defaultVersion: row.default_version,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function skillRetrievalService(db: Db) {
  return {
    async retrieveForTask(input: {
      taskDescription: string;
      agentId: string;
      companyId: string;
      topK?: number;
    }): Promise<RetrievedSkill[]> {
      const topK = input.topK ?? 5;

      // Step 1: PostgreSQL full-text search on skills
      const ftsRows: FtsRow[] = (await db.execute(sql`
        SELECT s.*,
          ts_rank(
            to_tsvector('english', s.name || ' ' || coalesce(s.description, '') || ' ' || coalesce(s.trigger_hint, '')),
            plainto_tsquery('english', ${input.taskDescription})
          ) AS rank
        FROM skills s
        WHERE s.company_id = ${input.companyId}
          AND s.enabled = true
          AND s.evolution_status = 'active'
          AND plainto_tsquery('english', ${input.taskDescription}) <> ''::tsquery
          AND to_tsvector('english', s.name || ' ' || coalesce(s.description, '') || ' ' || coalesce(s.trigger_hint, ''))
              @@ plainto_tsquery('english', ${input.taskDescription})
        ORDER BY rank DESC
        LIMIT 20
      `)) as unknown as FtsRow[];

      if (ftsRows.length === 0) {
        // Fallback: return all active skills for the company (up to topK)
        const fallbackSkills = await db
          .select()
          .from(skills)
          .where(and(eq(skills.companyId, input.companyId), eq(skills.enabled, true), eq(skills.evolutionStatus, "active")))
          .limit(topK);

        return fallbackSkills.map((s) => ({ skill: s, score: 0 }));
      }

      // TODO: Step 2 — Sanad Brain vector search for semantic similarity
      // Will wire to GET /memory/search endpoint when available

      // Step 3: Agent-specific reranking using skill_agent_metrics
      const skillIds = ftsRows.map((r) => r.id);
      const metrics = await db
        .select()
        .from(skillAgentMetrics)
        .where(eq(skillAgentMetrics.agentId, input.agentId));

      const metricsMap = new Map<string, { successCount: number; failureCount: number }>();
      for (const m of metrics) {
        if (skillIds.includes(m.skillId)) {
          metricsMap.set(m.skillId, {
            successCount: m.successCount,
            failureCount: m.failureCount,
          });
        }
      }

      const scored: RetrievedSkill[] = ftsRows.map((row) => {
        let score = row.rank;
        const agentMetric = metricsMap.get(row.id);
        if (agentMetric) {
          score += agentMetric.successCount * 0.1;
          score -= agentMetric.failureCount * 0.15;
        }
        return { skill: rowToSkill(row), score };
      });

      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, topK);
    },
  };
}
