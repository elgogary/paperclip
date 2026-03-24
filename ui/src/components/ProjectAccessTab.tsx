import { useQuery } from "@tanstack/react-query";
import { accessApi } from "../api/access";
import { agentsApi } from "../api/agents";
import { Shield, User, Bot } from "lucide-react";
import type { Project } from "@paperclipai/shared";

interface ProjectAccessTabProps {
  project: Project;
}

export function ProjectAccessTab({ project }: ProjectAccessTabProps) {
  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ["company-members", project.companyId],
    queryFn: () => accessApi.listMembers(project.companyId),
  });

  const { data: agents = [] } = useQuery({
    queryKey: ["agents", project.companyId],
    queryFn: () => agentsApi.list(project.companyId),
    enabled: !!project.companyId,
  });

  const activeMembers = (members as Array<{
    id: string;
    principalType: string;
    principalId: string;
    status: string;
    membershipRole: string | null;
    user?: { id: string; name: string | null; email: string | null } | null;
  }>).filter((m) => m.principalType === "user" && m.status === "active");

  const leadAgent = project.leadAgentId
    ? (agents as Array<{ id: string; name: string }>).find((a) => a.id === project.leadAgentId)
    : null;

  return (
    <div className="space-y-6 max-w-2xl">
      {leadAgent && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Lead Agent
          </h3>
          <div className="flex items-center gap-2.5 p-2.5 rounded-lg border bg-card">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="h-3.5 w-3.5 text-primary" />
            </div>
            <div>
              <div className="text-sm font-medium">{leadAgent.name}</div>
              <div className="text-[10px] text-muted-foreground">lead agent</div>
            </div>
          </div>
        </div>
      )}

      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
          Company Members
        </h3>
        {membersLoading ? (
          <p className="text-xs text-muted-foreground">Loading members...</p>
        ) : activeMembers.length === 0 ? (
          <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
            <Shield className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">No active members found.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {activeMembers.map((member) => {
              const name = member.user?.name ?? member.user?.email ?? member.principalId.slice(0, 12) + "...";
              const detail = member.user?.email && member.user?.name
                ? member.user.email
                : member.membershipRole ?? "member";
              return (
                <div
                  key={member.id}
                  className="flex items-center gap-2.5 p-2.5 rounded-lg border bg-card"
                >
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">{name}</div>
                    <div className="text-[10px] text-muted-foreground capitalize">{detail}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
