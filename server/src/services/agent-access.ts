import { and, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agentUserAccess } from "@paperclipai/db";

export function agentAccessService(db: Db) {
  return {
    listByCompany: (companyId: string) =>
      db.select().from(agentUserAccess).where(eq(agentUserAccess.companyId, companyId)),

    listByAgent: (agentId: string) =>
      db.select().from(agentUserAccess).where(eq(agentUserAccess.agentId, agentId)),

    listByUser: (companyId: string, userId: string) =>
      db.select().from(agentUserAccess).where(
        and(eq(agentUserAccess.companyId, companyId), eq(agentUserAccess.userId, userId)),
      ),

    grant: (data: { companyId: string; agentId: string; userId: string; grantedBy: string | null }) =>
      db.insert(agentUserAccess)
        .values(data)
        .onConflictDoNothing({ target: [agentUserAccess.agentId, agentUserAccess.userId] })
        .returning()
        .then((rows) => rows[0] ?? null),

    revoke: (id: string) =>
      db.delete(agentUserAccess)
        .where(eq(agentUserAccess.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),

    revokeByAgentAndUser: (agentId: string, userId: string) =>
      db.delete(agentUserAccess)
        .where(and(eq(agentUserAccess.agentId, agentId), eq(agentUserAccess.userId, userId)))
        .returning()
        .then((rows) => rows[0] ?? null),
  };
}
