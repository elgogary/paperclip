import { useQuery } from "@tanstack/react-query";
import { useCompany } from "../../context/CompanyContext";
import { scheduledJobsApi, type ScheduledJob, type ScheduledJobRun } from "../../api/scheduled-jobs";
import { queryKeys } from "../../lib/queryKeys";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "../../lib/utils";
import { ExternalLink } from "lucide-react";

function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function RunRow({ run }: { run: ScheduledJobRun }) {
  const isSuccess = run.status === "success";
  const isFailed = run.status === "failed";
  const isRunning = run.status === "running";

  return (
    <div className="border border-border rounded-lg p-3 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
              isSuccess && "bg-emerald-500/15 text-emerald-600",
              isFailed && "bg-red-500/15 text-red-600",
              isRunning && "bg-blue-500/15 text-blue-600",
            )}
          >
            {run.status}
          </span>
          {run.attempt > 1 && (
            <span className="inline-flex items-center rounded-full bg-amber-500/15 text-amber-600 px-2 py-0.5 text-[10px] font-medium">
              Retry #{run.attempt}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground capitalize">{run.triggeredBy}</span>
        </div>
        <span className="text-[10px] text-muted-foreground shrink-0">
          {formatDuration(run.durationMs)}
        </span>
      </div>

      <p className="text-[10px] text-muted-foreground">{formatDate(run.startedAt)}</p>

      {run.output && (
        <p className="text-xs font-mono bg-muted/40 rounded px-2 py-1 truncate">{run.output}</p>
      )}
      {run.error && (
        <p className="text-xs text-destructive bg-destructive/5 rounded px-2 py-1 truncate">
          {run.error}
        </p>
      )}

      {run.heartbeatRunId && (
        <a
          href={`#/runs/${run.heartbeatRunId}`}
          className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          View agent transcript
        </a>
      )}
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  job: ScheduledJob | null;
}

export function JobLogsDrawer({ open, onClose, job }: Props) {
  const { selectedCompanyId } = useCompany();

  const { data, isLoading } = useQuery({
    queryKey: job ? queryKeys.scheduledJobs.runs(selectedCompanyId!, job.id) : ["noop"],
    queryFn: () => scheduledJobsApi.listRuns(selectedCompanyId!, job!.id, 50),
    enabled: !!selectedCompanyId && !!job && open,
    refetchInterval: open ? 10_000 : false,
  });

  const runs: ScheduledJobRun[] = data?.runs ?? [];

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-[480px] sm:max-w-[480px] p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b border-border shrink-0">
          <SheetTitle className="text-sm font-medium truncate">
            {job?.name ?? "Run logs"}
          </SheetTitle>
          <p className="text-xs text-muted-foreground">Last 50 runs · kept for 90 days</p>
        </SheetHeader>

        <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
          {isLoading && (
            <p className="text-xs text-muted-foreground text-center py-8">Loading runs…</p>
          )}
          {!isLoading && runs.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">No runs yet.</p>
          )}
          {runs.map((run) => (
            <RunRow key={run.id} run={run} />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
