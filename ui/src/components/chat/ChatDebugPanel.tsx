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
  Zap,
  Shield,
  Settings,
  User,
  Wallet,
} from "lucide-react";
import { heartbeatsApi } from "../../api/heartbeats";
import { ChatApprovalCard } from "./ChatApprovalCard";
import { ROLE_COLORS } from "./chat-constants";

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

type AgentInfo = {
  id: string;
  name: string;
  role: string;
  title: string | null;
  capabilities: string | null;
  adapterType: string;
  adapterConfig: Record<string, unknown> | null;
  runtimeConfig: Record<string, unknown> | null;
  budgetMonthlyCents: number | null;
  spentMonthlyCents: number | null;
  status: string;
  lastHeartbeatAt: string | null;
  reportsTo: string | null;
};

type ChatDebugPanelProps = {
  runId: string | null;
  isRunning: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  agentId?: string | null;
  companyId?: string | null;
};

function MetricRow({ icon: Icon, label, value, valueClass }: {
  icon: typeof Cpu;
  label: string;
  value: string | number;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </span>
      <span className={cn("font-mono", valueClass)}>{value}</span>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
      {children}
    </h4>
  );
}

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

  const { data: agent } = useQuery({
    queryKey: queryKeys.agents.detail(agentId!),
    queryFn: () => agentsApi.get(agentId!),
    enabled: !!agentId,
  });

  const agentData = agent as unknown as AgentInfo | undefined;
  const adapterConfig = agentData?.adapterConfig ?? {};
  const currentModel = adapterConfig?.model as string | undefined;
  const maxTurns = adapterConfig?.maxTurnsPerRun as number | undefined;
  const instructionsPath = adapterConfig?.instructionsFilePath as string | undefined;
  const capabilities = agentData?.capabilities?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  const budgetTotal = (agentData?.budgetMonthlyCents ?? 0) / 100;
  const budgetSpent = (agentData?.spentMonthlyCents ?? 0) / 100;
  const budgetPct = budgetTotal > 0 ? Math.round((budgetSpent / budgetTotal) * 100) : 0;
  const heartbeatInterval = (agentData?.runtimeConfig as Record<string, unknown>)?.heartbeat as Record<string, unknown> | undefined;

  const { data: models = [] } = useQuery({
    queryKey: queryKeys.agents.adapterModels(companyId!, agentData?.adapterType ?? "claude-local"),
    queryFn: () => agentsApi.adapterModels(companyId!, agentData?.adapterType ?? "claude-local"),
    enabled: !!companyId && !!agentData?.adapterType,
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
  const tokensIn = usage?.inputTokens ?? 0;
  const tokensOut = usage?.outputTokens ?? 0;
  const cachedTokens = usage?.cachedInputTokens ?? 0;
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

      <ScrollArea className="flex-1">
        {/* Agent Overview */}
        {agentData && (
          <div className="p-3 border-b space-y-2.5">
            <SectionHeader>Agent Overview</SectionHeader>
            <div className="flex items-center gap-2">
              <div className={cn("w-2 h-2 rounded-full",
                agentData.status === "running" ? "bg-green-500 animate-pulse" :
                agentData.status === "idle" ? "bg-green-400" :
                agentData.status === "error" ? "bg-destructive" : "bg-muted-foreground"
              )} />
              <span className="text-xs font-medium capitalize">{agentData.status}</span>
              <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full text-white capitalize",
                ROLE_COLORS[agentData.role] ?? "bg-muted"
              )}>
                {agentData.role}
              </span>
            </div>

            <MetricRow icon={User} label="Reports to" value={agentData.reportsTo ?? "Board"} />
            <MetricRow icon={Settings} label="Adapter" value={agentData.adapterType} />
            {maxTurns && <MetricRow icon={Zap} label="Max turns" value={maxTurns} />}
            {heartbeatInterval?.intervalSec != null && (
              <MetricRow icon={Clock} label="Heartbeat"
                value={`${Math.round(Number(heartbeatInterval.intervalSec) / 3600)}h`}
              />
            )}
            {agentData.lastHeartbeatAt && (
              <MetricRow icon={Activity} label="Last run"
                value={new Date(agentData.lastHeartbeatAt).toLocaleString("en-US", {
                  month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
                })}
              />
            )}
          </div>
        )}

        {/* Budget */}
        {budgetTotal > 0 && (
          <div className="p-3 border-b space-y-2">
            <SectionHeader>Monthly Budget</SectionHeader>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Wallet className="h-3 w-3" /> Spent
              </span>
              <span className={cn("font-mono font-semibold",
                budgetPct > 90 ? "text-destructive" : budgetPct > 70 ? "text-amber-500" : "text-foreground"
              )}>
                ${budgetSpent.toFixed(2)} / ${budgetTotal.toFixed(2)}
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all",
                  budgetPct > 90 ? "bg-destructive" : budgetPct > 70 ? "bg-amber-500" : "bg-primary"
                )}
                style={{ width: `${Math.min(budgetPct, 100)}%` }}
              />
            </div>
            <div className="text-[10px] text-muted-foreground text-right">{budgetPct}% used</div>
          </div>
        )}

        {/* Capabilities / Skills */}
        {capabilities.length > 0 && (
          <div className="p-3 border-b space-y-2">
            <SectionHeader>Capabilities</SectionHeader>
            <div className="flex flex-wrap gap-1">
              {capabilities.map((cap) => (
                <span key={cap} className="text-[10px] px-2 py-0.5 rounded-full bg-muted border text-muted-foreground">
                  {cap}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        {instructionsPath && (
          <div className="p-3 border-b">
            <SectionHeader>Instructions</SectionHeader>
            <code className="text-[10px] text-muted-foreground break-all">
              {instructionsPath}
            </code>
          </div>
        )}

        {/* Model Selector */}
        {models.length > 0 && (
          <div className="p-3 border-b">
            <SectionHeader>Model</SectionHeader>
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

        {/* Run Metrics */}
        <div className="p-3 border-b space-y-2">
          <SectionHeader>Current Run</SectionHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className={cn("w-2 h-2 rounded-full",
              isRunning ? "bg-green-500 animate-pulse" : "bg-muted-foreground"
            )} />
            <span className="text-xs font-medium">
              {isRunning ? "Working..." : runInfo ? "Completed" : "No active run"}
            </span>
          </div>
          <MetricRow icon={DollarSign} label="Cost" value={`$${cost.toFixed(4)}`}
            valueClass={cn("font-semibold", cost > 2 ? "text-destructive" : "")}
          />
          <MetricRow icon={Cpu} label="Tokens in" value={formatTokens(tokensIn)} />
          <MetricRow icon={Cpu} label="Tokens out" value={formatTokens(tokensOut)} />
          {cachedTokens > 0 && (
            <MetricRow icon={Cpu} label="Cached" value={formatTokens(cachedTokens)} valueClass="text-green-600" />
          )}
          <MetricRow icon={Clock} label="Duration"
            value={duration !== null ? `${Math.floor(duration / 60)}m${duration % 60}s` : "—"}
          />
          <MetricRow icon={Wrench} label="Tool calls" value={toolCalls.length} />
          <MetricRow icon={BookOpen} label="Lessons" value={lessons.length}
            valueClass={lessons.length > 0 ? "text-primary font-semibold" : ""}
          />
        </div>

        {/* Events */}
        <div className="p-3 space-y-2">
          <SectionHeader>Events</SectionHeader>
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
