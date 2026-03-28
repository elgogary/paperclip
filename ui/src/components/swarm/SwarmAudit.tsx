import { useQuery } from "@tanstack/react-query";
import { useCompany } from "../../context/CompanyContext";
import { swarmApi, type SwarmAuditEntry } from "../../api/swarm";
import { cn } from "../../lib/utils";

const ACTION_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  install: { bg: "bg-emerald-500/15", text: "text-emerald-400", icon: "\u2713" },
  remove: { bg: "bg-red-500/15", text: "text-red-400", icon: "\u2717" },
  approve: { bg: "bg-blue-500/15", text: "text-blue-400", icon: "\u{1F44D}" },
  deny: { bg: "bg-yellow-500/15", text: "text-yellow-400", icon: "\u270B" },
  sync: { bg: "bg-purple-500/15", text: "text-purple-400", icon: "\u{1F504}" },
  source_added: { bg: "bg-blue-500/15", text: "text-blue-400", icon: "+" },
  source_removed: { bg: "bg-red-500/15", text: "text-red-400", icon: "-" },
};

function AuditRow({ entry }: { entry: SwarmAuditEntry }) {
  const style = ACTION_STYLES[entry.action] ?? ACTION_STYLES.sync;
  const time = new Date(entry.createdAt);
  const timeStr =
    time.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " " +
    time.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex gap-3 py-2.5 border-b border-border/50">
      <div className="w-[120px] shrink-0 text-[11px] text-muted-foreground pt-0.5">{timeStr}</div>
      <div className={cn("w-7 h-7 rounded-md flex items-center justify-center text-sm shrink-0", style.bg, style.text)}>
        {style.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">
          {entry.capabilityName && <strong>{entry.capabilityName}</strong>} {entry.action.replace(/_/g, " ")}
        </div>
        {entry.detail && <div className="text-xs text-muted-foreground mt-0.5">{entry.detail}</div>}
      </div>
    </div>
  );
}

export function SwarmAudit() {
  const { selectedCompanyId } = useCompany();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["swarm", "audit", selectedCompanyId],
    queryFn: () => swarmApi.listAudit(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const entries = data?.entries ?? [];

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">Audit Log</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Complete history of all capability installations, removals, and approvals.
          </p>
        </div>
      </div>

      {isError ? (
        <div className="text-center py-12 text-destructive text-sm">Failed to load audit log. Please try again.</div>
      ) : isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading...</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-3xl opacity-30 mb-3">{"\u{1F4DC}"}</div>
          <div className="text-sm font-semibold mb-1">No audit entries yet</div>
          <div className="text-xs text-muted-foreground">Swarm operations will be logged here.</div>
        </div>
      ) : (
        <div className="flex flex-col">
          {entries.map((entry) => (
            <AuditRow key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
