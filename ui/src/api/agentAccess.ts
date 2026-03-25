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

  getInstructions: (agentId: string) =>
    api.get<{ path: string | null; content: string | null; error?: string }>(`/agents/${agentId}/instructions`),

  listNotes: (agentId: string) =>
    api.get<AgentNote[]>(`/agents/${agentId}/notes`),

  addNote: (agentId: string, body: string) =>
    api.post<AgentNote>(`/agents/${agentId}/notes`, { body }),

  deleteNote: (agentId: string, noteId: string) =>
    api.delete<AgentNote>(`/agents/${agentId}/notes/${noteId}`),
};

export type AgentNote = {
  id: string;
  companyId: string;
  agentId: string;
  authorUserId: string;
  body: string;
  createdAt: string;
};
