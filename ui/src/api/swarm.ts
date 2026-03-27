import { api } from "./client";

function qs(params?: Record<string, string | number | undefined>): string {
  if (!params) return "";
  const parts = Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

export interface SwarmSource {
  id: string;
  companyId: string;
  name: string;
  url: string;
  sourceType: string;
  trustLevel: string;
  capabilityTypes: string[];
  enabled: boolean;
  syncIntervalMinutes: number;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
  capabilityCount: number;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface SwarmCapability {
  id: string;
  companyId: string;
  sourceId: string;
  externalId: string | null;
  name: string;
  slug: string;
  description: string | null;
  capabilityType: string;
  trustLevel: string;
  version: string | null;
  icon: string | null;
  pricingTier: string;
  priceMonthlyUsd: number;
  stars: number;
  installs: number;
  avgQualityScore: number | null;
  readme: string | null;
  configTemplate: Record<string, unknown> | null;
  requiredSecrets: string[] | null;
  contentHash: string | null;
  metadata: Record<string, unknown> | null;
  cachedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface SwarmInstall {
  id: string;
  companyId: string;
  capabilityId: string | null;
  name: string;
  capabilityType: string;
  version: string | null;
  status: string;
  installedBy: string | null;
  installedByBoard: string | null;
  approvedBy: string | null;
  pricingTier: string;
  priceMonthlyUsd: number;
  totalCostUsd: number;
  totalValueUsd: number;
  reuseCount: number;
  avgQualityScore: number | null;
  contentHash: string | null;
  config: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  removedAt: string | null;
}

export interface SwarmAuditEntry {
  id: string;
  companyId: string;
  action: string;
  capabilityName: string | null;
  capabilityType: string | null;
  actorType: string;
  actorId: string | null;
  actorBoardUserId: string | null;
  detail: string | null;
  costUsd: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export const swarmApi = {
  // Sources
  listSources: (companyId: string) =>
    api.get<{ sources: SwarmSource[] }>(`/companies/${companyId}/swarm/sources`),
  createSource: (companyId: string, data: { name: string; url: string; sourceType: string; trustLevel?: string; capabilityTypes?: string[]; syncIntervalMinutes?: number }) =>
    api.post<{ source: SwarmSource }>(`/companies/${companyId}/swarm/sources`, data),
  updateSource: (companyId: string, sourceId: string, data: Partial<SwarmSource>) =>
    api.patch<{ ok: true }>(`/companies/${companyId}/swarm/sources/${sourceId}`, data),
  deleteSource: (companyId: string, sourceId: string) =>
    api.delete<{ ok: true }>(`/companies/${companyId}/swarm/sources/${sourceId}`),

  // Capabilities (catalog)
  listCapabilities: (companyId: string, filters?: { type?: string; search?: string; trustLevel?: string; pricingTier?: string }) =>
    api.get<{ capabilities: SwarmCapability[] }>(`/companies/${companyId}/swarm/capabilities${qs(filters)}`),
  getCapability: (companyId: string, capabilityId: string) =>
    api.get<{ capability: SwarmCapability }>(`/companies/${companyId}/swarm/capabilities/${capabilityId}`),
  getCapabilityCounts: (companyId: string) =>
    api.get<{ counts: Record<string, number> }>(`/companies/${companyId}/swarm/capabilities/counts`),

  // Installs
  listInstalls: (companyId: string, filters?: { type?: string; status?: string }) =>
    api.get<{ installs: SwarmInstall[] }>(`/companies/${companyId}/swarm/installs${qs(filters)}`),
  installCapability: (companyId: string, data: { name: string; capabilityType: string; capabilityId?: string; version?: string; pricingTier?: string; priceMonthlyUsd?: number; config?: Record<string, unknown> }) =>
    api.post<{ install: SwarmInstall }>(`/companies/${companyId}/swarm/installs`, data),
  disableInstall: (companyId: string, installId: string) =>
    api.post<{ ok: true }>(`/companies/${companyId}/swarm/installs/${installId}/disable`, {}),
  removeInstall: (companyId: string, installId: string) =>
    api.delete<{ ok: true }>(`/companies/${companyId}/swarm/installs/${installId}`),
  getInstallCounts: (companyId: string) =>
    api.get<{ counts: Record<string, number> }>(`/companies/${companyId}/swarm/installs/counts`),

  // Audit
  listAudit: (companyId: string, filters?: { action?: string; limit?: number }) =>
    api.get<{ entries: SwarmAuditEntry[] }>(`/companies/${companyId}/swarm/audit${qs(filters)}`),
};
