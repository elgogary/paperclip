import { and, asc, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { swarmSources, swarmCapabilities, swarmInstalls, swarmAuditLog } from "@paperclipai/db";

// --- Types ---
export type SwarmSource = typeof swarmSources.$inferSelect;
export type SwarmCapability = typeof swarmCapabilities.$inferSelect;
export type SwarmInstall = typeof swarmInstalls.$inferSelect;
export type SwarmAuditEntry = typeof swarmAuditLog.$inferSelect;

export type CreateSourceInput = {
  companyId: string;
  name: string;
  url: string;
  sourceType: string;
  trustLevel?: string;
  capabilityTypes?: string[];
  syncIntervalMinutes?: number;
  metadata?: Record<string, unknown>;
};

export type CreateCapabilityInput = {
  companyId: string;
  sourceId: string;
  externalId?: string;
  name: string;
  slug: string;
  description?: string;
  capabilityType: string;
  trustLevel?: string;
  version?: string;
  icon?: string;
  pricingTier?: string;
  priceMonthlyUsd?: number;
  stars?: number;
  installs?: number;
  readme?: string;
  configTemplate?: Record<string, unknown>;
  requiredSecrets?: string[];
  contentHash?: string;
  metadata?: Record<string, unknown>;
};

export type InstallCapabilityInput = {
  companyId: string;
  capabilityId?: string;
  name: string;
  capabilityType: string;
  version?: string;
  installedBy?: string;
  installedByBoard?: string;
  approvedBy?: string;
  pricingTier?: string;
  priceMonthlyUsd?: number;
  contentHash?: string;
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type AuditInput = {
  companyId: string;
  action: string;
  capabilityName?: string;
  capabilityType?: string;
  actorType: string;
  actorId?: string;
  actorBoardUserId?: string;
  detail?: string;
  costUsd?: number;
  metadata?: Record<string, unknown>;
};

// --- Service factory ---
export function swarmService(db: Db) {
  async function logAudit(input: AuditInput) {
    await db.insert(swarmAuditLog).values({
      companyId: input.companyId,
      action: input.action,
      capabilityName: input.capabilityName ?? null,
      capabilityType: input.capabilityType ?? null,
      actorType: input.actorType,
      actorId: input.actorId ?? null,
      actorBoardUserId: input.actorBoardUserId ?? null,
      detail: input.detail ?? null,
      costUsd: input.costUsd ?? null,
      metadata: input.metadata ?? null,
    });
  }

  return {
    // ── Sources ──
    async listSources(companyId: string): Promise<SwarmSource[]> {
      return db.select().from(swarmSources)
        .where(eq(swarmSources.companyId, companyId))
        .orderBy(asc(swarmSources.createdAt));
    },

    async getSource(sourceId: string): Promise<SwarmSource | null> {
      const rows = await db.select().from(swarmSources).where(eq(swarmSources.id, sourceId)).limit(1);
      return rows[0] ?? null;
    },

    async createSource(input: CreateSourceInput): Promise<SwarmSource> {
      const now = new Date();
      const rows = await db.insert(swarmSources).values({
        companyId: input.companyId,
        name: input.name,
        url: input.url,
        sourceType: input.sourceType,
        trustLevel: input.trustLevel ?? "community",
        capabilityTypes: input.capabilityTypes ?? [],
        syncIntervalMinutes: input.syncIntervalMinutes ?? 60,
        metadata: input.metadata ?? null,
        createdAt: now,
        updatedAt: now,
      }).returning();
      return rows[0];
    },

    async updateSource(sourceId: string, updates: Partial<Pick<SwarmSource, "name" | "url" | "trustLevel" | "capabilityTypes" | "enabled" | "syncIntervalMinutes" | "metadata">>): Promise<void> {
      await db.update(swarmSources)
        .set({ ...updates, updatedAt: new Date() } as Partial<typeof swarmSources.$inferInsert>)
        .where(eq(swarmSources.id, sourceId));
    },

    async deleteSource(sourceId: string): Promise<void> {
      await db.delete(swarmCapabilities).where(eq(swarmCapabilities.sourceId, sourceId));
      await db.delete(swarmSources).where(eq(swarmSources.id, sourceId));
    },

    async updateSourceSyncStatus(sourceId: string, status: string, error?: string, capCount?: number): Promise<void> {
      const updates: Record<string, unknown> = {
        lastSyncAt: new Date(),
        lastSyncStatus: status,
        lastSyncError: error ?? null,
        updatedAt: new Date(),
      };
      if (capCount !== undefined) updates.capabilityCount = capCount;
      await db.update(swarmSources).set(updates as Partial<typeof swarmSources.$inferInsert>).where(eq(swarmSources.id, sourceId));
    },

    // ── Capabilities (browsing cache) ──
    async listCapabilities(companyId: string, filters?: { type?: string; search?: string; trustLevel?: string; pricingTier?: string }): Promise<SwarmCapability[]> {
      const conditions = [eq(swarmCapabilities.companyId, companyId)];
      if (filters?.type) conditions.push(eq(swarmCapabilities.capabilityType, filters.type));
      if (filters?.trustLevel) conditions.push(eq(swarmCapabilities.trustLevel, filters.trustLevel));
      if (filters?.pricingTier) conditions.push(eq(swarmCapabilities.pricingTier, filters.pricingTier));
      if (filters?.search) conditions.push(ilike(swarmCapabilities.name, `%${filters.search}%`));
      return db.select().from(swarmCapabilities)
        .where(and(...conditions))
        .orderBy(desc(swarmCapabilities.installs))
        .limit(500);
    },

    async getCapability(capabilityId: string): Promise<SwarmCapability | null> {
      const rows = await db.select().from(swarmCapabilities).where(eq(swarmCapabilities.id, capabilityId)).limit(1);
      return rows[0] ?? null;
    },

    async upsertCapability(input: CreateCapabilityInput): Promise<SwarmCapability> {
      const now = new Date();
      const rows = await db.insert(swarmCapabilities).values({
        companyId: input.companyId,
        sourceId: input.sourceId,
        externalId: input.externalId ?? null,
        name: input.name,
        slug: input.slug,
        description: input.description ?? null,
        capabilityType: input.capabilityType,
        trustLevel: input.trustLevel ?? "community",
        version: input.version ?? null,
        icon: input.icon ?? null,
        pricingTier: input.pricingTier ?? "free",
        priceMonthlyUsd: input.priceMonthlyUsd ?? 0,
        stars: input.stars ?? 0,
        installs: input.installs ?? 0,
        readme: input.readme ?? null,
        configTemplate: input.configTemplate ?? null,
        requiredSecrets: input.requiredSecrets ?? null,
        contentHash: input.contentHash ?? null,
        metadata: input.metadata ?? null,
        cachedAt: now,
        createdAt: now,
        updatedAt: now,
      }).onConflictDoUpdate({
        target: [swarmCapabilities.companyId, swarmCapabilities.slug],
        set: {
          name: input.name,
          description: input.description ?? null,
          version: input.version ?? null,
          icon: input.icon ?? null,
          pricingTier: input.pricingTier ?? "free",
          priceMonthlyUsd: input.priceMonthlyUsd ?? 0,
          stars: input.stars ?? 0,
          installs: input.installs ?? 0,
          readme: input.readme ?? null,
          configTemplate: input.configTemplate ?? null,
          requiredSecrets: input.requiredSecrets ?? null,
          contentHash: input.contentHash ?? null,
          metadata: input.metadata ?? null,
          cachedAt: now,
          updatedAt: now,
        },
      }).returning();
      return rows[0];
    },

    async getCapabilityCounts(companyId: string): Promise<Record<string, number>> {
      const rows = await db.select({
        type: swarmCapabilities.capabilityType,
        count: sql<number>`count(*)::int`,
      }).from(swarmCapabilities)
        .where(eq(swarmCapabilities.companyId, companyId))
        .groupBy(swarmCapabilities.capabilityType);
      const result: Record<string, number> = {};
      for (const row of rows) result[row.type] = row.count;
      return result;
    },

    // ── Installs ──
    async listInstalls(companyId: string, filters?: { type?: string; status?: string }): Promise<SwarmInstall[]> {
      const conditions = [eq(swarmInstalls.companyId, companyId)];
      if (filters?.type) conditions.push(eq(swarmInstalls.capabilityType, filters.type));
      if (filters?.status) conditions.push(eq(swarmInstalls.status, filters.status));
      return db.select().from(swarmInstalls)
        .where(and(...conditions))
        .orderBy(asc(swarmInstalls.createdAt));
    },

    async getInstall(installId: string): Promise<SwarmInstall | null> {
      const rows = await db.select().from(swarmInstalls).where(eq(swarmInstalls.id, installId)).limit(1);
      return rows[0] ?? null;
    },

    async getInstallByName(companyId: string, name: string): Promise<SwarmInstall | null> {
      const rows = await db.select().from(swarmInstalls)
        .where(and(eq(swarmInstalls.companyId, companyId), eq(swarmInstalls.name, name)))
        .limit(1);
      return rows[0] ?? null;
    },

    async installCapability(input: InstallCapabilityInput): Promise<SwarmInstall> {
      const now = new Date();
      const rows = await db.insert(swarmInstalls).values({
        companyId: input.companyId,
        capabilityId: input.capabilityId ?? null,
        name: input.name,
        capabilityType: input.capabilityType,
        version: input.version ?? null,
        status: "active",
        installedBy: input.installedBy ?? null,
        installedByBoard: input.installedByBoard ?? null,
        approvedBy: input.approvedBy ?? null,
        pricingTier: input.pricingTier ?? "free",
        priceMonthlyUsd: input.priceMonthlyUsd ?? 0,
        contentHash: input.contentHash ?? null,
        config: input.config ?? null,
        metadata: input.metadata ?? null,
        createdAt: now,
        updatedAt: now,
      }).returning();
      return rows[0];
    },

    async updateInstallStatus(installId: string, status: string): Promise<void> {
      const updates: Record<string, unknown> = { status, updatedAt: new Date() };
      if (status === "removed") updates.removedAt = new Date();
      await db.update(swarmInstalls).set(updates as Partial<typeof swarmInstalls.$inferInsert>).where(eq(swarmInstalls.id, installId));
    },

    async getInstallCounts(companyId: string): Promise<Record<string, number>> {
      const rows = await db.select({
        type: swarmInstalls.capabilityType,
        count: sql<number>`count(*)::int`,
      }).from(swarmInstalls)
        .where(and(eq(swarmInstalls.companyId, companyId), eq(swarmInstalls.status, "active")))
        .groupBy(swarmInstalls.capabilityType);
      const result: Record<string, number> = {};
      for (const row of rows) result[row.type] = row.count;
      return result;
    },

    // ── Audit Log ──
    logAudit,

    async listAuditLog(companyId: string, filters?: { action?: string; limit?: number }): Promise<SwarmAuditEntry[]> {
      const conditions = [eq(swarmAuditLog.companyId, companyId)];
      if (filters?.action) conditions.push(eq(swarmAuditLog.action, filters.action));
      return db.select().from(swarmAuditLog)
        .where(and(...conditions))
        .orderBy(desc(swarmAuditLog.createdAt))
        .limit(filters?.limit ?? 100);
    },
  };
}
