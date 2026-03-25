import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../../context/CompanyContext";
import { toolkitPluginsApi as pluginsApi, type Plugin } from "../../api/plugins";
import { queryKeys } from "../../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { PluginDetailDrawer } from "./PluginDetailDrawer";
import { cn } from "../../lib/utils";
import { useToast } from "../../context/ToastContext";
import { Search, Wrench, CheckCircle2, Trash2 } from "lucide-react";

const PLUGIN_ICONS: Record<string, { icon: string; bg: string }> = {
  context7: { icon: "\u{1F4DA}", bg: "rgba(99,102,241,.1)" },
  serena: { icon: "\u{1F3AF}", bg: "rgba(168,85,247,.1)" },
  "sanad-brain": { icon: "\u{1F9E0}", bg: "rgba(6,182,212,.1)" },
  stitch: { icon: "\u{2702}", bg: "rgba(236,72,153,.1)" },
  infisical: { icon: "\u{1F512}", bg: "rgba(34,197,94,.1)" },
};

export function PluginsSection() {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const [search, setSearch] = useState("");
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { data: pluginsData, isLoading, isError } = useQuery({
    queryKey: queryKeys.plugins.list(selectedCompanyId!),
    queryFn: () => pluginsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const plugins: Plugin[] = pluginsData?.plugins ?? [];

  const togglePlugin = useMutation({
    mutationFn: (plugin: Plugin) =>
      pluginsApi.update(selectedCompanyId!, plugin.id, { enabled: !plugin.enabled }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.plugins.list(selectedCompanyId!) }),
  });

  const testPlugin = useMutation({
    mutationFn: (pluginId: string) => pluginsApi.test(selectedCompanyId!, pluginId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plugins.list(selectedCompanyId!) });
      pushToast({ title: "Plugin test passed", tone: "success" });
    },
    onError: () => {
      pushToast({ title: "Plugin test failed", body: "Plugin did not respond or returned an error.", tone: "error" });
    },
  });

  const deletePlugin = useMutation({
    mutationFn: (pluginId: string) => pluginsApi.remove(selectedCompanyId!, pluginId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.plugins.list(selectedCompanyId!) }),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return plugins.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q) && !(p.description ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [plugins, search]);

  const activeCount = plugins.filter((p) => p.enabled).length;
  const totalTools = plugins.reduce((acc, p) => acc + (p.toolCount ?? 0), 0);

  function openConfigure(plugin: Plugin) {
    setSelectedPlugin(plugin);
    setDetailOpen(true);
  }

  function getIcon(plugin: Plugin) {
    const info = PLUGIN_ICONS[plugin.slug] ?? PLUGIN_ICONS[plugin.name.toLowerCase()];
    return info ?? { icon: plugin.icon ?? "\u{1F9E9}", bg: "rgba(99,102,241,.1)" };
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between px-5 py-3.5 border-b border-border shrink-0">
        <div>
          <h2 className="text-xl font-bold">Plugins</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Dynamic MCP plugins auto-discovered at runtime — extend agent capabilities
          </p>
        </div>
        <span className="text-xs text-muted-foreground italic">Auto-discovered from MCP config</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-lg border border-border bg-card p-3.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xl font-bold">{activeCount}</p>
                <p className="text-[11px] text-muted-foreground">Active Plugins</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-3.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xl font-bold">{totalTools}</p>
                <p className="text-[11px] text-muted-foreground">Tools Provided</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                <Wrench className="h-4 w-4" />
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search plugins..."
              aria-label="Search plugins"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-md border border-border bg-card text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <div className="animate-spin h-5 w-5 border-2 border-foreground/20 border-t-foreground rounded-full mr-3" />
            Loading plugins...
          </div>
        )}
        {isError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Failed to load plugins. Check your connection and try again.
          </div>
        )}

        {!isLoading && !isError && <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((plugin) => {
            const iconInfo = getIcon(plugin);

            return (
              <div key={plugin.id} className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-foreground/20">
                <div className="flex items-center gap-2.5 mb-2">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-base shrink-0"
                    style={{ background: iconInfo.bg }}
                  >
                    {iconInfo.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold truncate">{plugin.name}</p>
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full shrink-0",
                          plugin.healthStatus === "healthy" && "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,.4)]",
                          plugin.healthStatus === "unhealthy" && "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,.4)]",
                          (!plugin.healthStatus || plugin.healthStatus === "unknown") && "bg-muted-foreground/40",
                        )}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground font-mono truncate">
                      {plugin.slug}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => togglePlugin.mutate(plugin)}
                    aria-label={`${plugin.enabled ? "Disable" : "Enable"} ${plugin.name}`}
                    className={cn(
                      "relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0",
                      plugin.enabled ? "bg-emerald-500" : "bg-muted",
                    )}
                  >
                    <span className={cn(
                      "inline-block h-4 w-4 rounded-full bg-white transition-transform",
                      plugin.enabled ? "translate-x-4" : "translate-x-0.5",
                    )} />
                  </button>
                </div>

                {plugin.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{plugin.description}</p>
                )}

                <div className="flex gap-3 text-[11px] text-muted-foreground mb-2">
                  <span>Tools: {plugin.toolCount ?? 0}</span>
                </div>

                <div className="flex gap-1.5 pt-2.5 border-t border-border mt-2">
                  <Button variant="outline" size="sm" className="h-6 text-xs" onClick={() => openConfigure(plugin)}>
                    Configure
                  </Button>
                  <Button variant="outline" size="sm" className="h-6 text-xs" onClick={() => testPlugin.mutate(plugin.id)}>
                    Test
                  </Button>
                  <div className="flex-1" />
                  <button
                    onClick={() => { if (window.confirm("Delete this plugin? This cannot be undone.")) deletePlugin.mutate(plugin.id); }}
                    aria-label={`Delete ${plugin.name}`}
                    className="flex h-6 w-6 items-center justify-center rounded border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>}

        {!isLoading && !isError && plugins.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-12">No plugins installed. Plugins are auto-discovered from your MCP configuration.</p>
        )}
        {!isLoading && !isError && plugins.length > 0 && filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-12">No plugins match the current filter.</p>
        )}
      </div>

      {/* Detail Drawer */}
      <PluginDetailDrawer
        open={detailOpen}
        onClose={() => { setDetailOpen(false); setSelectedPlugin(null); }}
        plugin={selectedPlugin}
      />
    </div>
  );
}
