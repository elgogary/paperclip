import type { ScheduledJobType } from "../../api/scheduled-jobs";

interface Props {
  jobType: ScheduledJobType;
  config: Record<string, unknown>;
  onChange: (c: Record<string, unknown>) => void;
  secrets: { id: string; name: string }[];
}

export function JobTypeConfigFields({ jobType, config, onChange, secrets }: Props) {
  function set(key: string, value: string) {
    onChange({ ...config, [key]: value });
  }

  const str = (key: string) => (config[key] as string | undefined) ?? "";

  if (jobType === "knowledge_sync") {
    return (
      <div>
        <label className="text-xs text-muted-foreground">Brain Source ID</label>
        <input
          className="w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-xs font-mono outline-none mt-1"
          placeholder="source-uuid"
          value={str("source_id")}
          onChange={(e) => set("source_id", e.target.value)}
        />
      </div>
    );
  }

  if (jobType === "webhook") {
    return (
      <div className="space-y-2">
        <div>
          <label className="text-xs text-muted-foreground">URL</label>
          <input
            className="w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-xs outline-none mt-1"
            placeholder="https://example.com/hook"
            value={str("url")}
            onChange={(e) => set("url", e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">Method</label>
            <select
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none mt-1"
              value={str("method") || "POST"}
              onChange={(e) => set("method", e.target.value)}
            >
              {["POST", "GET", "PUT", "PATCH"].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Auth secret</label>
            <select
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none mt-1"
              value={str("auth_secret_id")}
              onChange={(e) => set("auth_secret_id", e.target.value)}
            >
              <option value="">None</option>
              {secrets.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Request body (JSON)</label>
          <textarea
            className="w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-xs font-mono outline-none mt-1 h-16 resize-none"
            placeholder="{}"
            value={str("body")}
            onChange={(e) => set("body", e.target.value)}
          />
        </div>
      </div>
    );
  }

  if (jobType === "agent_run") {
    return (
      <div className="space-y-2">
        <div>
          <label className="text-xs text-muted-foreground">Agent ID</label>
          <input
            className="w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-xs font-mono outline-none mt-1"
            placeholder="agent-uuid"
            value={str("agent_id")}
            onChange={(e) => set("agent_id", e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Task title</label>
          <input
            className="w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-xs outline-none mt-1"
            placeholder="Scheduled task"
            value={str("task_title")}
            onChange={(e) => set("task_title", e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Task description (optional)</label>
          <textarea
            className="w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-xs outline-none mt-1 h-16 resize-none"
            placeholder="What should the agent do?"
            value={str("task_description")}
            onChange={(e) => set("task_description", e.target.value)}
          />
        </div>
      </div>
    );
  }

  return null;
}
