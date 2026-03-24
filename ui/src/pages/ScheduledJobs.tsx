import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { scheduledJobsApi, type ScheduledJob } from "../api/scheduled-jobs";
import { queryKeys } from "../lib/queryKeys";
import { JobDialog } from "../components/scheduled-jobs/JobDialog";
import { JobLogsDrawer } from "../components/scheduled-jobs/JobLogsDrawer";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { Button } from "@/components/ui/button";
import { cn } from "../lib/utils";
import { Plus, Play, Pause, Clock, Trash2, MoreHorizontal, Pencil, ScrollText, type LucideIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const JOB_TYPE_LABELS: Record<string, string> = {
  knowledge_sync: "Knowledge sync",
  webhook: "Webhook",
  agent_run: "Agent run",
};

function formatNextRun(nextRunAt: string | null): string {
  if (!nextRunAt) return "—";
  const diff = new Date(nextRunAt).getTime() - Date.now();
  if (diff < 0) return "Overdue";
  const mins = Math.round(diff / 60_000);
  if (mins < 60) return `in ${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `in ${hrs}h`;
  return `in ${Math.round(hrs / 24)}d`;
}

function JobStatusDot({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 rounded-full",
        enabled ? "bg-emerald-500" : "bg-muted-foreground/40",
      )}
    />
  );
}

interface JobRowProps {
  job: ScheduledJob;
  onEdit: (job: ScheduledJob) => void;
  onLogs: (job: ScheduledJob) => void;
  onRunNow: (job: ScheduledJob) => void;
  onToggle: (job: ScheduledJob) => void;
  onDelete: (job: ScheduledJob) => void;
}

function JobRow({ job, onEdit, onLogs, onRunNow, onToggle, onDelete }: JobRowProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors border-b border-border last:border-0">
      <JobStatusDot enabled={job.enabled} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{job.name}</p>
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
            {JOB_TYPE_LABELS[job.jobType] ?? job.jobType}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-xs font-mono text-muted-foreground">{job.cronExpression}</span>
          <span className="text-xs text-muted-foreground">
            <Clock className="inline h-3 w-3 mr-0.5 -mt-0.5" />
            {formatNextRun(job.nextRunAt)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon-xs"
          title="View run logs"
          onClick={() => onLogs(job)}
          className="text-muted-foreground hover:text-foreground"
        >
          <ScrollText className="h-3.5 w-3.5" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground hover:text-foreground"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => onRunNow(job)}>
              <Play className="h-3.5 w-3.5 mr-2" />
              Run now
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(job)}>
              <Pencil className="h-3.5 w-3.5 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onToggle(job)}>
              {job.enabled ? (
                <>
                  <Pause className="h-3.5 w-3.5 mr-2" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 mr-2" />
                  Resume
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(job)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export function ScheduledJobs() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<ScheduledJob | null>(null);
  const [logsJob, setLogsJob] = useState<ScheduledJob | null>(null);
  const [logsOpen, setLogsOpen] = useState(false);

  useEffect(() => {
    setBreadcrumbs([{ label: "Scheduled Jobs" }]);
  }, [setBreadcrumbs]);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.scheduledJobs.list(selectedCompanyId!),
    queryFn: () => scheduledJobsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const jobs: ScheduledJob[] = data?.jobs ?? [];

  const pauseJob = useMutation({
    mutationFn: (job: ScheduledJob) =>
      job.enabled
        ? scheduledJobsApi.pause(selectedCompanyId!, job.id)
        : scheduledJobsApi.resume(selectedCompanyId!, job.id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.scheduledJobs.list(selectedCompanyId!) }),
  });

  const deleteJob = useMutation({
    mutationFn: (jobId: string) => scheduledJobsApi.remove(selectedCompanyId!, jobId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.scheduledJobs.list(selectedCompanyId!) }),
  });

  const runNow = useMutation({
    mutationFn: (jobId: string) => scheduledJobsApi.runNow(selectedCompanyId!, jobId),
  });

  function openCreate() {
    setEditingJob(null);
    setDialogOpen(true);
  }

  function openEdit(job: ScheduledJob) {
    setEditingJob(job);
    setDialogOpen(true);
  }

  function openLogs(job: ScheduledJob) {
    setLogsJob(job);
    setLogsOpen(true);
  }

  async function handleDelete(job: ScheduledJob) {
    if (!window.confirm(`Delete "${job.name}"? This cannot be undone.`)) return;
    await deleteJob.mutateAsync(job.id);
  }

  if (isLoading) return <PageSkeleton />;
  if (error) return <p className="p-4 text-sm text-destructive">Failed to load scheduled jobs.</p>;

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div>
          <h1 className="text-base font-semibold">Scheduled Jobs</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Automate recurring tasks on a cron schedule.
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          New job
        </Button>
      </div>

      {/* Job list */}
      <div className="flex-1 overflow-y-auto">
        {jobs.length === 0 ? (
          <EmptyState
            icon={Clock as LucideIcon}
            message="No scheduled jobs. Create one to automate recurring tasks."
            action="New job"
            onAction={openCreate}
          />
        ) : (
          <div className="border border-border rounded-lg mx-4 mt-4 overflow-hidden divide-y divide-border">
            {jobs.map((job) => (
              <JobRow
                key={job.id}
                job={job}
                onEdit={openEdit}
                onLogs={openLogs}
                onRunNow={(j) => runNow.mutate(j.id)}
                onToggle={(j) => pauseJob.mutate(j)}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      <JobDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        job={editingJob}
      />

      <JobLogsDrawer
        open={logsOpen}
        onClose={() => { setLogsOpen(false); setLogsJob(null); }}
        job={logsJob}
      />
    </div>
  );
}
