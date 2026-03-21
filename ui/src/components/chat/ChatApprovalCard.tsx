import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { approvalsApi } from "../../api/approvals";
import { Button } from "@/components/ui/button";
import { Check, X, Eye } from "lucide-react";
import { cn } from "../../lib/utils";

type ChatApprovalCardProps = {
  approvalId: string;
  toolName: string;
  payload: Record<string, unknown>;
  status: string;
};

export function ChatApprovalCard({
  approvalId,
  toolName,
  payload,
  status,
}: ChatApprovalCardProps) {
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();

  const approve = useMutation({
    mutationFn: () => approvalsApi.approve(approvalId, "Approved from chat"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["approvals"] }),
  });

  const reject = useMutation({
    mutationFn: () => approvalsApi.reject(approvalId, "Rejected from chat"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["approvals"] }),
  });

  const isPending = status === "pending_approval";

  return (
    <div className="border rounded-lg p-2.5 bg-muted/30 text-xs space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className={cn(
            "w-2 h-2 rounded-full",
            isPending ? "bg-amber-400" : status === "approved" ? "bg-green-400" : "bg-red-400",
          )} />
          <span className="font-mono font-semibold">{toolName}</span>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 rounded hover:bg-muted"
        >
          <Eye className="h-3 w-3" />
        </button>
      </div>

      {expanded && (
        <pre className="text-[10px] bg-muted rounded p-2 overflow-x-auto max-h-32">
          {JSON.stringify(payload, null, 2)}
        </pre>
      )}

      {isPending && (
        <div className="flex items-center gap-1.5 justify-end">
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[10px] gap-1"
            onClick={() => reject.mutate()}
            disabled={reject.isPending}
          >
            <X className="h-3 w-3" /> Deny
          </Button>
          <Button
            size="sm"
            className="h-6 text-[10px] gap-1"
            onClick={() => approve.mutate()}
            disabled={approve.isPending}
          >
            <Check className="h-3 w-3" /> Approve
          </Button>
        </div>
      )}

      {!isPending && (
        <div className="text-[10px] text-muted-foreground">
          {status === "approved" ? "Approved" : "Rejected"}
        </div>
      )}
    </div>
  );
}
