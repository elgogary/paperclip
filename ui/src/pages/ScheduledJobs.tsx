import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToast } from "../context/ToastContext";
import { scheduledJobsApi, type ScheduledJob } from "../api/scheduled-jobs";
import { queryKeys } from "../lib/queryKeys";
import { JobDialog } from "../components/scheduled-jobs/JobDialog";
import { JobLogsDrawer } from "../components/scheduled-jobs/JobLogsDrawer";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "../lib/utils";
import {
  Plus, Play, Pause, Clock, Trash2, MoreHorizontal, Pencil, ScrollText,
  Search, List, LayoutGrid, type LucideIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const JOB_TYPE_INFO: Record<string, { label: string; color: string }> = {
  knowledge_sync: { label: "Sync", color: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  webhook: { label: "Webhook", color: "bg-purple-500/15 text-purple-600 dark:text-purple-400" },
  agent_run: { label: "Agent run", color: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400" },
  dream: { label: "Dream", color: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  memory_ingest: { label: "Ingest", color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
};

const SCOPE_LABELS: Record<string, string> = {
  company: "Company",
  agent: "Agent",
  project: "Project",
};

function describeCron(expr: string): string {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return expr;
  const [min, hour, , , dow] = parts;
  const DAYS: Record<string, string> = {
    "0": "Sun", "1": "Mon", "2": "Tue", "3": "Wed",
    "4": "Thu", "5": "Fri", "6": "Sat", "7": "Sun",
  };
  function hhmm(h: string, m: string): string {
    const hh = parseInt(h), mm = parseInt(m);
    const ampm = hh >= 12 ? "pm" : "am";
    const h12 = hh % 12 === 0 ? 12 : hh % 12;
    return `${h12}${mm === 0 ? "" : `:${mm.toString().padStart(2, "0")}`}${ampm}`;
  }
  if (dow !== "*" && !min.includes("*") && !hour.includes("*")) {
    const dayStr = dow.split(",").map((d) => DAYS[d] ?? d).join("/");
    return `${dayStr} at ${hhmm(hour, min)}`;
  }
  if (dow === "*" && !min.includes("*") && !hour.includes("*")) {
    return `Daily at ${hhmm(hour, min)}`;
  }
  if (dow === "*" && min === "0" && hour === "*") return "Every hour";
  if (dow === "*" && hour === "*" && !min.includes("*")) return `Every hour at :${min.padStart(2, "0")}`;
  return expr;
}

function formatTimeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.round(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function formatNextRun(nextRunAt: string | null): { text: string; overdue: boolean } {
  if (!nextRunAt) return { text: "—", overdue: false };
  const diff = new Date(nextRunAt).getTime() - Date.now();
  if (diff < 0) return { text: "Overdue", overdue: true };
  const mins = Math.round(diff / 60_000);
  if (mins < 60) return { text: `in ${mins}m`, overdue: false };
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return { text: `in ${hrs}h`, overdue: false };
  return { text: `in ${Math.round(hrs / 24)}d`, overdue: false };
}

function TypeBadge({ jobType }: { jobType: string }) {
  const info = JOB_TYPE_INFO[jobType];
  if (!info) return <span className="text-xs text-muted-foreground">{jobType}</span>;
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium", info.color)}>
      {info.label}
    </span>
  );
}

function JobStatusBadge({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
        enabled
          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
          : "bg-muted text-muted-foreground",
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", enabled ? "bg-emerald-500" : "bg-muted-foreground/40")} />
      {enabled ? "Active" : "Paused"}
    </span>
  );
}

// ── Shared actions menu ───────────────────────────────────────────────────────

interface ActionsMenuProps {
  job: ScheduledJob;
  onEdit: () => void;
  onLogs: () => void;
  onRunNow: () => void;
  onToggle: () => void;
  onDelete: () => void;
}

function ActionsMenu({ job, onEdit, onLogs, onRunNow, onToggle, onDelete }: ActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-xs" className="text-muted-foreground hover:text-foreground">
          <MoreHorizontal className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem onClick={onRunNow}>
          <Play className="h-3.5 w-3.5 mr-2" /> Run now
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onToggle}>
          {job.enabled ? (
            <><Pause className="h-3.5 w-3.5 mr-2" /> Pause</>
          ) : (
            <><Play className="h-3.5 w-3.5 mr-2" /> Resume</>
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
          <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Table row ─────────────────────────────────────────────────────────────────

interface JobRowProps {
  job: ScheduledJob;
  onEdit: (job: ScheduledJob) => void;
  onLogs: (job: ScheduledJob) => void;
  onRunNow: (job: ScheduledJob) => void;
  onToggle: (job: ScheduledJob) => void;
  onDelete: (job: ScheduledJob) => void;
}

function JobTableRow({ job, onEdit, onLogs, onRunNow, onToggle, onDelete }: JobRowProps) {
  const { text: nextText, overdue } = formatNextRun(job.nextRunAt);

  return (
    <tr className={cn("border-b border-border hover:bg-accent/50 transition-colors", !job.enabled && "opacity-60")}>
      <td className="px-3 py-2.5">
        <p className="text-sm font-medium truncate max-w-[220px]">{job.name}</p>
        {job.description && (
          <p className="text-xs text-muted-foreground truncate max-w-[220px]">{job.description}</p>
        )}
        {job.retryMax > 0 && (
          <p className="text-[10px] text-muted-foreground/60">Retry ×{job.retryMax}</p>
        )}
      </td>
      <td className="px-3 py-2.5">
        <span className="text-xs text-muted-foreground">{SCOPE_LABELS[job.scope] ?? job.scope}</span>
      </td>
      <td className="px-3 py-2.5">
        <TypeBadge jobType={job.jobType} />
      </td>
      <td className="px-3 py-2.5">
        <p className="text-xs">{describeCron(job.cronExpression)}</p>
        <p className="text-[10px] font-mono text-muted-foreground">{job.cronExpression}</p>
        {job.timezone !== "UTC" && (
          <p className="text-[10px] text-muted-foreground/60">{job.timezone}</p>
        )}
      </td>
      <td className="px-3 py-2.5">
        <span className="text-xs text-muted-foreground">{formatTimeAgo(job.lastRunAt)}</span>
      </td>
      <td className="px-3 py-2.5">
        <span className={cn("text-xs", overdue ? "text-amber-500 font-medium" : "text-muted-foreground")}>
          {nextText}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <JobStatusBadge enabled={job.enabled} />
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1 justify-end">
          <Button
            variant="ghost"
            size="icon-xs"
            title="View run logs"
            onClick={() => onLogs(job)}
            className="text-muted-foreground hover:text-foreground"
          >
            <ScrollText className="h-3.5 w-3.5" />
          </Button>
          <ActionsMenu
            job={job}
            onEdit={() => onEdit(job)}
            onLogs={() => onLogs(job)}
            onRunNow={() => onRunNow(job)}
            onToggle={() => onToggle(job)}
            onDelete={() => onDelete(job)}
          />
        </div>
      </td>
    </tr>
  );
}

// ── Card (panel view) ─────────────────────────────────────────────────────────

function JobCard({ job, onEdit, onLogs, onRunNow, onToggle, onDelete }: JobRowProps) {
  const { text: nextText, overdue } = formatNextRun(job.nextRunAt);

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-4 flex flex-col gap-3 hover:border-border/80 hover:bg-accent/20 transition-colors",
        !job.enabled && "opacity-60",
      )}
    >
      {/* Card header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium truncate">{job.name}</p>
            <TypeBadge jobType={job.jobType} />
          </div>
          {job.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{job.description}</p>
          )}
        </div>
        <JobStatusBadge enabled={job.enabled} />
      </div>

      {/* Schedule */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="h-3 w-3 shrink-0" />
        <span>{describeCron(job.cronExpression)}</span>
        <span className="font-mono text-[10px] opacity-60">{job.cronExpression}</span>
      </div>

      {/* Run info */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Last run</p>
          <p className="text-muted-foreground">{formatTimeAgo(job.lastRunAt)}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Next run</p>
          <p className={cn(overdue ? "text-amber-500 font-medium" : "text-muted-foreground")}>{nextText}</p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-border">
        <span className="text-[10px] text-muted-foreground">{SCOPE_LABELS[job.scope] ?? job.scope}</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-xs"
            title="View run logs"
            onClick={() => onLogs(job)}
            className="text-muted-foreground hover:text-foreground"
          >
            <ScrollText className="h-3.5 w-3.5" />
          </Button>
          <ActionsMenu
            job={job}
            onEdit={() => onEdit(job)}
            onLogs={() => onLogs(job)}
            onRunNow={() => onRunNow(job)}
            onToggle={() => onToggle(job)}
            onDelete={() => onDelete(job)}
          />
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type ViewMode = "table" | "cards";

export function ScheduledJobs() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<ScheduledJob | null>(null);
  const [logsJob, setLogsJob] = useState<ScheduledJob | null>(null);
  const [logsOpen, setLogsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ScheduledJob | null>(null);

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  useEffect(() => {
    setBreadcrumbs([{ label: "Scheduled Jobs" }]);
  }, [setBreadcrumbs]);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.scheduledJobs.list(selectedCompanyId!),
    queryFn: () => scheduledJobsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const jobs: ScheduledJob[] = data?.jobs ?? [];

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return jobs.filter((j) => {
      if (q && !j.name.toLowerCase().includes(q) && !(j.description ?? "").toLowerCase().includes(q)) return false;
      if (filterType && j.jobType !== filterType) return false;
      if (filterStatus === "active" && !j.enabled) return false;
      if (filterStatus === "paused" && j.enabled) return false;
      return true;
    });
  }, [jobs, search, filterType, filterStatus]);

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
    onSuccess: (_data, jobId) => {
      const job = jobs.find((j) => j.id === jobId);
      pushToast({ title: "Job triggered", body: job?.name, tone: "info" });
    },
  });

  function openCreate() { setEditingJob(null); setDialogOpen(true); }
  function openEdit(job: ScheduledJob) { setEditingJob(job); setDialogOpen(true); }
  function openLogs(job: ScheduledJob) { setLogsJob(job); setLogsOpen(true); }

  async function confirmAndDelete() {
    if (!confirmDelete) return;
    await deleteJob.mutateAsync(confirmDelete.id);
    setConfirmDelete(null);
  }

  const hasFilters = search || filterType || filterStatus;

  if (isLoading) return <PageSkeleton />;
  if (error) return <p className="p-4 text-sm text-destructive">Failed to load scheduled jobs.</p>;

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div>
          <h1 className="text-xl font-bold">Scheduled Jobs</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Automate recurring tasks on a cron schedule.</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          New job
        </Button>
      </div>

      {/* Filter bar */}
      {jobs.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/20 shrink-0">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search jobs…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-6 pr-2 py-1 rounded-md border border-border bg-background text-xs outline-none focus:ring-1 focus:ring-ring w-44"
            />
          </div>

          <div className="w-px h-4 bg-border" />

          {/* Type filter */}
          <select
            className="rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="">All types</option>
            <option value="knowledge_sync">Sync</option>
            <option value="webhook">Webhook</option>
            <option value="agent_run">Agent run</option>
            <option value="dream">Dream</option>
            <option value="memory_ingest">Ingest</option>
          </select>

          {/* Status filter */}
          <select
            className="rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
          </select>

          {hasFilters && (
            <button
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => { setSearch(""); setFilterType(""); setFilterStatus(""); }}
            >
              Clear
            </button>
          )}

          <span className="text-xs text-muted-foreground ml-auto">
            {filteredJobs.length} {filteredJobs.length === 1 ? "job" : "jobs"}
          </span>

          {/* View toggle */}
          <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
            <button
              onClick={() => setViewMode("table")}
              className={cn(
                "rounded p-1 transition-colors",
                viewMode === "table"
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              title="Table view"
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode("cards")}
              className={cn(
                "rounded p-1 transition-colors",
                viewMode === "cards"
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              title="Card view"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {jobs.length === 0 ? (
          <EmptyState
            icon={Clock as LucideIcon}
            message="No scheduled jobs. Create one to automate recurring tasks."
            action="New job"
            onAction={openCreate}
          />
        ) : filteredJobs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">
            No jobs match the current filter.
          </p>
        ) : viewMode === "table" ? (
          <div className="min-w-full">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-10 bg-background">
                <tr className="border-b border-border">
                  <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2">Name</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2 w-24">Scope</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2 w-28">Type</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2 w-48">Schedule</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2 w-28">Last run</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2 w-28">Next run</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2 w-24">Status</th>
                  <th className="px-3 py-2 w-20" />
                </tr>
              </thead>
              <tbody>
                {filteredJobs.map((job) => (
                  <JobTableRow
                    key={job.id}
                    job={job}
                    onEdit={openEdit}
                    onLogs={openLogs}
                    onRunNow={(j) => runNow.mutate(j.id)}
                    onToggle={(j) => pauseJob.mutate(j)}
                    onDelete={(j) => setConfirmDelete(j)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onEdit={openEdit}
                onLogs={openLogs}
                onRunNow={(j) => runNow.mutate(j.id)}
                onToggle={(j) => pauseJob.mutate(j)}
                onDelete={(j) => setConfirmDelete(j)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Delete confirm dialog */}
      <Dialog open={!!confirmDelete} onOpenChange={(o) => { if (!o) setConfirmDelete(null); }}>
        <DialogContent showCloseButton={false} className="sm:max-w-sm p-4">
          <p className="text-sm font-medium">Delete &ldquo;{confirmDelete?.name}&rdquo;?</p>
          <p className="text-xs text-muted-foreground mt-1">
            This will permanently delete the job and all its run history. This cannot be undone.
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={deleteJob.isPending}
              onClick={confirmAndDelete}
            >
              {deleteJob.isPending ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <JobDialog open={dialogOpen} onClose={() => setDialogOpen(false)} job={editingJob} />

      <JobLogsDrawer
        open={logsOpen}
        onClose={() => { setLogsOpen(false); setLogsJob(null); }}
        job={logsJob}
      />
    </div>
  );
}
