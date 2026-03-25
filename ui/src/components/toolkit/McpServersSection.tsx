import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../../context/CompanyContext";
import { mcpServersApi, type McpServerConfig } from "../../api/mcp-servers";
import { queryKeys } from "../../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { McpDetailDrawer } from "./McpDetailDrawer";
import { McpLogsDrawer } from "./McpLogsDrawer";
import { McpMarketplaceModal } from "./McpMarketplaceModal";
import { cn } from "../../lib/utils";
import {
  Plus, Search, LayoutGrid, List, ShoppingCart,
  Wrench, CheckCircle2, AlertTriangle, Trash2,
} from "lucide-react";

type ViewMode = "cards" | "list";
type Filter = "all" | "outbound" | "inbound";

const DIRECTION_BADGE: Record<string, string> = {
  outbound: "bg-blue-500/12 text-blue-300",
  inbound: "bg-purple-500/12 text-purple-300",
  both: "bg-cyan-500/12 text-cyan-300",
};

const SERVER_ICONS: Record<string, string> = {
  github: "\u{1F4BB}",
  slack: "\u{1F4AC}",
  postgresql: "\u{1F4BE}",
  postgres: "\u{1F4BE}",
  "brave-search": "\u{1F50D}",
  "brave search": "\u{1F50D}",
};

