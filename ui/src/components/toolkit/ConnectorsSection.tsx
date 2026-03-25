import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../../context/CompanyContext";
import { connectorsApi, type Connector } from "../../api/connectors";
import { queryKeys } from "../../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { cn } from "../../lib/utils";
import { Search, CheckCircle2, AlertTriangle, Plus } from "lucide-react";

type Filter = "all" | "connected" | "pending";

const CONNECTOR_ICONS: Record<string, { icon: string; bg: string }> = {
  gmail: { icon: "\u{1F4E7}", bg: "rgba(239,68,68,.1)" },
  "google-calendar": { icon: "\u{1F4C5}", bg: "rgba(59,130,246,.1)" },
  "google-sheets": { icon: "\u{1F4C4}", bg: "rgba(34,197,94,.1)" },
  "slack-oauth": { icon: "\u{1F4AC}", bg: "rgba(168,85,247,.1)" },
  notion: { icon: "\u{1F4DD}", bg: "rgba(99,102,241,.1)" },
  jira: { icon: "\u{1F3AF}", bg: "rgba(59,130,246,.1)" },
};

// TODO: replace with real connectors API
const MOCK_CONNECTORS = [
  { id: "mock-gmail", name: "Gmail", slug: "gmail", provider: "google", status: "needs_auth", description: "Read, send, and manage emails" },
  { id: "mock-gcal", name: "Google Calendar", slug: "google-calendar", provider: "google", status: "needs_auth", description: "View and create calendar events" },
  { id: "mock-gsheets", name: "Google Sheets", slug: "google-sheets", provider: "google", status: "connected", description: "Read and write spreadsheet data" },
  { id: "mock-slack", name: "Slack OAuth", slug: "slack-oauth", provider: "slack", status: "connected", description: "Full workspace access via OAuth" },
  { id: "mock-notion", name: "Notion", slug: "notion", provider: "notion", status: "coming_soon", description: "Access pages, databases, and blocks" },
  { id: "mock-jira", name: "Jira", slug: "jira", provider: "atlassian", status: "coming_soon", description: "Track issues and sprints" },
];

function getStatusInfo(status: string) {
  switch (status) {
    case "connected":
      return { label: "Connected", color: "text-emerald-400", icon: "\u{2713}" };
    case "needs_auth":
      return { label: "Needs Auth", color: "text-amber-400", icon: "\u{26A0}" };
    case "coming_soon":
      return { label: "Coming soon", color: "text-muted-foreground", icon: "\u{23F3}" };
    default:
      return { label: status, color: "text-muted-foreground", icon: "" };
  }
}

export function ConnectorsSection() {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const { data: connectorsData, isLoading, isError } = useQuery({
    queryKey: queryKeys.connectors.list(selectedCompanyId!),
    queryFn: () => connectorsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const realConnectors: Connector[] = connectorsData?.connectors ?? [];

  // Merge real connectors with mock data for display
  const allConnectors = useMemo(() => {
    const realSlugs = new Set(realConnectors.map((c) => c.slug));
    const merged = realConnectors.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      status: c.status,
      description: MOCK_CONNECTORS.find((m) => m.slug === c.slug)?.description ?? "OAuth connector",
    }));
    MOCK_CONNECTORS.forEach((m) => {
      if (!realSlugs.has(m.slug)) {
        merged.push(m);
      }
    });
    return merged;
  }, [realConnectors]);

  const disconnect = useMutation({
    mutationFn: (connectorId: string) => connectorsApi.disconnect(selectedCompanyId!, connectorId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.connectors.list(selectedCompanyId!) }),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allConnectors.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q)) return false;
      if (filter === "connected" && c.status !== "connected") return false;
      if (filter === "pending" && c.status !== "needs_auth") return false;
      return true;
    });
  }, [allConnectors, search, filter]);

  const connectedCount = allConnectors.filter((c) => c.status === "connected").length;
  const needsAuthCount = allConnectors.filter((c) => c.status === "needs_auth").length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between px-5 py-3.5 border-b border-border shrink-0">
        <div>
          <h2 className="text-xl font-bold">Connectors</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            OAuth-based integrations — click Connect to authorize, no API keys needed
          </p>
        </div>
        <Button size="sm">
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Browse Connectors
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-lg border border-border bg-card p-3.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xl font-bold">{connectedCount}</p>
                <p className="text-[11px] text-muted-foreground">Connected</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-3.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xl font-bold">{needsAuthCount}</p>
                <p className="text-[11px] text-muted-foreground">Needs Auth</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
          </div>
        </div>

        {/* Search + Filters */}
        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search connectors..."
              aria-label="Search connectors"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-md border border-border bg-card text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
            />
          </div>
          {(["all", "connected", "pending"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors capitalize",
                filter === f
                  ? "bg-accent text-foreground border-foreground/20"
                  : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {f === "all" ? "All" : f === "connected" ? "Connected" : "Pending"}
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <div className="animate-spin h-5 w-5 border-2 border-foreground/20 border-t-foreground rounded-full mr-3" />
            Loading connectors...
          </div>
        )}
        {isError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Failed to load connectors. Check your connection and try again.
          </div>
        )}

        {!isLoading && !isError && <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((connector) => {
            const iconInfo = CONNECTOR_ICONS[connector.slug] ?? { icon: "\u{1F517}", bg: "rgba(99,102,241,.1)" };
            const statusInfo = getStatusInfo(connector.status);

            return (
              <div
                key={connector.id}
                className="rounded-lg border border-border bg-card p-4 flex items-center gap-3.5"
              >
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-xl shrink-0"
                  style={{ background: iconInfo.bg }}
                >
                  {iconInfo.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{connector.name}</p>
                  <p className="text-[11px] text-muted-foreground">{connector.description}</p>
                  <p className={cn("text-[11px] mt-1", statusInfo.color)}>
                    {statusInfo.icon} {statusInfo.label}
                  </p>
                </div>
                {connector.status === "needs_auth" && (
                  <Button size="sm" className="shrink-0">Connect</Button>
                )}
                {connector.status === "connected" && (
                  <Button variant="outline" size="sm" className="shrink-0">Manage</Button>
                )}
                {connector.status === "coming_soon" && (
                  <span className="text-xs text-muted-foreground shrink-0">Soon</span>
                )}
              </div>
            );
          })}
        </div>}

        {!isLoading && !isError && filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-12">No connectors match the current filter.</p>
        )}
      </div>
    </div>
  );
}
