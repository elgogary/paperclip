import { api } from "./client";

export interface Plugin {
  id: string;
  companyId: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  transport: string | null;
  command: string | null;
  args: string[] | null;
  env: Record<string, string> | null;
  url: string | null;
  toolCount: number;
  tools: { name: string; description: string }[] | null;
  healthStatus: string | null;
  lastHealthCheck: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PluginAgentAccess {
  id: string;
  pluginId: string;
  agentId: string;
  granted: boolean;
  createdAt: string;
}

export interface CreatePluginInput {
  name: string;
  description?: string | null;
  icon?: string | null;
  transport?: string | null;
  command?: string | null;
  args?: string[] | null;
  env?: Record<string, string> | null;
  url?: string | null;
}

export type UpdatePluginInput = Partial<CreatePluginInput & { enabled: boolean }>;

export const pluginsApi = {
  list: (companyId: string) =>
    api.get<{ plugins: Plugin[] }>(`/companies/${companyId}/plugins`),

  get: (companyId: string, pluginId: string) =>
    api.get<{ plugin: Plugin }>(`/companies/${companyId}/plugins/${pluginId}`),

  create: (companyId: string, data: CreatePluginInput) =>
    api.post<{ plugin: Plugin }>(`/companies/${companyId}/plugins`, data),

  update: (companyId: string, pluginId: string, data: UpdatePluginInput) =>
    api.patch<{ plugin: Plugin }>(`/companies/${companyId}/plugins/${pluginId}`, data),

  remove: (companyId: string, pluginId: string) =>
    api.delete<{ ok: true }>(`/companies/${companyId}/plugins/${pluginId}`),

  test: (companyId: string, pluginId: string) =>
    api.post<{ status: string; toolCount: number; message: string }>(
      `/companies/${companyId}/plugins/${pluginId}/test`,
      {},
    ),

  getAccess: (companyId: string, pluginId: string) =>
    api.get<{ access: PluginAgentAccess[] }>(`/companies/${companyId}/plugins/${pluginId}/access`),

  updateAccess: (companyId: string, pluginId: string, access: { agentId: string; granted: boolean }[]) =>
    api.put<{ ok: true }>(`/companies/${companyId}/plugins/${pluginId}/access`, { grants: access }),
};
