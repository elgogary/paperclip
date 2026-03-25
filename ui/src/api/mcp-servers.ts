import { api } from "./client";

export interface McpServerConfig {
  id: string;
  companyId: string;
  name: string;
  slug: string;
  direction: string;
  transport: string;
  command: string | null;
  args: string[] | null;
  env: Record<string, string> | null;
  url: string | null;
  enabled: boolean;
  healthStatus: string;
  lastHealthCheck: string | null;
  catalogId: string | null;
  configJson: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface McpAgentAccess {
  id: string;
  mcpServerId: string;
  agentId: string;
  granted: boolean;
  createdAt: string;
}

export interface McpCatalogEntry {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  category: string | null;
  npmPackage: string | null;
  transport: string;
  defaultCommand: string | null;
  defaultArgs: string[] | null;
  requiredEnv: { key: string; label: string; required: boolean }[] | null;
  docsUrl: string | null;
  popularity: number;
  createdAt: string;
}

export interface CreateMcpServerInput {
  name: string;
  slug: string;
  direction?: string;
  transport?: string;
  command?: string | null;
  args?: string[] | null;
  env?: Record<string, string> | null;
  url?: string | null;
  configJson?: Record<string, unknown> | null;
}

export type UpdateMcpServerInput = Partial<CreateMcpServerInput & { enabled: boolean }>;

export const mcpServersApi = {
  list: (companyId: string) =>
    api.get<{ servers: McpServerConfig[] }>(`/companies/${companyId}/mcp-servers`),

  get: (companyId: string, serverId: string) =>
    api.get<{ server: McpServerConfig }>(`/companies/${companyId}/mcp-servers/${serverId}`),

  create: (companyId: string, data: CreateMcpServerInput) =>
    api.post<{ server: McpServerConfig }>(`/companies/${companyId}/mcp-servers`, data),

  update: (companyId: string, serverId: string, data: UpdateMcpServerInput) =>
    api.patch<{ server: McpServerConfig }>(`/companies/${companyId}/mcp-servers/${serverId}`, data),

  remove: (companyId: string, serverId: string) =>
    api.delete<{ ok: true }>(`/companies/${companyId}/mcp-servers/${serverId}`),

  test: (companyId: string, serverId: string) =>
    api.post<{ status: string; toolCount: number; message: string }>(
      `/companies/${companyId}/mcp-servers/${serverId}/test`,
      {},
    ),

  toggle: (companyId: string, serverId: string, enabled: boolean) =>
    api.post<{ ok: true }>(`/companies/${companyId}/mcp-servers/${serverId}/toggle`, { enabled }),

  getAccess: (companyId: string, serverId: string) =>
    api.get<{ access: McpAgentAccess[] }>(`/companies/${companyId}/mcp-servers/${serverId}/access`),

  updateAccess: (companyId: string, serverId: string, access: { agentId: string; granted: boolean }[]) =>
    api.put<{ ok: true }>(`/companies/${companyId}/mcp-servers/${serverId}/access`, { grants: access }),

  listCatalog: (companyId: string) =>
    api.get<{ catalog: McpCatalogEntry[] }>(`/companies/${companyId}/mcp-catalog`),

  installFromCatalog: (companyId: string, catalogId: string, env?: Record<string, string>) =>
    api.post<{ server: McpServerConfig }>(`/companies/${companyId}/mcp-servers/install`, { catalogId, env: env ?? {} }),
};
