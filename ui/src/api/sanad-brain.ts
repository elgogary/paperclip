import { api } from "./client";

export interface Memory {
  id: string;
  memory: string;
  hash: string;
  metadata: {
    company_id: string;
    scope: string;
    sensitivity: string;
    memory_type?: string;
    source?: string;
  };
  score?: number;
  created_at: string;
  updated_at: string | null;
  user_id: string;
  _guard_warning?: string;
}

export interface MemoryStats {
  total_memories: number;
  company_id: string;
  user_id: string;
  by_type: Record<string, number>;
  by_sensitivity: Record<string, number>;
}

export interface ServiceHealth {
  status: "up" | "down" | "disabled";
  error?: string;
  points?: number;
  models?: string[];
  healthy_models?: number;
}

export interface DeepHealth {
  version: string;
  services: Record<string, ServiceHealth>;
}

export interface AuditEntry {
  id: number;
  ts: number;
  action: string;
  company_id: string;
  user_id: string;
  agent_id: string | null;
  query_hash: string | null;
  memory_ids: string | null;
  metadata: string | null;
  endpoint: string | null;
}

export interface ConsolidationReport {
  total_memories: number;
  duplicates_found: number;
  duplicates_removed: number;
  stale_flagged: number;
  dry_run: boolean;
  by_type_counts: Record<string, number>;
}

export const sanadBrainApi = {
  health: () => api.get<DeepHealth>("/brain/admin/health"),

  stats: (companyId: string, userId: string) =>
    api.get<MemoryStats>(`/brain/memory/stats/${companyId}/${userId}`),

  allMemories: (companyId: string, userId: string, limit = 100) =>
    api.get<{ results: Memory[] }>(`/brain/memory/all/${companyId}/${userId}?limit=${limit}`),

  search: (companyId: string, userId: string, query: string, limit = 10) =>
    api.post<{ results: Memory[] }>("/brain/memory/search", {
      company_id: companyId, user_id: userId, query, limit,
    }),

  remember: (companyId: string, userId: string, content: string, opts?: {
    scope?: string; sensitivity?: string; memory_type?: string; source?: string;
  }) =>
    api.post<{ ok: boolean; result: unknown }>("/brain/memory/remember", {
      company_id: companyId, user_id: userId, content, ...opts,
    }),

  deleteMemory: (companyId: string, userId: string, memoryId: string) =>
    api.post<{ ok: boolean }>("/brain/memory/delete", {
      company_id: companyId, user_id: userId, memory_id: memoryId,
    }),

  consolidate: (companyId: string, userId: string, dryRun = true) =>
    api.post<{ ok: boolean; report: ConsolidationReport }>("/brain/memory/consolidate", {
      company_id: companyId, user_id: userId, dry_run: dryRun,
    }),

  feedback: (companyId: string, userId: string, memoryId: string, signal: string, reason?: string) =>
    api.post<{ ok: boolean }>("/brain/memory/feedback", {
      company_id: companyId, user_id: userId, memory_id: memoryId, signal, reason,
    }),

  audit: (limit = 50, action?: string, companyId?: string) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (action) params.set("action", action);
    if (companyId) params.set("company_id", companyId);
    return api.get<{ entries: AuditEntry[]; total: number }>(`/brain/admin/audit?${params}`);
  },

  agentActivity: (limit = 20) =>
    api.get<{ activity: AuditEntry[] }>(`/brain/admin/agents/activity?limit=${limit}`),
};
