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
};
