import { asc, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { connectors } from "@paperclipai/db";
import { toSlug } from "../utils/slug.js";

export type Connector = typeof connectors.$inferSelect;

export type CreateConnectorInput = {
  companyId: string;
  name: string;
  provider: string;
  status?: string;
  oauthTokenEncrypted?: string;
  oauthRefreshTokenEncrypted?: string;
  oauthExpiresAt?: Date;
  scopes?: string[];
  metadata?: Record<string, unknown>;
  connectedBy?: string;
  connectedAt?: Date;
  enabled?: boolean;
};

export function connectorsService(db: Db) {
  return {
    async list(companyId: string): Promise<Connector[]> {
      return db
        .select()
        .from(connectors)
        .where(eq(connectors.companyId, companyId))
        .orderBy(asc(connectors.createdAt))
        .limit(500);
    },

    async get(connectorId: string): Promise<Connector | null> {
      const rows = await db.select().from(connectors).where(eq(connectors.id, connectorId)).limit(1);
      return rows[0] ?? null;
    },

    async create(input: CreateConnectorInput): Promise<Connector> {
      const now = new Date();
      const slug = toSlug(input.name);
      const rows = await db
        .insert(connectors)
        .values({
          companyId: input.companyId,
          name: input.name,
          slug,
          provider: input.provider,
          status: input.status ?? "pending",
          oauthTokenEncrypted: input.oauthTokenEncrypted ?? null,
          oauthRefreshTokenEncrypted: input.oauthRefreshTokenEncrypted ?? null,
          oauthExpiresAt: input.oauthExpiresAt ?? null,
          scopes: input.scopes ?? null,
          metadata: input.metadata ?? null,
          connectedBy: input.connectedBy ?? null,
          connectedAt: input.connectedAt ?? null,
          enabled: input.enabled ?? true,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return rows[0];
    },

    async updateStatus(connectorId: string, status: string, tokens?: { encrypted: string; refreshEncrypted?: string; expiresAt?: Date }): Promise<void> {
      const updates: Record<string, unknown> = { status, updatedAt: new Date() };
      if (tokens) {
        updates.oauthTokenEncrypted = tokens.encrypted;
        if (tokens.refreshEncrypted !== undefined) {
          updates.oauthRefreshTokenEncrypted = tokens.refreshEncrypted;
        }
        if (tokens.expiresAt !== undefined) {
          updates.oauthExpiresAt = tokens.expiresAt;
        }
      }
      await db
        .update(connectors)
        .set(updates as Partial<typeof connectors.$inferInsert>)
        .where(eq(connectors.id, connectorId));
    },

    async remove(connectorId: string): Promise<void> {
      await db.delete(connectors).where(eq(connectors.id, connectorId));
    },

    async disconnect(connectorId: string): Promise<void> {
      await db
        .update(connectors)
        .set({
          status: "revoked",
          oauthTokenEncrypted: null,
          oauthRefreshTokenEncrypted: null,
          oauthExpiresAt: null,
          updatedAt: new Date(),
        })
        .where(eq(connectors.id, connectorId));
    },
  };
}
