import { useQuery } from "@tanstack/react-query";
import { useCompany } from "../../context/CompanyContext";
import { swarmApi } from "../../api/swarm";
import { cn } from "../../lib/utils";

const TRUST_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  trusted: { bg: "bg-emerald-500/15", text: "text-emerald-400", label: "Trusted" },
  verified: { bg: "bg-blue-500/15", text: "text-blue-400", label: "Verified" },
  community: { bg: "bg-purple-500/15", text: "text-purple-400", label: "Community" },
  unknown: { bg: "bg-yellow-500/15", text: "text-yellow-400", label: "Unknown" },
};

export function SwarmSources() {
  const { selectedCompanyId } = useCompany();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["swarm", "sources", selectedCompanyId],
    queryFn: () => swarmApi.listSources(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const sources = data?.sources ?? [];

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">Swarm Sources</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Manage registries and repositories the swarm pulls capabilities from.
          </p>
        </div>
      </div>

      {isError ? (
        <div className="text-center py-12 text-destructive text-sm">Failed to load sources. Please try again.</div>
      ) : isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading...</div>
      ) : sources.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-3xl opacity-30 mb-3">{"\u{1F517}"}</div>
          <div className="text-sm font-semibold mb-1">No sources configured</div>
          <div className="text-xs text-muted-foreground">Add a source to start discovering capabilities.</div>
        </div>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-3 py-2">
                Source
              </th>
              <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-3 py-2">
                Type
              </th>
              <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-3 py-2">
                Trust Level
              </th>
              <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-3 py-2">
                Capabilities
              </th>
              <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-3 py-2">
                Last Sync
              </th>
              <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-3 py-2">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => {
              const trust = TRUST_STYLES[s.trustLevel] ?? TRUST_STYLES.community;
              const statusDot =
                s.lastSyncStatus === "success"
                  ? "bg-emerald-500"
                  : s.lastSyncStatus === "error"
                    ? "bg-red-500"
                    : "bg-yellow-500";
              return (
                <tr key={s.id} className="border-b border-border/50 hover:bg-accent/50">
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-sm">{s.name}</div>
                    <div className="text-[11px] text-muted-foreground">{s.url}</div>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground capitalize">
                    {s.sourceType.replace(/_/g, " ")}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", trust.bg, trust.text)}>
                      {trust.label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-sm">{s.capabilityCount}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {s.lastSyncAt ? new Date(s.lastSyncAt).toLocaleDateString() : "Never"}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-1.5">
                      <span className={cn("w-1.5 h-1.5 rounded-full", statusDot)} />
                      <span className="text-xs capitalize">{s.lastSyncStatus ?? "Pending"}</span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
