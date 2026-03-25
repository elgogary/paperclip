import { useState, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "../../lib/utils";

interface McpLogsDrawerProps {
  open: boolean;
  onClose: () => void;
  serverName: string | null;
}

type LogFilter = "all" | "success" | "errors";

interface MockLogEntry {
  id: string;
  tool: string;
  agent: string;
  timestamp: string;
  duration: number;
  status: "success" | "error";
  error?: string;
}

const MOCK_LOGS: MockLogEntry[] = [
  { id: "1", tool: "create_pull_request", agent: "TechLead", timestamp: "2m ago", duration: 340, status: "success" },
  { id: "2", tool: "search_repositories", agent: "BackendEng", timestamp: "8m ago", duration: 210, status: "success" },
  { id: "3", tool: "create_issue", agent: "TechLead", timestamp: "15m ago", duration: 1240, status: "error", error: "422: Title is required" },
  { id: "4", tool: "get_file_contents", agent: "FrontendEng", timestamp: "22m ago", duration: 180, status: "success" },
  { id: "5", tool: "list_commits", agent: "DevOps", timestamp: "34m ago", duration: 290, status: "success" },
  { id: "6", tool: "push_files", agent: "BackendEng", timestamp: "45m ago", duration: 520, status: "success" },
  { id: "7", tool: "get_file_contents", agent: "TechLead", timestamp: "1h ago", duration: 150, status: "success" },
  { id: "8", tool: "search_repositories", agent: "FrontendEng", timestamp: "1.5h ago", duration: 280, status: "error", error: "Rate limit exceeded" },
];

export function McpLogsDrawer({ open, onClose, serverName }: McpLogsDrawerProps) {
  const [filter, setFilter] = useState<LogFilter>("all");
  const [visibleCount, setVisibleCount] = useState(5);

  const filtered = useMemo(() => {
    if (filter === "success") return MOCK_LOGS.filter((l) => l.status === "success");
    if (filter === "errors") return MOCK_LOGS.filter((l) => l.status === "error");
    return MOCK_LOGS;
  }, [filter]);

  const visible = filtered.slice(0, visibleCount);
  const totalCalls = MOCK_LOGS.length;

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="sm:max-w-[500px] flex flex-col p-0">
        <SheetHeader className="px-5 py-4 border-b border-border shrink-0">
          <SheetTitle className="text-[15px]">{serverName ?? "Server"} — Logs</SheetTitle>
        </SheetHeader>

        {/* Filter bar */}
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-border shrink-0">
          {(["all", "success", "errors"] as LogFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); setVisibleCount(5); }}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors capitalize",
                filter === f
                  ? "bg-accent text-foreground border-foreground/20"
                  : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {f}
            </button>
          ))}
          <span className="ml-auto text-[11px] text-muted-foreground">
            {totalCalls} calls · 24h
          </span>
        </div>

        {/* Log entries */}
        <div className="flex-1 overflow-y-auto">
          {visible.map((log) => (
            <div key={log.id} className="px-4 py-2.5 border-b border-border">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full shrink-0",
                    log.status === "success" ? "bg-emerald-500" : "bg-red-500",
                  )}
                />
                <span className="text-sm font-semibold">{log.tool}</span>
                <span className="text-[11px] text-muted-foreground">by {log.agent}</span>
                <span className="text-[11px] text-muted-foreground ml-auto">{log.timestamp}</span>
              </div>
              {log.status === "success" ? (
                <p className="text-[11px] text-muted-foreground">
                  Success · {log.duration}ms
                </p>
              ) : (
                <>
                  <p className="text-[11px] text-red-400">
                    Error · {log.duration.toLocaleString()}ms
                  </p>
                  {log.error && (
                    <div className="mt-1 rounded bg-red-500/8 border border-red-500/15 px-2 py-1 text-[11px] text-red-400 font-mono">
                      {log.error}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}

          {visibleCount < filtered.length && (
            <div className="text-center py-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVisibleCount((c) => c + 5)}
              >
                Load more...
              </Button>
            </div>
          )}

          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-12">No log entries.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
