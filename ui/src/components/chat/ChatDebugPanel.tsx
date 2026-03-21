import { useMemo } from "react";
import { cn, formatTokens } from "../../lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { agentsApi } from "../../api/agents";
import { queryKeys } from "../../lib/queryKeys";
import {
  ChevronRight,
  Cpu,
  DollarSign,
  Clock,
  BookOpen,
  Wrench,
  Activity,
} from "lucide-react";
import { heartbeatsApi } from "../../api/heartbeats";
import { ChatApprovalCard } from "./ChatApprovalCard";

import type { HeartbeatRunEvent } from "@paperclipai/shared";

type DebugEvent = HeartbeatRunEvent;

type RunInfo = {
  id: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  usageJson: {
    costUsd?: number;
    inputTokens?: number;
    outputTokens?: number;
    cachedInputTokens?: number;
  } | null;
};

type ChatDebugPanelProps = {
  runId: string | null;
  isRunning: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  agentId?: string | null;
  companyId?: string | null;
};

export function ChatDebugPanel({
  runId,
  isRunning,
  collapsed,
  onToggleCollapse,
  agentId,
  companyId,
}: ChatDebugPanelProps) {
  const queryClient = useQueryClient();

  const { data: runInfo } = useQuery({
    queryKey: queryKeys.runDetail(runId!),
    queryFn: async () => {
      const run = await heartbeatsApi.get(runId!);
      return run as RunInfo;
    },
    enabled: !!runId,
    refetchInterval: isRunning ? 3000 : false,
  });

  const { data: events = [] } = useQuery({
    queryKey: ["heartbeat-events", runId],
    queryFn: () => heartbeatsApi.events(runId!),
    enabled: !!runId,
    refetchInterval: isRunning ? 3000 : false,
  });

  // Model selector data
  const { data: agent } = useQuery({
    queryKey: queryKeys.agents.detail(agentId!),
    queryFn: () => agentsApi.get(agentId!),
    enabled: !!agentId,
  });

  const adapterType = (agent as unknown as Record<string, unknown>)?.adapterType as string | undefined;
  const adapterConfig = (agent as unknown as Record<string, unknown>)?.adapterConfig as Record<string, unknown> | undefined;
  const currentModel = adapterConfig?.model as string | undefined;

  const { data: models = [] } = useQuery({
    queryKey: queryKeys.agents.adapterModels(companyId!, adapterType ?? "claude-local"),
    queryFn: () => agentsApi.adapterModels(companyId!, adapterType ?? "claude-local"),
    enabled: !!companyId && !!adapterType,
  });

  const updateModel = useMutation({
    mutationFn: (modelId: string) =>
      agentsApi.update(agentId!, { adapterConfig: { ...adapterConfig, model: modelId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.detail(agentId!) });
    },
  });

  if (collapsed) {
    return (
      <div className="w-10 border-l bg-card flex flex-col items-center py-3 gap-2">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggleCollapse}>
          <Activity className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  const usage = runInfo?.usageJson;
  const cost = usage?.costUsd ?? 0;
  const tokensOut = usage?.outputTokens ?? 0;
  const duration = runInfo?.startedAt && runInfo?.finishedAt
    ? Math.round(
        (new Date(runInfo.finishedAt).getTime() - new Date(runInfo.startedAt).getTime()) / 1000,
      )
    : null;

  const toolCalls = useMemo(() => events.filter(
    (e) =>
      e.payload?.type === "tool_use" ||
      e.payload?.subtype === "tool_call" ||
      e.eventType === "tool_use",
  ), [events]);

  const lessons = useMemo(() => events.filter(
    (e) =>
      typeof (e.payload?.text ?? e.payload?.content) === "string" &&
      String(e.payload?.text ?? e.payload?.content ?? "").includes("LESSON"),
  ), [events]);

  return (
    <div className="w-[320px] min-w-[320px] border-l bg-card flex flex-col">
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5" />
          Debug
        </h3>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggleCollapse}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Metrics */}
      <div className="p-3 border-b space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <DollarSign className="h-3 w-3" /> Cost
          </span>
          <span className={cn("font-mono font-semibold", cost > 2 ? "text-destructive" : "text-foreground")}>
            ${cost.toFixed(4)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Cpu className="h-3 w-3" /> Tokens
          </span>
          <span className="font-mono">{formatTokens(tokensOut)} out</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-3 w-3" /> Duration
          </span>
          <span className="font-mono">
            {duration !== null ? `${Math.floor(duration / 60)}m${duration % 60}s` : "—"}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Wrench className="h-3 w-3" /> Tool calls
          </span>
          <span className="font-mono">{toolCalls.length}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <BookOpen className="h-3 w-3" /> Lessons
          </span>
          <span className={cn("font-mono", lessons.length > 0 && "text-primary font-semibold")}>
            {lessons.length}
          </span>
        </div>
      </div>

      {/* Model Selector */}
      {models.length > 0 && (
        <div className="p-3 border-b">
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
            Model
          </label>
          <select
            value={currentModel ?? ""}
            onChange={(e) => updateModel.mutate(e.target.value)}
            className="w-full text-xs border rounded-md px-2 py-1.5 bg-background"
            disabled={updateModel.isPending}
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Status */}
      <div className="px-3 py-2 border-b">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "w-2 h-2 rounded-full",
              isRunning ? "bg-green-500 animate-pulse" : "bg-muted-foreground",
            )}
          />
          <span className="text-xs font-medium">
            {isRunning ? "Agent working..." : runInfo ? "Idle" : "No active run"}
          </span>
        </div>
      </div>

      {/* Tool call log + Approval cards */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Events
          </h4>
          {events.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">No events yet</p>
          ) : (
            events.slice(-30).map((evt) => {
              const isToolUse = evt.payload?.type === "tool_use" || evt.eventType === "tool_use";
              const approvalId = evt.payload?.approvalId as string | undefined;

              if (isToolUse && approvalId) {
                return (
                  <ChatApprovalCard
                    key={evt.seq}
                    approvalId={approvalId}
                    toolName={String(evt.payload?.name ?? "tool")}
                    payload={(evt.payload?.input ?? evt.payload ?? {}) as Record<string, unknown>}
                    status={String(evt.payload?.approvalStatus ?? "pending_approval")}
                  />
                );
              }

              return (
                <div key={evt.seq} className="text-[11px] border rounded p-2 bg-muted/50">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono font-semibold text-primary">
                      {String(evt.payload?.type ?? evt.eventType ?? "event")}
                    </span>
                    <span className="text-muted-foreground">#{evt.seq}</span>
                  </div>
                  <pre className="text-[10px] text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all max-h-20">
                    {JSON.stringify(evt.payload, null, 1).slice(0, 200)}
                  </pre>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
