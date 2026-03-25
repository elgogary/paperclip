import { cn } from "../../lib/utils";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import type { McpServerConfig } from "../../api/mcp-servers";

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

function getToolCount(server: McpServerConfig): number | "?" {
  const cfg = server.configJson as Record<string, unknown> | null;
  return typeof cfg?.toolCount === "number" ? cfg.toolCount : "?";
}

function getIcon(server: McpServerConfig): string {
  return SERVER_ICONS[server.slug.toLowerCase()] ?? SERVER_ICONS[server.name.toLowerCase()] ?? "\u{1F50C}";
}

interface McpServerCardGridProps {
  servers: McpServerConfig[];
  onToggle: (server: McpServerConfig) => void;
  onTest: (serverId: string) => void;
  onConfigure: (server: McpServerConfig) => void;
  onLogs: (server: McpServerConfig) => void;
  onDelete: (serverId: string) => void;
}

export function McpServerCardGrid({ servers, onToggle, onTest, onConfigure, onLogs, onDelete }: McpServerCardGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {servers.map((server) => (
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
              onClick={() => onToggle(server)}
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
            <span>Tools: {getToolCount(server)}</span>
          </div>

          <div className="flex gap-1.5 pt-2.5 border-t border-border mt-2">
            <Button variant="outline" size="sm" className="h-6 text-xs" onClick={() => onConfigure(server)}>
              Configure
            </Button>
            <Button variant="outline" size="sm" className="h-6 text-xs" onClick={() => onTest(server.id)}>
              Test
            </Button>
            <Button variant="outline" size="sm" className="h-6 text-xs" onClick={() => onLogs(server)}>
              Logs
            </Button>
            <div className="flex-1" />
            <button
              onClick={() => { if (window.confirm("Delete this server? This cannot be undone.")) onDelete(server.id); }}
              aria-label={`Delete ${server.name}`}
              className="flex h-6 w-6 items-center justify-center rounded border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

interface McpServerListTableProps {
  servers: McpServerConfig[];
  onToggle: (server: McpServerConfig) => void;
  onTest: (serverId: string) => void;
  onLogs: (server: McpServerConfig) => void;
}

export function McpServerListTable({ servers, onToggle, onTest, onLogs }: McpServerListTableProps) {
  return (
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
          {servers.map((server) => (
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
                {getToolCount(server)}
              </td>
              <td className="px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => onToggle(server)}
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
                  <Button variant="outline" size="sm" className="h-6 text-xs" onClick={() => onTest(server.id)}>
                    Test
                  </Button>
                  <Button variant="outline" size="sm" className="h-6 text-xs" onClick={() => onLogs(server)}>
                    Logs
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
