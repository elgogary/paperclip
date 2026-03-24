import { and, asc, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { skills, skillAgentAccess } from "@paperclipai/db";

export type Skill = typeof skills.$inferSelect;
export type SkillAgentAccess = typeof skillAgentAccess.$inferSelect;

export type CreateSkillInput = {
  companyId: string;
  name: string;
  description?: string;
  icon?: string;
  category?: string;
  source?: string;
  instructions?: string;
  triggerHint?: string;
  invokedBy?: string;
  enabled?: boolean;
  createdBy?: string;
};

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function skillsService(db: Db) {
  return {
    async list(companyId: string): Promise<Skill[]> {
      return db
        .select()
        .from(skills)
        .where(eq(skills.companyId, companyId))
        .orderBy(asc(skills.createdAt))
        .limit(500);
    },

    async get(skillId: string): Promise<Skill | null> {
      const rows = await db.select().from(skills).where(eq(skills.id, skillId)).limit(1);
      return rows[0] ?? null;
    },

    async create(input: CreateSkillInput): Promise<Skill> {
      const now = new Date();
      const rows = await db
        .insert(skills)
        .values({
          companyId: input.companyId,
          name: input.name,
          slug: toSlug(input.name),
          description: input.description ?? null,
          icon: input.icon ?? null,
          category: input.category ?? null,
          source: input.source ?? "user",
          instructions: input.instructions ?? "",
          triggerHint: input.triggerHint ?? null,
          invokedBy: input.invokedBy ?? "user_or_agent",
          enabled: input.enabled ?? true,
          createdBy: input.createdBy ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return rows[0];
    },

    async update(skillId: string, input: Partial<Omit<CreateSkillInput, "companyId">>): Promise<Skill> {
      const updates: Record<string, unknown> = { ...input, updatedAt: new Date() };
      if (input.name !== undefined) {
        updates.slug = toSlug(input.name);
      }
      const rows = await db
        .update(skills)
        .set(updates as Partial<typeof skills.$inferInsert>)
        .where(eq(skills.id, skillId))
        .returning();
      return rows[0];
    },

    async remove(skillId: string): Promise<void> {
      await db.delete(skills).where(eq(skills.id, skillId));
    },

    async listAccess(skillId: string): Promise<SkillAgentAccess[]> {
      return db
        .select()
        .from(skillAgentAccess)
        .where(eq(skillAgentAccess.skillId, skillId))
        .orderBy(asc(skillAgentAccess.createdAt));
    },

    async updateAccess(skillId: string, agentId: string, granted: boolean): Promise<void> {
      await db
        .insert(skillAgentAccess)
        .values({ skillId, agentId, granted })
        .onConflictDoUpdate({
          target: [skillAgentAccess.skillId, skillAgentAccess.agentId],
          set: { granted },
        });
    },

    async bulkUpdateAccess(skillId: string, grants: { agentId: string; granted: boolean }[]): Promise<void> {
      await db.transaction(async (tx) => {
        for (const grant of grants) {
          await tx
            .insert(skillAgentAccess)
            .values({ skillId, agentId: grant.agentId, granted: grant.granted })
            .onConflictDoUpdate({
              target: [skillAgentAccess.skillId, skillAgentAccess.agentId],
              set: { granted: grant.granted },
            });
        }
      });
    },
  };
}
