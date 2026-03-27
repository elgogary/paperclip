import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "../../context/CompanyContext";
import { swarmApi, type SwarmCapability } from "../../api/swarm";
import { cn } from "../../lib/utils";

const TYPE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  skill: { bg: "bg-purple-500/10", text: "text-purple-400", label: "Skill" },
  mcp: { bg: "bg-blue-500/10", text: "text-blue-400", label: "MCP Server" },
  connector: { bg: "bg-emerald-500/10", text: "text-emerald-400", label: "Connector" },
  plugin: { bg: "bg-orange-500/10", text: "text-orange-400", label: "Plugin" },
};

const TRUST_COLORS: Record<string, { bg: string; text: string; label: string; icon: string }> = {
  trusted: { bg: "bg-emerald-500/15", text: "text-emerald-400", label: "Trusted", icon: "\u{1F512}" },
  verified: { bg: "bg-blue-500/15", text: "text-blue-400", label: "Verified", icon: "\u2714" },
  community: { bg: "bg-purple-500/15", text: "text-purple-400", label: "Community", icon: "\u{1F465}" },
  unknown: { bg: "bg-yellow-500/15", text: "text-yellow-400", label: "Unknown", icon: "\u26A0" },
};

const PRICE_COLORS: Record<string, { text: string }> = {
  free: { text: "text-emerald-400" },
  paid: { text: "text-yellow-400" },
  premium: { text: "text-orange-400" },
};

type FilterType = "all" | "skill" | "mcp" | "connector" | "plugin" | "free" | "paid";

function CapabilityCard({ cap }: { cap: SwarmCapability }) {
  const type = TYPE_COLORS[cap.capabilityType] ?? TYPE_COLORS.skill;
  const trust = TRUST_COLORS[cap.trustLevel] ?? TRUST_COLORS.community;
  const price = PRICE_COLORS[cap.pricingTier] ?? PRICE_COLORS.free;

  return (
    <div className="bg-card border border-border rounded-lg p-3.5 cursor-pointer transition-all hover:border-muted-foreground/40 hover:-translate-y-px relative">
      <div className="flex items-start gap-2.5 mb-2">
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0", type.bg, type.text)}>
          {cap.icon ?? "\u{1F4E6}"}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold leading-tight truncate">{cap.name}</div>
          <div className="text-[11px] text-muted-foreground truncate mt-0.5">
            {(cap.metadata?.sourceName as string) ?? "Unknown source"}
          </div>
        </div>
      </div>
      {cap.description && (
        <div className="text-xs text-muted-foreground leading-relaxed mb-2.5 line-clamp-2">{cap.description}</div>
      )}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", type.bg, type.text)}>
          {type.label}
        </span>
        <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1", trust.bg, trust.text)}>
          {trust.icon} {trust.label}
        </span>
        <span className={cn("text-[11px] font-bold ml-auto", price.text)}>
          {cap.pricingTier === "free" ? "Free" : `$${cap.priceMonthlyUsd}/mo`}
        </span>
      </div>
    </div>
  );
}

export function SwarmCatalog() {
  const { selectedCompanyId } = useCompany();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["swarm", "capabilities", selectedCompanyId, search],
    queryFn: () => swarmApi.listCapabilities(selectedCompanyId!, { search: search || undefined }),
    enabled: !!selectedCompanyId,
  });

  const capabilities = data?.capabilities ?? [];

  const filtered = capabilities.filter((cap) => {
    if (filter === "all") return true;
    if (filter === "free") return cap.pricingTier === "free";
    if (filter === "paid") return cap.pricingTier !== "free";
    return cap.capabilityType === filter;
  });

  const filters: { key: FilterType; label: string }[] = [
    { key: "all", label: "All" },
    { key: "skill", label: "Skills" },
    { key: "mcp", label: "MCP Servers" },
    { key: "connector", label: "Connectors" },
    { key: "plugin", label: "Plugins" },
    { key: "free", label: "Free" },
    { key: "paid", label: "Paid" },
  ];

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">Capability Catalog</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Browse and install skills, MCP servers, connectors, and plugins from all sources.
          </p>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <input
          className="flex-1 bg-card border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-muted-foreground/50"
          placeholder="Search capabilities..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="flex gap-1.5 mb-4 flex-wrap">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium border transition-all",
              filter === f.key
                ? "bg-foreground text-background border-foreground"
                : "bg-transparent text-muted-foreground border-border hover:border-muted-foreground/50 hover:text-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-3xl opacity-30 mb-3">{"\u{1F4E6}"}</div>
          <div className="text-sm font-semibold mb-1">No capabilities found</div>
          <div className="text-xs text-muted-foreground">
            Add sources to discover capabilities, or adjust your filters.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
          {filtered.map((cap) => (
            <CapabilityCard key={cap.id} cap={cap} />
          ))}
        </div>
      )}
    </div>
  );
}
