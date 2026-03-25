export interface AgentUserAccess {
  id: string;
  companyId: string;
  agentId: string;
  userId: string;
  grantedBy: string | null;
  createdAt: Date;
}
