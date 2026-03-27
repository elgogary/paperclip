import { useQuery } from "@tanstack/react-query";
import { useCompany } from "../../context/CompanyContext";
import { swarmApi, type SwarmInstall } from "../../api/swarm";
import { cn } from "../../lib/utils";

const TYPE_META: Record<string, { label: string; icon: string; color: string }> = {
  skill: { label: "Skills", icon: "\u26A1", color: "text-purple-400 border-purple-500/30" },
  mcp: { label: "MCP Servers", icon: "\u{1F50C}", color: "text-blue-400 border-blue-500/30" },
  connector: { label: "Connectors", icon: "\u{1F517}", color: "text-emerald-400 border-emerald-500/30" },
  plugin: { label: "Plugins", icon: "\u{1F9E9}", color: "text-orange-400 border-orange-500/30" },
};

function InstallRow({ install }: { install: SwarmInstall }) {
  const statusColor =
    install.status === "active" ? "bg-emerald-500" : install.status === "flagged" ? "bg-red-500" : "bg-yellow-500";
  return (
    <tr className="hover:bg-accent/50">
      <td className="px-3 py-2.5 text-sm">
        <div className="font-medium">{install.name}</div>
        <div className="text-[11px] text-muted-foreground">
          {(install.metadata?.description as string) ?? ""}
        </div>
      </td>
      <td className="px-3 py-2.5 text-xs text-muted-foreground">{install.version ?? "-"}</td>
      <td className="px-3 py-2.5">
        <span
          className={cn(
            "text-[11px] font-bold",
            install.pricingTier === "free" ? "text-emerald-400" : "text-yellow-400",
          )}
        >
          {install.pricingTier === "free" ? "Free" : `$${install.priceMonthlyUsd}/mo`}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <span className="flex items-center gap-1.5">
          <span className={cn("w-1.5 h-1.5 rounded-full", statusColor)} />
          <span className="text-xs capitalize">{install.status}</span>
        </span>
      </td>
    </tr>
  );
}

export function SwarmMySwarm() {
  const { selectedCompanyId } = useCompany();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["swarm", "installs", selectedCompanyId],
    queryFn: () => swarmApi.listInstalls(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const installs = data?.installs ?? [];
  const grouped = installs.reduce<Record<string, SwarmInstall[]>>((acc, i) => {
    (acc[i.capabilityType] ??= []).push(i);
    return acc;
  }, {});

  const types = ["skill", "mcp", "connector", "plugin"];

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">Capability Swarm</h1>
          <p className="text-xs text-muted-foreground mt-1">
            A living, organized hub where agents learn, grow, and develop.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-5">
        {types.map((t) => {
          const meta = TYPE_META[t]!;
          const count = grouped[t]?.length ?? 0;
          return (
            <div key={t} className={cn("bg-card border rounded-lg p-3.5 border-l-[3px]", meta.color)}>
              <div className={cn("text-xl font-bold", meta.color.split(" ")[0]!)}>{count}</div>
              <div className="text-[11px] text-muted-foreground">{meta.label} installed</div>
            </div>
          );
        })}
      </div>

      {isError ? (
        <div className="text-center py-12 text-destructive text-sm">Failed to load installs. Please try again.</div>
      ) : isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading...</div>
      ) : installs.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-3xl opacity-30 mb-3">{"\u{1F41D}"}</div>
          <div className="text-sm font-semibold mb-1">No capabilities installed yet</div>
          <div className="text-xs text-muted-foreground">
            Browse the Catalog to discover and install capabilities.
          </div>
        </div>
      ) : (
        types
          .filter((t) => grouped[t]?.length)
          .map((t) => {
            const meta = TYPE_META[t]!;
            return (
              <div key={t} className="mb-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">{meta.icon}</span>
                  <span className="text-sm font-bold">{meta.label}</span>
                  <span className="text-[11px] text-muted-foreground">{grouped[t]!.length} installed</span>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-3 py-2">
                        Name
                      </th>
                      <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-3 py-2">
                        Version
                      </th>
                      <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-3 py-2">
                        Cost
                      </th>
                      <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-3 py-2">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {grouped[t]!.map((install) => (
                      <InstallRow key={install.id} install={install} />
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })
      )}
    </div>
  );
}
