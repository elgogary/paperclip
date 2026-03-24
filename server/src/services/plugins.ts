import { asc, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { plugins, pluginAgentAccess } from "@paperclipai/db";

export type Plugin = typeof plugins.$inferSelect;
export type PluginAgentAccess = typeof pluginAgentAccess.$inferSelect;

export type CreatePluginInput = {
  companyId: string;
  name: string;
  description?: string;
  icon?: string;
  transport?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  enabled?: boolean;
};

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function pluginsService(db: Db) {
  return {
    async list(companyId: string): Promise<Plugin[]> {
      return db
        .select()
        .from(plugins)
        .where(eq(plugins.companyId, companyId))
        .orderBy(asc(plugins.createdAt))
        .limit(500);
    },

    async get(pluginId: string): Promise<Plugin | null> {
      const rows = await db.select().from(plugins).where(eq(plugins.id, pluginId)).limit(1);
      return rows[0] ?? null;
    },

    async create(input: CreatePluginInput): Promise<Plugin> {
      const now = new Date();
      const rows = await db
        .insert(plugins)
        .values({
          companyId: input.companyId,
          name: input.name,
          slug: toSlug(input.name),
          description: input.description ?? null,
          icon: input.icon ?? null,
          transport: input.transport ?? null,
          command: input.command ?? null,
          args: input.args ?? null,
          env: input.env ?? null,
          url: input.url ?? null,
          enabled: input.enabled ?? true,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return rows[0];
    },

    async update(pluginId: string, input: Partial<Omit<CreatePluginInput, "companyId">>): Promise<Plugin> {
      const updates: Record<string, unknown> = { ...input, updatedAt: new Date() };
      if (input.name !== undefined) {
        updates.slug = toSlug(input.name);
      }
      const rows = await db
        .update(plugins)
        .set(updates as Partial<typeof plugins.$inferInsert>)
        .where(eq(plugins.id, pluginId))
        .returning();
      return rows[0];
    },

    async remove(pluginId: string): Promise<void> {
      await db.delete(plugins).where(eq(plugins.id, pluginId));
    },

    async toggleEnabled(pluginId: string, enabled: boolean): Promise<void> {
      await db
        .update(plugins)
        .set({ enabled, updatedAt: new Date() })
        .where(eq(plugins.id, pluginId));
    },

    async updateHealth(pluginId: string, status: string, tools?: { name: string; description: string }[]): Promise<void> {
      const updates: Record<string, unknown> = {
        healthStatus: status,
        lastHealthCheck: new Date(),
        updatedAt: new Date(),
      };
      if (tools !== undefined) {
        updates.tools = tools;
        updates.toolCount = tools.length;
      }
      await db
        .update(plugins)
        .set(updates as Partial<typeof plugins.$inferInsert>)
        .where(eq(plugins.id, pluginId));
    },

    async listAccess(pluginId: string): Promise<PluginAgentAccess[]> {
      return db
        .select()
        .from(pluginAgentAccess)
        .where(eq(pluginAgentAccess.pluginId, pluginId))
        .orderBy(asc(pluginAgentAccess.createdAt));
    },

    async updateAccess(pluginId: string, agentId: string, granted: boolean): Promise<void> {
      await db
        .insert(pluginAgentAccess)
        .values({ pluginId, agentId, granted })
        .onConflictDoUpdate({
          target: [pluginAgentAccess.pluginId, pluginAgentAccess.agentId],
          set: { granted },
        });
    },

    async bulkUpdateAccess(pluginId: string, grants: { agentId: string; granted: boolean }[]): Promise<void> {
      await db.transaction(async (tx) => {
        for (const grant of grants) {
          await tx
            .insert(pluginAgentAccess)
            .values({ pluginId, agentId: grant.agentId, granted: grant.granted })
            .onConflictDoUpdate({
              target: [pluginAgentAccess.pluginId, pluginAgentAccess.agentId],
              set: { granted: grant.granted },
            });
        }
      });
    },
  };
}
