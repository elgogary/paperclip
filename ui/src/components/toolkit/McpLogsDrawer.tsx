import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "../../lib/utils";
import { FileText } from "lucide-react";

interface McpLogsDrawerProps {
  open: boolean;
  onClose: () => void;
  serverName: string | null;
  serverId?: string;
}

type LogFilter = "all" | "success" | "errors";

export function McpLogsDrawer({ open, onClose, serverName, serverId: _serverId }: McpLogsDrawerProps) {
  const [filter, setFilter] = useState<LogFilter>("all");

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
              onClick={() => setFilter(f)}
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
        </div>

        {/* Empty state */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50 mb-4">
            <FileText className="h-5 w-5 text-muted-foreground/50" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">No logs available</p>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-[280px]">
            Tool call logging will be available in a future update. Logs will appear here once the logging API is connected.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
