import { api } from "./client";

export type SkillSource = "user" | "builtin" | "community";
export type SkillInvokedBy = "user_or_agent" | "agent_only" | "user_only";

export interface Skill {
  id: string;
  companyId: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  category: string | null;
  source: SkillSource;
  instructions: string;
  triggerHint: string | null;
  invokedBy: SkillInvokedBy;
  enabled: boolean;
  createdBy: string | null;
  origin: string;
  parentId: string | null;
  version: number;
  qualityMetrics: Record<string, unknown>;
  embeddingId: string | null;
  evolutionStatus: string;
  defaultVersion: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SkillAgentAccess {
  id: string;
  skillId: string;
  agentId: string;
  granted: boolean;
  createdAt: string;
}

export interface SkillVersion {
  id: string;
  skillId: string;
  version: number;
  origin: string;
  contentDiff: string | null;
  fullContent: string;
  triggerReason: string | null;
  metricsBefore: Record<string, unknown>;
  metricsAfter: Record<string, unknown>;
  createdBy: string | null;
  createdAt: string;
}

export interface AuditResult {
  score: number;
  strengths: string[];
  suggestions: string[];
  details: {
    clarity: number;
    triggerSpecificity: number;
    instructionCompleteness: number;
    exampleCoverage: number;
    edgeCaseHandling: number;
  };
}

export interface EnhanceResult {
  originalScore: number;
  enhancedScore: number;
  enhancedContent: string;
  changes: string[];
}

export interface GeneratedSkill {
  name: string;
  slug: string;
  description: string;
  instructions: string;
  category: string;
  triggerHint: string;
}

export interface CreateSkillInput {
  name: string;
  description?: string | null;
  icon?: string | null;
  category?: string | null;
  source?: SkillSource;
  instructions?: string;
  triggerHint?: string | null;
  invokedBy?: SkillInvokedBy;
}

export type UpdateSkillInput = Partial<CreateSkillInput & { enabled: boolean }>;

function mapSourceType(sourceType?: string): SkillSource {
  if (sourceType === "github" || sourceType === "url") return "community";
  if (sourceType === "builtin" || sourceType === "bundled") return "builtin";
  return "user";
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function normalizeSkill(raw: any): Skill {
  return {
    id: raw.id,
    companyId: raw.companyId,
    name: raw.name,
    slug: raw.slug ?? raw.key ?? "",
    description: raw.description ?? null,
    icon: raw.icon ?? null,
    category: raw.category ?? null,
    source: raw.source ?? mapSourceType(raw.sourceType),
    instructions: raw.instructions ?? raw.markdown ?? "",
    triggerHint: raw.triggerHint ?? null,
    invokedBy: raw.invokedBy ?? "user_or_agent",
    enabled: raw.enabled !== false,
    createdBy: raw.createdBy ?? null,
    origin: raw.origin ?? raw.sourceType ?? "manual",
    parentId: raw.parentId ?? null,
    version: raw.version ?? 1,
    qualityMetrics: raw.qualityMetrics ?? {},
    embeddingId: raw.embeddingId ?? null,
    evolutionStatus: raw.evolutionStatus ?? "active",
    defaultVersion: raw.defaultVersion !== false,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export const skillsApi = {
  list: async (companyId: string) => {
    const data = await api.get<{ skills: unknown[] }>(`/companies/${companyId}/skills`);
    return { skills: (data.skills ?? []).map(normalizeSkill) };
  },

  get: async (companyId: string, skillId: string) => {
    const data = await api.get<{ skill: unknown }>(`/companies/${companyId}/skills/${skillId}`);
    return { skill: data.skill ? normalizeSkill(data.skill) : null };
  },

  create: (companyId: string, data: CreateSkillInput) =>
    api.post<{ skill: Skill }>(`/companies/${companyId}/skills`, data),

  update: (companyId: string, skillId: string, data: UpdateSkillInput) =>
    api.patch<{ skill: Skill }>(`/companies/${companyId}/skills/${skillId}`, data),

  remove: (companyId: string, skillId: string) =>
    api.delete<{ ok: true }>(`/companies/${companyId}/skills/${skillId}`),

  getAccess: (companyId: string, skillId: string) =>
    api.get<{ access: SkillAgentAccess[] }>(`/companies/${companyId}/skills/${skillId}/access`),

  updateAccess: (companyId: string, skillId: string, access: { agentId: string; granted: boolean }[]) =>
    api.put<{ ok: true }>(`/companies/${companyId}/skills/${skillId}/access`, { grants: access }),

  listVersions: (companyId: string, skillId: string) =>
    api.get<{ versions: SkillVersion[] }>(`/companies/${companyId}/skills/${skillId}/versions`),

  getVersion: (companyId: string, skillId: string, version: number) =>
    api.get<{ version: SkillVersion }>(`/companies/${companyId}/skills/${skillId}/versions/${version}`),

  rollback: (companyId: string, skillId: string, targetVersion: number) =>
    api.post<{ version: SkillVersion }>(`/companies/${companyId}/skills/${skillId}/versions/${targetVersion}/rollback`, {}),

  diffVersions: (companyId: string, skillId: string, v1: number, v2: number) =>
    api.get<{ diff: string }>(`/companies/${companyId}/skills/${skillId}/versions/${v1}/diff/${v2}`),

  audit: (companyId: string, skillId: string) =>
    api.post<AuditResult>(`/companies/${companyId}/skills/${skillId}/audit`, {}),

  enhance: (companyId: string, skillId: string) =>
    api.post<EnhanceResult>(`/companies/${companyId}/skills/${skillId}/enhance`, {}),

  acceptEnhancement: (companyId: string, skillId: string, data: { enhancedContent: string; changes: string[] }) =>
    api.post<{ version: SkillVersion; updated: boolean }>(`/companies/${companyId}/skills/${skillId}/enhance/accept`, data),

  generate: (companyId: string, description: string, category?: string) =>
    api.post<GeneratedSkill>(`/companies/${companyId}/skills/generate`, { description, category }),
};
