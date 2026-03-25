import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { mcpServerConfigs, mcpAgentAccess, mcpCatalog } from "@paperclipai/db";
import { toSlug } from "../utils/slug.js";

export type McpServerConfig = typeof mcpServerConfigs.$inferSelect;
export type McpAgentAccess = typeof mcpAgentAccess.$inferSelect;
export type McpCatalogEntry = typeof mcpCatalog.$inferSelect;

export type CreateMcpServerInput = {
  companyId: string;
  name: string;
  direction?: string;
  transport?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  enabled?: boolean;
  catalogId?: string;
  configJson?: Record<string, unknown>;
};

export function mcpServersService(db: Db) {
  return {
    async list(companyId: string): Promise<McpServerConfig[]> {
      return db
        .select()
        .from(mcpServerConfigs)
        .where(eq(mcpServerConfigs.companyId, companyId))
        .orderBy(asc(mcpServerConfigs.createdAt))
        .limit(500);
    },

    async get(serverId: string): Promise<McpServerConfig | null> {
      const rows = await db.select().from(mcpServerConfigs).where(eq(mcpServerConfigs.id, serverId)).limit(1);
      return rows[0] ?? null;
    },

    async create(input: CreateMcpServerInput): Promise<McpServerConfig> {
      const now = new Date();
      const rows = await db
        .insert(mcpServerConfigs)
        .values({
          companyId: input.companyId,
          name: input.name,
          slug: toSlug(input.name),
          direction: input.direction ?? "outbound",
          transport: input.transport ?? "stdio",
          command: input.command ?? null,
          args: input.args ?? null,
          env: input.env ?? null,
          url: input.url ?? null,
          enabled: input.enabled ?? true,
          catalogId: input.catalogId ?? null,
          configJson: input.configJson ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return rows[0];
    },

    async update(serverId: string, input: Partial<Omit<CreateMcpServerInput, "companyId">>): Promise<McpServerConfig> {
      const updates: Record<string, unknown> = { ...input, updatedAt: new Date() };
      if (input.name !== undefined) {
        updates.slug = toSlug(input.name);
      }
      const rows = await db
        .update(mcpServerConfigs)
        .set(updates as Partial<typeof mcpServerConfigs.$inferInsert>)
        .where(eq(mcpServerConfigs.id, serverId))
        .returning();
      return rows[0];
    },

    async remove(serverId: string): Promise<void> {
      await db.delete(mcpServerConfigs).where(eq(mcpServerConfigs.id, serverId));
    },

    async toggleEnabled(serverId: string, enabled: boolean): Promise<void> {
      await db
        .update(mcpServerConfigs)
        .set({ enabled, updatedAt: new Date() })
        .where(eq(mcpServerConfigs.id, serverId));
    },

    async updateHealth(serverId: string, status: string, lastCheck?: Date): Promise<void> {
      await db
        .update(mcpServerConfigs)
        .set({
          healthStatus: status,
          lastHealthCheck: lastCheck ?? new Date(),
          updatedAt: new Date(),
        })
        .where(eq(mcpServerConfigs.id, serverId));
    },

    async listAccess(serverId: string): Promise<McpAgentAccess[]> {
      return db
        .select()
        .from(mcpAgentAccess)
        .where(eq(mcpAgentAccess.mcpServerId, serverId))
        .orderBy(asc(mcpAgentAccess.createdAt));
    },

    async listForAgent(agentId: string, companyId: string): Promise<McpServerConfig[]> {
      const accessRows = await db
        .select({ mcpServerId: mcpAgentAccess.mcpServerId })
        .from(mcpAgentAccess)
        .where(and(eq(mcpAgentAccess.agentId, agentId), eq(mcpAgentAccess.granted, true)));

      if (accessRows.length === 0) {
        // No explicit access rows → default: all enabled company servers
        return db
          .select()
          .from(mcpServerConfigs)
          .where(and(eq(mcpServerConfigs.companyId, companyId), eq(mcpServerConfigs.enabled, true)))
          .orderBy(asc(mcpServerConfigs.createdAt))
          .limit(500);
      }

      const serverIds = accessRows.map((r) => r.mcpServerId);
      return db
        .select()
        .from(mcpServerConfigs)
        .where(and(inArray(mcpServerConfigs.id, serverIds), eq(mcpServerConfigs.enabled, true)))
        .orderBy(asc(mcpServerConfigs.createdAt))
        .limit(500);
    },

    async updateAccess(serverId: string, agentId: string, granted: boolean): Promise<void> {
      await db
        .insert(mcpAgentAccess)
        .values({ mcpServerId: serverId, agentId, granted })
        .onConflictDoUpdate({
          target: [mcpAgentAccess.mcpServerId, mcpAgentAccess.agentId],
          set: { granted },
        });
    },

    async bulkUpdateAccess(serverId: string, grants: { agentId: string; granted: boolean }[]): Promise<void> {
      await db.transaction(async (tx) => {
        for (const grant of grants) {
          await tx
            .insert(mcpAgentAccess)
            .values({ mcpServerId: serverId, agentId: grant.agentId, granted: grant.granted })
            .onConflictDoUpdate({
              target: [mcpAgentAccess.mcpServerId, mcpAgentAccess.agentId],
              set: { granted: grant.granted },
            });
        }
      });
    },

    async listCatalog(): Promise<McpCatalogEntry[]> {
      return db
        .select()
        .from(mcpCatalog)
        .orderBy(desc(mcpCatalog.popularity));
    },

    async installFromCatalog(
      companyId: string,
      catalogId: string,
      env: Record<string, string>,
    ): Promise<McpServerConfig> {
      const catalogRows = await db.select().from(mcpCatalog).where(eq(mcpCatalog.id, catalogId)).limit(1);
      const entry = catalogRows[0];
      if (!entry) {
        throw new Error(`Catalog entry not found: ${catalogId}`);
      }
      const now = new Date();
      const rows = await db
        .insert(mcpServerConfigs)
        .values({
          companyId,
          name: entry.name,
          slug: toSlug(entry.name),
          transport: entry.transport,
          command: entry.defaultCommand ?? null,
          args: entry.defaultArgs ?? null,
          env,
          enabled: true,
          catalogId: entry.id,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return rows[0];
    },
  };
}
