import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../../context/CompanyContext";
import { scheduledJobsApi, type ScheduledJob, type ScheduledJobType } from "../../api/scheduled-jobs";
import { secretsApi } from "../../api/secrets";
import { agentsApi } from "../../api/agents";
import { queryKeys } from "../../lib/queryKeys";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "../../lib/utils";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import { JobTypeConfigFields } from "./JobTypeConfigFields";

const JOB_TYPES: { value: ScheduledJobType; label: string; description: string; defaultTimeout: string }[] = [
  {
    value: "knowledge_sync",
    label: "Knowledge Sync",
    description: "Sync a Brain knowledge source",
    defaultTimeout: "15 min",
  },
  {
    value: "webhook",
    label: "Webhook",
    description: "POST to an external URL",
    defaultTimeout: "5 min",
  },
  {
    value: "agent_run",
    label: "Agent Run",
    description: "Wake up an agent with a task",
    defaultTimeout: "60 min",
  },
  {
    value: "dream",
    label: "Dream",
    description: "Run memory consolidation cycle",
    defaultTimeout: "10 min",
  },
  {
    value: "memory_ingest",
    label: "Memory Ingest",
    description: "Process queued memory turns",
    defaultTimeout: "5 min",
  },
];

const RETRY_OPTIONS = [0, 1, 2, 3, 5];
const RETRY_DELAY_OPTIONS = [
  { value: 60, label: "1 min" },
  { value: 300, label: "5 min" },
  { value: 900, label: "15 min" },
  { value: 3600, label: "1 hr" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  job?: ScheduledJob | null;
}

export function JobDialog({ open, onClose, job }: Props) {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const isEdit = !!job;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [jobType, setJobType] = useState<ScheduledJobType>("webhook");
  const [cronExpression, setCronExpression] = useState("0 9 * * 1");
  const [timezone, setTimezone] = useState("UTC");
  const [config, setConfig] = useState<Record<string, unknown>>({});

  // Execution settings
  const [timeoutMode, setTimeoutMode] = useState<"auto" | "custom">("auto");
  const [timeoutSeconds, setTimeoutSeconds] = useState<number>(300);
  const [overlapPolicy, setOverlapPolicy] = useState<"skip" | "queue">("skip");
  const [missedRunPolicy, setMissedRunPolicy] = useState<"skip" | "run_once">("skip");

  // Retry
  const [retryMax, setRetryMax] = useState(0);
  const [retryDelaySeconds, setRetryDelaySeconds] = useState(300);

  // On failure
  const [onFailureNotifyInApp, setOnFailureNotifyInApp] = useState(true);
  const [onFailureWebhookEnabled, setOnFailureWebhookEnabled] = useState(false);
  const [onFailureWebhookUrl, setOnFailureWebhookUrl] = useState("");
  const [onFailureWebhookSecretId, setOnFailureWebhookSecretId] = useState("");

  // Accordion state
  const [execOpen, setExecOpen] = useState(false);
  const [retryOpen, setRetryOpen] = useState(false);
  const [failureOpen, setFailureOpen] = useState(false);

  const { data: secrets = [] } = useQuery({
    queryKey: selectedCompanyId ? queryKeys.secrets.list(selectedCompanyId) : ["secrets", "none"],
    queryFn: () => secretsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId && open,
  });

  const { data: agents = [] } = useQuery({
    queryKey: selectedCompanyId ? queryKeys.agents.list(selectedCompanyId) : ["agents", "none"],
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId && open && jobType === "agent_run",
  });

  useEffect(() => {
    if (!open) return;
    if (job) {
      setName(job.name);
      setDescription(job.description ?? "");
      setJobType(job.jobType);
      setCronExpression(job.cronExpression);
      setTimezone(job.timezone);
      setConfig(job.config as Record<string, unknown>);
      setTimeoutMode(job.timeoutSeconds ? "custom" : "auto");
      setTimeoutSeconds(job.timeoutSeconds ?? 300);
      setOverlapPolicy(job.overlapPolicy as "skip" | "queue");
      setMissedRunPolicy(job.missedRunPolicy as "skip" | "run_once");
      setRetryMax(job.retryMax);
      setRetryDelaySeconds(job.retryDelaySeconds);
      setOnFailureNotifyInApp(job.onFailureNotifyInApp);
      setOnFailureWebhookEnabled(!!job.onFailureWebhookUrl);
      setOnFailureWebhookUrl(job.onFailureWebhookUrl ?? "");
      setOnFailureWebhookSecretId(job.onFailureWebhookSecretId ?? "");
    } else {
      setName("");
      setDescription("");
      setJobType("webhook");
      setCronExpression("0 9 * * 1");
      setTimezone("UTC");
      setConfig({});
      setTimeoutMode("auto");
      setTimeoutSeconds(300);
      setOverlapPolicy("skip");
      setMissedRunPolicy("skip");
      setRetryMax(0);
      setRetryDelaySeconds(300);
      setOnFailureNotifyInApp(true);
      setOnFailureWebhookEnabled(false);
      setOnFailureWebhookUrl("");
      setOnFailureWebhookSecretId("");
      setExecOpen(false);
      setRetryOpen(false);
      setFailureOpen(false);
    }
  }, [open, job]);

  const createJob = useMutation({
    mutationFn: (data: Parameters<typeof scheduledJobsApi.create>[1]) =>
      scheduledJobsApi.create(selectedCompanyId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scheduledJobs.list(selectedCompanyId!) });
      onClose();
    },
  });

  const updateJob = useMutation({
    mutationFn: (data: Parameters<typeof scheduledJobsApi.update>[2]) =>
      scheduledJobsApi.update(selectedCompanyId!, job!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scheduledJobs.list(selectedCompanyId!) });
      queryClient.invalidateQueries({
        queryKey: queryKeys.scheduledJobs.detail(selectedCompanyId!, job!.id),
      });
      onClose();
    },
  });

  async function handleSubmit() {
    if (!selectedCompanyId || !name.trim() || !cronExpression.trim()) return;

    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      jobType,
      config,
      cronExpression: cronExpression.trim(),
      timezone,
      timeoutSeconds: timeoutMode === "custom" ? timeoutSeconds : null,
      overlapPolicy,
      missedRunPolicy,
      retryMax,
      retryDelaySeconds,
      onFailureNotifyInApp,
      onFailureWebhookUrl: onFailureWebhookEnabled ? onFailureWebhookUrl.trim() || null : null,
      onFailureWebhookSecretId:
        onFailureWebhookEnabled && onFailureWebhookSecretId ? onFailureWebhookSecretId : null,
    };

    if (isEdit) {
      await updateJob.mutateAsync(payload);
    } else {
      await createJob.mutateAsync({ ...payload, scope: "company" });
    }
  }

  const isPending = createJob.isPending || updateJob.isPending;
  const isError = createJob.isError || updateJob.isError;
  const selectedTypeInfo = JOB_TYPES.find((t) => t.value === jobType);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent showCloseButton={false} className="p-0 gap-0 sm:max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
          <span className="text-sm font-medium">{isEdit ? "Edit job" : "New scheduled job"}</span>
          <button
            className="text-muted-foreground hover:text-foreground transition-colors"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-4 py-4 space-y-4">
          {/* Name */}
          <div>
            <input
              className="w-full text-base font-semibold bg-transparent outline-none placeholder:text-muted-foreground/50"
              placeholder="Job name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            <input
              className="w-full text-sm bg-transparent outline-none placeholder:text-muted-foreground/40 mt-1"
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Job type */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Job type</p>
            <div className="grid grid-cols-3 gap-2">
              {JOB_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => { setJobType(t.value); if (!isEdit) setConfig({}); }}
                  className={cn(
                    "rounded-lg border px-3 py-2.5 text-left transition-colors",
                    jobType === t.value
                      ? "border-foreground bg-accent/40"
                      : "border-border hover:bg-accent/30",
                  )}
                >
                  <p className="text-xs font-medium">{t.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{t.description}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                    Default timeout: {t.defaultTimeout}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Job type config fields */}
          <JobTypeConfigFields
            jobType={jobType}
            config={config}
            onChange={setConfig}
            secrets={secrets}
            agents={agents}
          />

          {/* Cron */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Cron expression</label>
              <input
                className="w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-xs font-mono outline-none mt-1"
                placeholder="0 9 * * 1"
                value={cronExpression}
                onChange={(e) => setCronExpression(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Timezone</label>
              <input
                className="w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-xs outline-none mt-1"
                placeholder="UTC"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              />
            </div>
          </div>

          {/* Execution settings accordion */}
          <Accordion title="Execution settings" open={execOpen} onToggle={() => setExecOpen(!execOpen)}>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">
                  Timeout{" "}
                  <span className="text-muted-foreground/60">
                    (auto default: {selectedTypeInfo?.defaultTimeout})
                  </span>
                </p>
                <div className="flex gap-2">
                  <PillButton active={timeoutMode === "auto"} onClick={() => setTimeoutMode("auto")}>
                    Auto
                  </PillButton>
                  <PillButton active={timeoutMode === "custom"} onClick={() => setTimeoutMode("custom")}>
                    Custom
                  </PillButton>
                  {timeoutMode === "custom" && (
                    <div className="flex items-center gap-1 ml-2">
                      <input
                        type="number"
                        className="w-20 rounded-md border border-border bg-transparent px-2 py-0.5 text-xs outline-none"
                        value={timeoutSeconds}
                        min={1}
                        onChange={(e) => setTimeoutSeconds(Number(e.target.value))}
                      />
                      <span className="text-xs text-muted-foreground">seconds</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1.5">If already running</p>
                <div className="flex gap-2">
                  <PillButton active={overlapPolicy === "skip"} onClick={() => setOverlapPolicy("skip")}>
                    Skip
                  </PillButton>
                  <PillButton active={overlapPolicy === "queue"} onClick={() => setOverlapPolicy("queue")}>
                    Queue
                  </PillButton>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1.5">If run was missed</p>
                <div className="flex gap-2">
                  <PillButton active={missedRunPolicy === "skip"} onClick={() => setMissedRunPolicy("skip")}>
                    Skip
                  </PillButton>
                  <PillButton active={missedRunPolicy === "run_once"} onClick={() => setMissedRunPolicy("run_once")}>
                    Run once
                  </PillButton>
                </div>
              </div>
            </div>
          </Accordion>

          {/* Retry accordion */}
          <Accordion title="Retry on failure" open={retryOpen} onToggle={() => setRetryOpen(!retryOpen)}>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Max retries</p>
                <div className="flex gap-2">
                  {RETRY_OPTIONS.map((n) => (
                    <PillButton key={n} active={retryMax === n} onClick={() => setRetryMax(n)}>
                      {n}
                    </PillButton>
                  ))}
                </div>
              </div>
              {retryMax > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Retry delay</p>
                  <div className="flex gap-2 flex-wrap">
                    {RETRY_DELAY_OPTIONS.map((opt) => (
                      <PillButton
                        key={opt.value}
                        active={retryDelaySeconds === opt.value}
                        onClick={() => setRetryDelaySeconds(opt.value)}
                      >
                        {opt.label}
                      </PillButton>
                    ))}
                  </div>
                  {jobType === "webhook" && (
                    <p className="text-xs text-amber-500 mt-2">
                      Warning: webhooks may not be idempotent. Retries could cause duplicate
                      side-effects.
                    </p>
                  )}
                </div>
              )}
            </div>
          </Accordion>

          {/* On failure accordion */}
          <Accordion
            title="On failure notifications"
            open={failureOpen}
            onToggle={() => setFailureOpen(!failureOpen)}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Notify in-app</p>
                <Toggle value={onFailureNotifyInApp} onChange={setOnFailureNotifyInApp} />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Failure webhook</p>
                <Toggle value={onFailureWebhookEnabled} onChange={setOnFailureWebhookEnabled} />
              </div>
              {onFailureWebhookEnabled && (
                <div className="space-y-2">
                  <input
                    className="w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-xs outline-none"
                    placeholder="https://example.com/failure-hook"
                    value={onFailureWebhookUrl}
                    onChange={(e) => setOnFailureWebhookUrl(e.target.value)}
                  />
                  <select
                    className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none"
                    value={onFailureWebhookSecretId}
                    onChange={(e) => setOnFailureWebhookSecretId(e.target.value)}
                  >
                    <option value="">No auth secret</option>
                    {secrets.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </Accordion>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border shrink-0">
          {isError ? (
            <p className="text-xs text-destructive">Failed to save job.</p>
          ) : (
            <span />
          )}
          <Button
            size="sm"
            disabled={!name.trim() || !cronExpression.trim() || isPending}
            onClick={handleSubmit}
          >
            {isPending ? "Saving…" : isEdit ? "Save changes" : "Create job"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Dialog primitives ─────────────────────────────────────────────────────────

function Accordion({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium hover:bg-accent/30 transition-colors"
        onClick={onToggle}
      >
        <span>{title}</span>
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>
      {open && <div className="px-3 pb-3 pt-1 border-t border-border">{children}</div>}
    </div>
  );
}

function PillButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-0.5 text-xs transition-colors",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border hover:bg-accent/50",
      )}
    >
      {children}
    </button>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={cn(
        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
        value ? "bg-foreground" : "bg-border",
      )}
    >
      <span
        className={cn(
          "inline-block h-3.5 w-3.5 transform rounded-full bg-background transition-transform",
          value ? "translate-x-4" : "translate-x-0.5",
        )}
      />
    </button>
  );
}
