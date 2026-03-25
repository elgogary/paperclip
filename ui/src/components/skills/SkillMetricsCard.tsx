import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "../../context/CompanyContext";
import { evolutionApi, type SkillAgentMetric } from "../../api/evolution";
import { agentsApi } from "../../api/agents";
import { queryKeys } from "../../lib/queryKeys";
import { cn } from "../../lib/utils";
import { BarChart3, Loader2 } from "lucide-react";

interface SkillMetricsCardProps {
  skillId: string;
}

export function SkillMetricsCard({ skillId }: SkillMetricsCardProps) {
  const { selectedCompanyId } = useCompany();

  const { data: metricsData, isLoading: metricsLoading } = useQuery({
    queryKey: queryKeys.evolution.skillMetrics(selectedCompanyId!, skillId),
    queryFn: () => evolutionApi.getSkillMetrics(selectedCompanyId!, skillId),
    enabled: !!selectedCompanyId,
  });

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const metrics = metricsData?.metrics ?? [];
  const agentMap = useMemo(
    () => new Map((agents ?? []).map((a) => [a.id, a.name])),
    [agents],
  );

  if (metricsLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span className="text-xs">Loading metrics...</span>
      </div>
    );
  }

  if (metrics.length === 0) {
    return (
      <div className="text-center py-4">
        <BarChart3 className="h-6 w-6 text-muted-foreground/20 mx-auto mb-1.5" />
        <p className="text-xs text-muted-foreground/60">No usage data yet.</p>
      </div>
    );
  }

  const totals = metrics.reduce(
    (acc, m) => ({
      applied: acc.applied + m.appliedCount,
      success: acc.success + m.successCount,
      failure: acc.failure + m.failureCount,
      tokens: acc.tokens + m.totalTokens,
    }),
    { applied: 0, success: 0, failure: 0, tokens: 0 },
  );

  const successRate = totals.applied > 0 ? Math.round((totals.success / totals.applied) * 100) : 0;
  const avgTokenDelta = totals.applied > 0 ? Math.round(totals.tokens / totals.applied) : 0;

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
        Agent Performance
      </p>

      <div className="space-y-1.5">
        {metrics.map((m) => {
          const agentName = agentMap.get(m.agentId) ?? m.agentId.slice(0, 8);
          const rate = m.appliedCount > 0 ? Math.round((m.successCount / m.appliedCount) * 100) : 0;

          return (
            <AgentRow
              key={m.id}
              agentName={agentName}
              version={m.skillVersion}
              successRate={rate}
              appliedCount={m.appliedCount}
            />
          );
        })}
      </div>

      <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-2 border-t border-border">
        <span>Applied: <strong className="text-foreground">{totals.applied}</strong> times</span>
        <span className="text-border">|</span>
        <span>Success: <strong className="text-foreground">{successRate}%</strong></span>
        <span className="text-border">|</span>
        <span>Avg tokens: <strong className="text-foreground">{avgTokenDelta > 0 ? `+${avgTokenDelta}` : avgTokenDelta}</strong></span>
      </div>
    </div>
  );
}

interface AgentRowProps {
  agentName: string;
  version: number;
  successRate: number;
  appliedCount: number;
}

function AgentRow({ agentName, version, successRate, appliedCount }: AgentRowProps) {
  const barWidth = Math.max(successRate, 2);

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-24 truncate text-foreground font-medium" title={agentName}>
        {agentName}
      </span>
      <span className="text-[10px] text-muted-foreground/60 w-6 text-right">v{version}</span>
      <span className="text-[10px] text-muted-foreground w-8 text-right">{successRate}%</span>
      <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            successRate >= 90
              ? "bg-emerald-500"
              : successRate >= 70
                ? "bg-amber-500"
                : "bg-red-500",
          )}
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground/50 w-8 text-right">
        {appliedCount}x
      </span>
    </div>
  );
}
