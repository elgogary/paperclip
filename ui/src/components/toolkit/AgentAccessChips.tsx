import { useQuery } from "@tanstack/react-query";
import { useCompany } from "../../context/CompanyContext";
import { agentsApi } from "../../api/agents";
import { queryKeys } from "../../lib/queryKeys";
import { cn } from "../../lib/utils";
import { Check } from "lucide-react";

interface AgentGrant {
  agentId: string;
  granted: boolean;
}

interface AgentAccessChipsProps {
  grants: AgentGrant[];
  onUpdate: (grants: AgentGrant[]) => void;
}

const AGENT_COLORS = [
  { bg: "rgba(168,85,247,.15)", fg: "#c084fc" },
  { bg: "rgba(59,130,246,.15)", fg: "#93c5fd" },
  { bg: "rgba(236,72,153,.15)", fg: "#f9a8d4" },
  { bg: "rgba(34,197,94,.15)", fg: "#86efac" },
  { bg: "rgba(251,191,36,.15)", fg: "#fcd34d" },
  { bg: "rgba(249,115,22,.15)", fg: "#fdba74" },
  { bg: "rgba(6,182,212,.15)", fg: "#67e8f9" },
  { bg: "rgba(99,102,241,.15)", fg: "#a5b4fc" },
];

function getInitials(name: string): string {
  return name
    .split(/[\s-]+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getColor(index: number) {
  return AGENT_COLORS[index % AGENT_COLORS.length]!;
}

export function AgentAccessChips({ grants, onUpdate }: AgentAccessChipsProps) {
  const { selectedCompanyId } = useCompany();

  const { data: agents = [] } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  function toggleGrant(agentId: string) {
    const updated = grants.map((g) =>
      g.agentId === agentId ? { ...g, granted: !g.granted } : g,
    );
    // Add agents not yet in grants
    if (!updated.find((g) => g.agentId === agentId)) {
      updated.push({ agentId, granted: true });
    }
    onUpdate(updated);
  }

  const activeAgents = agents.filter((a) => a.status !== "terminated");

  return (
    <div className="flex flex-wrap gap-1.5">
      {activeAgents.map((agent, i) => {
        const grant = grants.find((g) => g.agentId === agent.id);
        const isGranted = grant?.granted ?? false;
        const color = getColor(i);

        return (
          <button
            key={agent.id}
            type="button"
            onClick={() => toggleGrant(agent.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors cursor-pointer",
              isGranted
                ? "border-emerald-500/50 bg-emerald-500/8"
                : "border-border hover:border-emerald-500/40",
            )}
          >
            <span
              className="flex h-5 w-5 items-center justify-center rounded text-[9px] font-semibold shrink-0"
              style={{ background: color.bg, color: color.fg }}
            >
              {agent.icon ?? getInitials(agent.name)}
            </span>
            <span className="text-foreground">{agent.name}</span>
            <span
              className={cn(
                "flex h-3.5 w-3.5 items-center justify-center rounded-sm border text-[9px]",
                isGranted
                  ? "border-emerald-500 text-emerald-500 bg-emerald-500/15"
                  : "border-border",
              )}
            >
              {isGranted && <Check className="h-2.5 w-2.5" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
