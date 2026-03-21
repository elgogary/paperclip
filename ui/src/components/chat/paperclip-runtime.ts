/**
 * Paperclip Runtime Adapter for assistant-ui
 *
 * Uses React Query (auto-invalidated by LiveUpdatesProvider WebSocket)
 * instead of manual polling. Falls back to 5s refetchInterval.
 */
import { useCallback, useMemo } from "react";
import type { ThreadMessageLike } from "@assistant-ui/react";
import { useExternalStoreRuntime } from "@assistant-ui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { issuesApi } from "../../api/issues";
import { heartbeatsApi } from "../../api/heartbeats";
import { agentsApi } from "../../api/agents";
import { queryKeys } from "../../lib/queryKeys";
import type { IssueComment } from "@paperclipai/shared";

function commentToThreadMessage(
  comment: IssueComment,
  currentUserId: string | null,
): ThreadMessageLike {
  const isUser =
    comment.authorUserId != null && comment.authorUserId === currentUserId;
  return {
    id: comment.id,
    role: isUser ? "user" : "assistant",
    content: [{ type: "text", text: comment.body }],
  };
}

export type UsePaperclipChatOptions = {
  issueId: string;
  companyId: string;
  agentId: string;
  currentUserId: string | null;
};

export function usePaperclipChat({
  issueId,
  companyId,
  agentId,
  currentUserId,
}: UsePaperclipChatOptions) {
  const queryClient = useQueryClient();

  const { data: comments = [] } = useQuery({
    queryKey: queryKeys.issues.comments(issueId),
    queryFn: () => issuesApi.listComments(issueId),
    enabled: !!issueId,
    refetchInterval: 5000,
  });

  const { data: activeRun } = useQuery({
    queryKey: queryKeys.issues.activeRun(issueId),
    queryFn: () => heartbeatsApi.activeRunForIssue(issueId),
    enabled: !!issueId,
    refetchInterval: 5000,
  });

  const isRunning =
    activeRun?.status === "running" || activeRun?.status === "queued";

  const threadMessages = useMemo((): ThreadMessageLike[] => {
    return comments.map((c) => commentToThreadMessage(c, currentUserId));
  }, [comments, currentUserId]);

  const onNew = useCallback(
    async (message: { content: { type: string; text?: string }[] }) => {
      const textPart = message.content.find(
        (p) => p.type === "text" && p.text,
      );
      if (!textPart?.text) return;

      await issuesApi.addComment(issueId, textPart.text);

      queryClient.invalidateQueries({
        queryKey: queryKeys.issues.comments(issueId),
      });

      try {
        await agentsApi.wakeup(agentId, {
          source: "on_demand",
          triggerDetail: "manual",
          reason: "Chat message on issue",
        });
      } catch {
        // agent might already be running
      }
    },
    [issueId, agentId, queryClient],
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const runtime = useExternalStoreRuntime({
    messages: threadMessages,
    isRunning,
    onNew,
  } as any);

  return {
    runtime,
    isRunning,
    activeRunId: activeRun?.id ?? null,
    comments,
  };
}
