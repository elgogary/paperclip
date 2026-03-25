import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../../context/CompanyContext";
import { mcpServersApi, type McpServerConfig } from "../../api/mcp-servers";
import { queryKeys } from "../../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { McpDetailDrawer } from "./McpDetailDrawer";
import { McpLogsDrawer } from "./McpLogsDrawer";
import { McpMarketplaceModal } from "./McpMarketplaceModal";
import { McpServerCardGrid, McpServerListTable } from "./McpServerTable";
import { cn } from "../../lib/utils";
import { useToast } from "../../context/ToastContext";
import {
  Plus, Search, LayoutGrid, List, ShoppingCart,
  Wrench, CheckCircle2, AlertTriangle,
} from "lucide-react";

function getToolCount(server: McpServerConfig): number | "?" {
  const cfg = server.configJson as Record<string, unknown> | null;
  return typeof cfg?.toolCount === "number" ? cfg.toolCount : "?";
}

type ViewMode = "cards" | "list";
type Filter = "all" | "outbound" | "inbound";

export function McpServersSection() {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [selectedServer, setSelectedServer] = useState<McpServerConfig | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [logsServer, setLogsServer] = useState<string | null>(null);
  const [logsOpen, setLogsOpen] = useState(false);
  const [marketplaceOpen, setMarketplaceOpen] = useState(false);

  const { data: serversData, isLoading, isError } = useQuery({
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mcpServers.list(selectedCompanyId!) });
      pushToast({ title: "Connection test passed", tone: "success" });
    },
    onError: () => {
      pushToast({ title: "Connection test failed", body: "Server did not respond or returned an error.", tone: "error" });
    },
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

  const { healthyCount, unhealthyCount, toolCount } = useMemo(() => {
    let healthy = 0;
    let unhealthy = 0;
    let tools = 0;
    for (const s of servers) {
      if (s.healthStatus === "healthy") healthy++;
      if (s.healthStatus === "unhealthy") unhealthy++;
      const tc = getToolCount(s);
      if (typeof tc === "number") tools += tc;
    }
    return { healthyCount: healthy, unhealthyCount: unhealthy, toolCount: tools };
  }, [servers]);

  function openConfigure(server: McpServerConfig) {
    setSelectedServer(server);
    setDetailOpen(true);
  }

  function openLogs(server: McpServerConfig) {
    setLogsServer(server.name);
    setLogsOpen(true);
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

        {isLoading && (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <div className="animate-spin h-5 w-5 border-2 border-foreground/20 border-t-foreground rounded-full mr-3" />
            Loading servers...
          </div>
        )}
        {isError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Failed to load MCP servers. Check your connection and try again.
          </div>
        )}

        {!isLoading && !isError && viewMode === "cards" ? (
          <McpServerCardGrid
            servers={filtered}
            onToggle={(s) => toggleServer.mutate(s)}
            onTest={(id) => testServer.mutate(id)}
            onConfigure={openConfigure}
            onLogs={openLogs}
            onDelete={(id) => deleteServer.mutate(id)}
          />
        ) : !isLoading && !isError ? (
          <McpServerListTable
            servers={filtered}
            onToggle={(s) => toggleServer.mutate(s)}
            onTest={(id) => testServer.mutate(id)}
            onLogs={openLogs}
          />
        ) : null}

        {!isLoading && !isError && servers.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-12">No MCP servers connected. Add one from the marketplace or configure manually.</p>
        )}
        {!isLoading && !isError && servers.length > 0 && filtered.length === 0 && (
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
