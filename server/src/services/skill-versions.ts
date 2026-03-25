import { and, desc, eq, max } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { skills, skillVersions } from "@paperclipai/db";

export type SkillVersion = typeof skillVersions.$inferSelect;

function simpleDiff(oldText: string, newText: string): string {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const result: string[] = [];
  const maxLen = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < maxLen; i++) {
    const old = oldLines[i];
    const cur = newLines[i];
    if (old === cur) {
      result.push(`  ${cur ?? ""}`);
    } else {
      if (old !== undefined) result.push(`- ${old}`);
      if (cur !== undefined) result.push(`+ ${cur}`);
    }
  }
  return result.join("\n");
}

export function skillVersionsService(db: Db) {
  return {
    async listVersions(skillId: string): Promise<SkillVersion[]> {
      return db
        .select()
        .from(skillVersions)
        .where(eq(skillVersions.skillId, skillId))
        .orderBy(desc(skillVersions.version))
        .limit(500);
    },

    async getVersion(skillId: string, version: number): Promise<SkillVersion | null> {
      const rows = await db
        .select()
        .from(skillVersions)
        .where(and(eq(skillVersions.skillId, skillId), eq(skillVersions.version, version)))
        .limit(1);
      return rows[0] ?? null;
    },

    async createVersion(
      skillId: string,
      input: {
        origin: string;
        fullContent: string;
        triggerReason?: string;
        createdBy?: string;
      },
    ): Promise<SkillVersion> {
      // Get current max version
      const [maxRow] = await db
        .select({ maxVersion: max(skillVersions.version) })
        .from(skillVersions)
        .where(eq(skillVersions.skillId, skillId));
      const prevVersion = maxRow?.maxVersion ?? 0;
      const newVersion = prevVersion + 1;

      // Compute diff from previous version if it exists
      let contentDiff: string | null = null;
      if (prevVersion > 0) {
        const prev = await this.getVersion(skillId, prevVersion);
        if (prev) {
          contentDiff = simpleDiff(prev.fullContent, input.fullContent);
        }
      }

      // Insert new version row
      const now = new Date();
      const rows = await db
        .insert(skillVersions)
        .values({
          skillId,
          version: newVersion,
          origin: input.origin,
          fullContent: input.fullContent,
          contentDiff,
          triggerReason: input.triggerReason ?? null,
          createdBy: input.createdBy ?? null,
          createdAt: now,
        })
        .returning();

      // Update skills table with new instructions and version
      await db
        .update(skills)
        .set({
          instructions: input.fullContent,
          version: newVersion,
          updatedAt: now,
        })
        .where(eq(skills.id, skillId));

      return rows[0];
    },

    async diffVersions(skillId: string, v1: number, v2: number): Promise<string> {
      const [ver1, ver2] = await Promise.all([
        this.getVersion(skillId, v1),
        this.getVersion(skillId, v2),
      ]);
      if (!ver1 || !ver2) {
        return "";
      }
      return simpleDiff(ver1.fullContent, ver2.fullContent);
    },

    async rollback(skillId: string, targetVersion: number): Promise<SkillVersion> {
      const target = await this.getVersion(skillId, targetVersion);
      if (!target) {
        throw new Error(`Version ${targetVersion} not found for skill ${skillId}`);
      }
      return this.createVersion(skillId, {
        origin: "manual",
        fullContent: target.fullContent,
        triggerReason: `rollback to v${targetVersion}`,
        createdBy: "system",
      });
    },
  };
}