export function McpServersSection() {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [selectedServer, setSelectedServer] = useState<McpServerConfig | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [logsServer, setLogsServer] = useState<string | null>(null);
  const [logsOpen, setLogsOpen] = useState(false);
  const [marketplaceOpen, setMarketplaceOpen] = useState(false);

  const { data: serversData } = useQuery({
    queryKey: queryKeys.mcpServers.list(selectedCompanyId!),
    queryFn: () => mcpServersApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const servers: McpServerConfig[] = serversData?.servers ?? [];

  const toggleServer = useMutation({
    mutationFn: (server: McpServerConfig) => mcpServersApi.toggle(selectedCompanyId!, server.id, !server.enabled),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.mcpServers.list(selectedCompanyId!) }),
  });

  const testServer = useMutation({
    mutationFn: (serverId: string) => mcpServersApi.test(selectedCompanyId!, serverId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.mcpServers.list(selectedCompanyId!) }),
  });

  const deleteServer = useMutation({
    mutationFn: (serverId: string) => mcpServersApi.remove(selectedCompanyId!, serverId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.mcpServers.list(selectedCompanyId!) }),
  });

  const installFromCatalog = useMutation({
    mutationFn: (catalogId: string) => mcpServersApi.installFromCatalog(selectedCompanyId!, catalogId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mcpServers.list(selectedCompanyId!) });
      setMarketplaceOpen(false);
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return servers.filter((s) => {
      if (q && !s.name.toLowerCase().includes(q) && !s.slug.toLowerCase().includes(q)) return false;
      if (filter === "outbound" && s.direction !== "outbound") return false;
      if (filter === "inbound" && s.direction !== "inbound") return false;
      return true;
    });
  }, [servers, search, filter]);

  const healthyCount = servers.filter((s) => s.healthStatus === "healthy").length;
  const unhealthyCount = servers.filter((s) => s.healthStatus === "unhealthy").length;
  const toolCount = servers.reduce((acc, s) => {
    const cfg = s.configJson as Record<string, unknown> | null;
    const count = typeof cfg?.toolCount === "number" ? cfg.toolCount : 0;
    return acc + count;
  }, 0);

  function openConfigure(server: McpServerConfig) {
    setSelectedServer(server);
    setDetailOpen(true);
  }

  function openLogs(server: McpServerConfig) {
    setLogsServer(server.name);
    setLogsOpen(true);
  }

  function getIcon(server: McpServerConfig) {
    return SERVER_ICONS[server.slug.toLowerCase()] ?? SERVER_ICONS[server.name.toLowerCase()] ?? "\u{1F50C}";
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between px-5 py-3.5 border-b border-border shrink-0">
        <div>
          <h2 className="text-xl font-bold">MCP Servers</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Connect external tool servers for your agents via Model Context Protocol
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setMarketplaceOpen(true)}>
            <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
            Marketplace
          </Button>
          <Button size="sm">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Server
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="rounded-lg border border-border bg-card p-3.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xl font-bold">{healthyCount}</p>
                <p className="text-[11px] text-muted-foreground">Healthy</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-3.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xl font-bold">{unhealthyCount}</p>
                <p className="text-[11px] text-muted-foreground">Unhealthy</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/10 text-red-400">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-3.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xl font-bold">{toolCount}</p>
                <p className="text-[11px] text-muted-foreground">Tools</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                <Wrench className="h-4 w-4" />
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-3.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xl font-bold">{servers.length}</p>
                <p className="text-[11px] text-muted-foreground">Servers</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400">
                <Wrench className="h-4 w-4" />
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
              placeholder="Search servers..."
              aria-label="Search servers"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-md border border-border bg-card text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
            />
          </div>
          {(["all", "outbound", "inbound"] as Filter[]).map((f) => (
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
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-0.5 rounded-md border border-border p-0.5">
            <button
              onClick={() => setViewMode("cards")}
              aria-label="Card view"
              className={cn(
                "rounded p-1 transition-colors",
                viewMode === "cards" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              aria-label="List view"
              className={cn(
                "rounded p-1 transition-colors",
                viewMode === "list" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Card View */}
        {viewMode === "cards" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map((server) => (
              <div
                key={server.id}
                className={cn(
                  "rounded-lg border bg-card p-4 transition-colors hover:border-foreground/20",
                  server.healthStatus === "unhealthy" && "border-red-500/30",
                  server.healthStatus !== "unhealthy" && "border-border",
                )}
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-base shrink-0">
                    {getIcon(server)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold truncate">{server.name}</p>
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full shrink-0",
                          server.healthStatus === "healthy" && "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,.4)]",
                          server.healthStatus === "unhealthy" && "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,.4)]",
                          (!server.healthStatus || server.healthStatus === "unknown") && "bg-muted-foreground/40",
                        )}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground font-mono truncate">{server.slug}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleServer.mutate(server)}
                    aria-label={`${server.enabled ? "Disable" : "Enable"} ${server.name}`}
                    className={cn(
                      "relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0",
                      server.enabled ? "bg-emerald-500" : "bg-muted",
                    )}
                  >
                    <span className={cn(
                      "inline-block h-4 w-4 rounded-full bg-white transition-transform",
                      server.enabled ? "translate-x-4" : "translate-x-0.5",
                    )} />
                  </button>
                </div>

                {server.healthStatus === "unhealthy" && (
                  <div className="rounded bg-red-500/8 border border-red-500/20 px-2.5 py-1.5 mb-2 text-[11px] text-red-400">
                    Connection error. Last checked {server.lastHealthCheck ? "recently" : "never"}.
                  </div>
                )}

                <div className="flex gap-3 text-[11px] text-muted-foreground mb-2">
                  <span className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                    DIRECTION_BADGE[server.direction] ?? "bg-muted text-muted-foreground",
                  )}>
                    {server.direction?.charAt(0).toUpperCase() + (server.direction?.slice(1) ?? "")}
                  </span>
                  <span>Tools: {(typeof (server.configJson as Record<string, unknown> | null)?.toolCount === "number" ? (server.configJson as Record<string, unknown>).toolCount as number : "?")}</span>
                </div>

                <div className="flex gap-1.5 pt-2.5 border-t border-border mt-2">
                  <Button variant="outline" size="sm" className="h-6 text-xs" onClick={() => openConfigure(server)}>
                    Configure
                  </Button>
                  <Button variant="outline" size="sm" className="h-6 text-xs" onClick={() => testServer.mutate(server.id)}>
                    Test
                  </Button>
                  <Button variant="outline" size="sm" className="h-6 text-xs" onClick={() => openLogs(server)}>
                    Logs
                  </Button>
                  <div className="flex-1" />
                  <button
                    onClick={() => { if (window.confirm("Delete this server? This cannot be undone.")) deleteServer.mutate(server.id); }}
                    aria-label={`Delete ${server.name}`}
                    className="flex h-6 w-6 items-center justify-center rounded border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* List View */
          <div className="min-w-full">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-10 bg-background">
                <tr className="border-b border-border">
                  <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-3 py-2">Server</th>
                  <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-3 py-2 w-20">Health</th>
                  <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-3 py-2 w-24">Direction</th>
                  <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-3 py-2 w-16">Tools</th>
                  <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-3 py-2 w-20">Enabled</th>
                  <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-3 py-2 w-32">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((server) => (
                  <tr
                    key={server.id}
                    className={cn(
                      "border-b border-border hover:bg-accent/50 transition-colors",
                      server.healthStatus === "unhealthy" && "bg-red-500/3",
                    )}
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-xs shrink-0">
                          {getIcon(server)}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{server.name}</p>
                          <p className="text-[11px] text-muted-foreground font-mono">{server.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full inline-block",
                          server.healthStatus === "healthy" && "bg-emerald-500",
                          server.healthStatus === "unhealthy" && "bg-red-500",
                          (!server.healthStatus || server.healthStatus === "unknown") && "bg-muted-foreground/40",
                        )}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                        DIRECTION_BADGE[server.direction] ?? "bg-muted text-muted-foreground",
                      )}>
                        {server.direction === "outbound" ? "Out" : server.direction === "inbound" ? "In" : "Both"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {(typeof (server.configJson as Record<string, unknown> | null)?.toolCount === "number" ? (server.configJson as Record<string, unknown>).toolCount as number : "?")}
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => toggleServer.mutate(server)}
                        aria-label={`${server.enabled ? "Disable" : "Enable"} ${server.name}`}
                        className={cn(
                          "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                          server.enabled ? "bg-emerald-500" : "bg-muted",
                        )}
                      >
                        <span className={cn(
                          "inline-block h-4 w-4 rounded-full bg-white transition-transform",
                          server.enabled ? "translate-x-4" : "translate-x-0.5",
                        )} />
                      </button>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" className="h-6 text-xs" onClick={() => testServer.mutate(server.id)}>
                          Test
                        </Button>
                        <Button variant="outline" size="sm" className="h-6 text-xs" onClick={() => openLogs(server)}>
                          Logs
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-12">No servers match the current filter.</p>
        )}
      </div>

      {/* Drawers & Modals */}
      <McpDetailDrawer
        open={detailOpen}
        onClose={() => { setDetailOpen(false); setSelectedServer(null); }}
        server={selectedServer}
      />
      <McpLogsDrawer
        open={logsOpen}
        onClose={() => { setLogsOpen(false); setLogsServer(null); }}
        serverName={logsServer}
      />
      <McpMarketplaceModal
        open={marketplaceOpen}
        onClose={() => setMarketplaceOpen(false)}
        installedSlugs={servers.map((s) => s.catalogId).filter(Boolean) as string[]}
        onInstall={(catalogId) => installFromCatalog.mutate(catalogId)}
      />
    </div>
  );
}
