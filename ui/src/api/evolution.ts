import { api } from "./client";

export interface EvolutionEvent {
  id: string;
  companyId: string;
  skillId: string | null;
  eventType: string;
  sourceMonitor: string;
  heartbeatRunId: string | null;
  agentId: string | null;
  analysis: Record<string, unknown> | null;
  proposedContent: string | null;
  status: string;
  reviewedBy: string | null;
  appliedAt: string | null;
  createdAt: string;
}

export interface SkillAgentMetric {
  id: string;
  skillId: string;
  skillVersion: number;
  agentId: string;
  appliedCount: number;
  successCount: number;
  failureCount: number;
  fallbackCount: number;
  totalTokens: number;
  avgTokenDelta: number;
  lastUsedAt: string | null;
}

export const evolutionApi = {
  listEvents: (companyId: string, limit?: number, status?: string) => {
    const params = new URLSearchParams();
    if (limit !== undefined) params.set("limit", String(limit));
    if (status) params.set("status", status);
    const qs = params.toString();
    return api.get<{ events: EvolutionEvent[] }>(
      `/companies/${companyId}/evolution/events${qs ? `?${qs}` : ""}`,
    );
  },

  getEvent: (companyId: string, eventId: string) =>
    api.get<{ event: EvolutionEvent }>(`/companies/${companyId}/evolution/events/${eventId}`),

  approveEvent: (companyId: string, eventId: string) =>
    api.post<{ ok: true }>(`/companies/${companyId}/evolution/events/${eventId}/approve`, {}),

  rejectEvent: (companyId: string, eventId: string, reason?: string) =>
    api.post<{ ok: true }>(`/companies/${companyId}/evolution/events/${eventId}/reject`, { reason }),

  getSkillMetrics: (companyId: string, skillId: string) =>
    api.get<{ metrics: SkillAgentMetric[] }>(`/companies/${companyId}/skills/${skillId}/metrics`),
};
