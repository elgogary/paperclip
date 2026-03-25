import { api } from "./client";

export interface Connector {
  id: string;
  companyId: string;
  name: string;
  slug: string;
  provider: string;
  status: string;
  oauthExpiresAt: string | null;
  scopes: string[] | null;
  metadata: Record<string, unknown> | null;
  connectedBy: string | null;
  connectedAt: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateConnectorInput {
  name: string;
  provider: string;
  scopes?: string[] | null;
  metadata?: Record<string, unknown> | null;
}

export const connectorsApi = {
  list: (companyId: string) =>
    api.get<{ connectors: Connector[] }>(`/companies/${companyId}/connectors`),

  get: (companyId: string, connectorId: string) =>
    api.get<{ connector: Connector }>(`/companies/${companyId}/connectors/${connectorId}`),

  create: (companyId: string, data: CreateConnectorInput) =>
    api.post<{ connector: Connector }>(`/companies/${companyId}/connectors`, data),

  disconnect: (companyId: string, connectorId: string) =>
    api.post<{ ok: true }>(`/companies/${companyId}/connectors/${connectorId}/disconnect`, {}),

  remove: (companyId: string, connectorId: string) =>
    api.delete<{ ok: true }>(`/companies/${companyId}/connectors/${connectorId}`),
};
