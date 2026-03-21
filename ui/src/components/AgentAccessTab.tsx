import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { agentAccessApi } from "../api/agentAccess";
import { accessApi } from "../api/access";
import { Button } from "@/components/ui/button";
import { Plus, X, Shield, AlertTriangle } from "lucide-react";

type AgentAccessTabProps = {
  agentId: string;
  companyId: string;
};

export function AgentAccessTab({ agentId, companyId }: AgentAccessTabProps) {
  const queryClient = useQueryClient();
  const [showAddUser, setShowAddUser] = useState(false);

  const { data: grants = [] } = useQuery({
    queryKey: ["agent-access", agentId],
    queryFn: () => agentAccessApi.listByAgent(agentId),
  });

  const { data: members = [], isError: membersError } = useQuery({
    queryKey: ["company-members", companyId],
    queryFn: () => accessApi.listMembers(companyId),
    enabled: showAddUser,
  });

  const grantMutation = useMutation({
    mutationFn: (userId: string) => agentAccessApi.grant(companyId, agentId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-access", agentId] });
      setShowAddUser(false);
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (grantId: string) => agentAccessApi.revoke(grantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-access", agentId] });
    },
  });

  const grantedUserIds = new Set(grants.map((g) => g.userId));
  const humanMembers = members.filter(
    (m: { principalType: string; principalId: string; status: string }) =>
      m.principalType === "user" && m.status === "active" && !grantedUserIds.has(m.principalId),
  );

  return (
    <div className="space-y-4 p-4 max-w-2xl">
      {grants.length === 0 ? (
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
          <Shield className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium">No access restrictions</p>
            <p className="text-xs text-muted-foreground mt-1">
              All company members can access this agent. Add users below to
              restrict access to only listed users.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
              Restricted access — {grants.length} user{grants.length !== 1 ? "s" : ""}
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
              Only listed users can see and interact with this agent. Remove all
              users to make it accessible to everyone.
            </p>
          </div>
        </div>
      )}

      {grants.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Granted Users
          </h3>
          {grants.map((grant) => (
            <div
              key={grant.id}
              className="flex items-center justify-between p-2.5 rounded-lg border bg-card"
            >
              <span className="text-sm font-medium font-mono">{grant.userId}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-destructive hover:text-destructive"
                onClick={() => revokeMutation.mutate(grant.id)}
                disabled={revokeMutation.isPending}
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}

      {!showAddUser ? (
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => setShowAddUser(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          Add User
        </Button>
      ) : (
        <div className="space-y-2 border rounded-lg p-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Select user to grant access
          </h4>
          {membersError ? (
            <p className="text-xs text-muted-foreground">
              Unable to load members. You may not have the &quot;manage permissions&quot; capability.
            </p>
          ) : humanMembers.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {members.length === 0 ? "Loading members..." : "All users already have access."}
            </p>
          ) : (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {humanMembers.map((member: { principalId: string; membershipRole: string | null }) => (
                <button
                  key={member.principalId}
                  onClick={() => grantMutation.mutate(member.principalId)}
                  disabled={grantMutation.isPending}
                  className="w-full flex items-center justify-between p-2 rounded-md hover:bg-muted text-xs text-left"
                >
                  <span className="font-mono">{member.principalId}</span>
                  <span className="text-muted-foreground">{member.membershipRole ?? "member"}</span>
                </button>
              ))}
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={() => setShowAddUser(false)}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
