import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../../context/CompanyContext";
import { evolutionApi, type EvolutionEvent } from "../../api/evolution";
import { queryKeys } from "../../lib/queryKeys";
import { timeAgo } from "../../lib/timeAgo";
import { cn } from "../../lib/utils";
import { Button } from "@/components/ui/button";
import { Wrench, Sparkles, Rocket, Flag, AlertTriangle, Loader2 } from "lucide-react";

const EVENT_CONFIG: Record<string, { icon: typeof Wrench; label: string; color: string }> = {
  fix: { icon: Wrench, label: "FIX", color: "text-amber-500" },
  captured: { icon: Sparkles, label: "CAPTURED", color: "text-emerald-500" },
  derived: { icon: Rocket, label: "DERIVED", color: "text-blue-500" },
  flagged: { icon: Flag, label: "FLAGGED", color: "text-orange-500" },
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-400",
  applied: "bg-emerald-500/15 text-emerald-400",
  rejected: "bg-red-500/15 text-red-400",
};

export function EvolutionTimeline() {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.evolution.events(selectedCompanyId!),
    queryFn: () => evolutionApi.listEvents(selectedCompanyId!, 20),
    enabled: !!selectedCompanyId,
  });

  const approveMutation = useMutation({
    mutationFn: (eventId: string) => evolutionApi.approveEvent(selectedCompanyId!, eventId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.evolution.events(selectedCompanyId!) });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (eventId: string) => evolutionApi.rejectEvent(selectedCompanyId!, eventId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.evolution.events(selectedCompanyId!) });
    },
  });

  const events = data?.events ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        <span className="text-xs">Loading evolution events...</span>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
        <p className="text-xs text-muted-foreground">No evolution events yet.</p>
        <p className="text-[11px] text-muted-foreground/60 mt-0.5">
          Events appear as agents use skills and the system detects improvements.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {events.map((event, idx) => (
        <TimelineItem
          key={event.id}
          event={event}
          isLast={idx === events.length - 1}
          onApprove={() => approveMutation.mutate(event.id)}
          onReject={() => rejectMutation.mutate(event.id)}
          isPending={approveMutation.isPending || rejectMutation.isPending}
        />
      ))}
    </div>
  );
}

interface TimelineItemProps {
  event: EvolutionEvent;
  isLast: boolean;
  onApprove: () => void;
  onReject: () => void;
  isPending: boolean;
}

function TimelineItem({ event, isLast, onApprove, onReject, isPending }: TimelineItemProps) {
  const config = EVENT_CONFIG[event.eventType] ?? EVENT_CONFIG.flagged;
  const Icon = config.icon;
  const analysis = event.analysis ?? {};
  const description = buildDescription(event);

  return (
    <div className="flex gap-3 group">
      {/* Timeline line + icon */}
      <div className="flex flex-col items-center shrink-0">
        <div className={cn("p-1 rounded-full border border-border bg-card", config.color)}>
          <Icon className="h-3 w-3" />
        </div>
        {!isLast && <div className="w-px flex-1 bg-border min-h-[24px]" />}
      </div>

      {/* Content */}
      <div className="pb-4 flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn("text-[10px] font-bold uppercase tracking-wider", config.color)}>
            {config.label}
          </span>
          {analysis.skillSlug ? (
            <span className="text-xs font-medium text-foreground">
              {String(analysis.skillSlug)}
            </span>
          ) : null}
          <span className="text-[10px] text-muted-foreground">{timeAgo(event.createdAt)}</span>
          <span className={cn("text-[10px] px-1.5 py-px rounded-full font-medium", STATUS_STYLES[event.status] ?? STATUS_STYLES.pending)}>
            {event.status}
          </span>
        </div>

        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>

        {event.sourceMonitor && (
          <span className="text-[10px] text-muted-foreground/50 mt-0.5 block">
            Source: {event.sourceMonitor.replace(/_/g, " ")}
          </span>
        )}

        {event.status === "pending" && (
          <div className="flex gap-1.5 mt-2">
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-[11px] px-2 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10"
              onClick={onApprove}
              disabled={isPending}
            >
              Approve
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-[11px] px-2 text-red-400 border-red-400/30 hover:bg-red-400/10"
              onClick={onReject}
              disabled={isPending}
            >
              Reject
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function buildDescription(event: EvolutionEvent): string {
  const analysis = event.analysis ?? {};
  const reason = String(analysis.reason ?? "");

  switch (reason) {
    case "skill_unhelpful":
      return `Skill was used but marked as unhelpful (v${analysis.version ?? "?"}).`;
    case "novel_pattern":
      return String(analysis.description ?? "Novel pattern detected in agent run.");
    case "tool_degradation":
      return `Tool "${analysis.toolName}" returned error: ${analysis.errorMessage ?? "unknown"}`;
    case "low_completion_rate":
      return `Completion rate dropped to ${Math.round(((analysis.completionRate as number | undefined) ?? 0) * 100)}%.`;
    case "dormant_low_applied_rate":
      return `Applied rate is ${Math.round(((analysis.appliedRate as number | undefined) ?? 0) * 100)}% -- marked dormant.`;
    default:
      return reason.replace(/_/g, " ") || "Evolution event detected.";
  }
}
