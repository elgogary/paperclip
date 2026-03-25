import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../../context/CompanyContext";
import { evolutionApi, type EvolutionEvent } from "../../api/evolution";
import { queryKeys } from "../../lib/queryKeys";
import { cn } from "../../lib/utils";
import { Button } from "@/components/ui/button";
import { Clock, Eye, FileText, Loader2 } from "lucide-react";

export function EvolutionPendingReviews() {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.evolution.events(selectedCompanyId!, "pending"),
    queryFn: () => evolutionApi.listEvents(selectedCompanyId!, 50, "pending"),
    enabled: !!selectedCompanyId,
  });

  const [mutatingEventId, setMutatingEventId] = useState<string | null>(null);

  const approveMutation = useMutation({
    mutationFn: (eventId: string) => {
      setMutatingEventId(eventId);
      return evolutionApi.approveEvent(selectedCompanyId!, eventId);
    },
    onSettled: () => setMutatingEventId(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.evolution.events(selectedCompanyId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.evolution.events(selectedCompanyId!, "pending") });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (eventId: string) => {
      setMutatingEventId(eventId);
      return evolutionApi.rejectEvent(selectedCompanyId!, eventId);
    },
    onSettled: () => setMutatingEventId(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.evolution.events(selectedCompanyId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.evolution.events(selectedCompanyId!, "pending") });
    },
  });

  const events = data?.events ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span className="text-xs">Loading pending reviews...</span>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-xs text-muted-foreground/60">No pending evolutions to review.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Clock className="h-3.5 w-3.5 text-amber-500" />
        <span className="text-xs font-medium text-foreground">
          {events.length} pending evolution{events.length !== 1 ? "s" : ""}
        </span>
      </div>

      {events.map((event, idx) => (
        <PendingCard
          key={event.id}
          event={event}
          index={idx + 1}
          onApprove={() => approveMutation.mutate(event.id)}
          onReject={() => rejectMutation.mutate(event.id)}
          isPending={mutatingEventId === event.id}
        />
      ))}
    </div>
  );
}

interface PendingCardProps {
  event: EvolutionEvent;
  index: number;
  onApprove: () => void;
  onReject: () => void;
  isPending: boolean;
}

function PendingCard({ event, index, onApprove, onReject, isPending }: PendingCardProps) {
  const analysis = event.analysis ?? {};
  const label = event.eventType.toUpperCase();
  const skillSlug = String(analysis.skillSlug ?? analysis.description ?? "unknown");
  const confidence = typeof analysis.confidence === "number" ? analysis.confidence : undefined;

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground">{index}.</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500">
              {label}:
            </span>
            <span className="text-xs font-medium text-foreground truncate">{skillSlug}</span>
          </div>
          {confidence !== undefined && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Confidence: {(confidence * 100).toFixed(0)}%
              {confidence < 0.8 && " (below auto-approve)"}
            </p>
          )}
          {analysis.reason ? (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {String(analysis.reason).replace(/_/g, " ")}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {event.proposedContent && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[11px] px-2 text-muted-foreground"
          >
            <FileText className="h-3 w-3 mr-1" />
            View Content
          </Button>
        )}
        {!event.proposedContent && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[11px] px-2 text-muted-foreground"
          >
            <Eye className="h-3 w-3 mr-1" />
            View Details
          </Button>
        )}
        <div className="flex-1" />
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
    </div>
  );
}
