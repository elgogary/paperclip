import { api } from "./client";

export type AgentUserAccess = {
  id: string;
  companyId: string;
  agentId: string;
  userId: string;
  grantedBy: string | null;
  createdAt: string;
};

export const agentAccessApi = {
  listByCompany: (companyId: string) =>
    api.get<AgentUserAccess[]>(`/companies/${companyId}/agent-access`),

  listByAgent: (agentId: string) =>
    api.get<AgentUserAccess[]>(`/agents/${agentId}/access`),

  grant: (companyId: string, agentId: string, userId: string) =>
    api.post<AgentUserAccess>(`/companies/${companyId}/agent-access`, { agentId, userId }),

  revoke: (companyId: string, grantId: string) =>
    api.delete<AgentUserAccess>(`/companies/${companyId}/agent-access/${grantId}`),
};
