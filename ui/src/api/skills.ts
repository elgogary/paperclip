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

export const skillsApi = {
  list: (companyId: string) =>
    api.get<{ skills: Skill[] }>(`/companies/${companyId}/skills`),

  get: (companyId: string, skillId: string) =>
    api.get<{ skill: Skill }>(`/companies/${companyId}/skills/${skillId}`),

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

  generate: (companyId: string, description: string, category?: string) =>
    api.post<GeneratedSkill>(`/companies/${companyId}/skills/generate`, { description, category }),
};
