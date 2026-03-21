/**
 * Paperclip Runtime Adapter for assistant-ui
 *
 * Maps Paperclip's issue comments + heartbeat runs to assistant-ui's
 * message model. Zero new backend endpoints — uses existing APIs.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ThreadMessageLike } from "@assistant-ui/react";
import {
  useExternalStoreRuntime,
  useExternalMessageConverter,
} from "@assistant-ui/react";
import { issuesApi } from "../../api/issues";
import { heartbeatsApi } from "../../api/heartbeats";
import { agentsApi } from "../../api/agents";
import type { IssueComment, HeartbeatRunEvent } from "@paperclipai/shared";

function commentToThreadMessage(
  comment: IssueComment,
  currentUserId: string | null,
): ThreadMessageLike {
  const isUser = comment.authorUserId != null && comment.authorUserId === currentUserId;
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
  const [comments, setComments] = useState<IssueComment[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadComments = useCallback(async () => {
    if (!issueId) return;
    try {
      const result = await issuesApi.listComments(issueId);
      setComments(result);
    } catch {
      // silently fail
    }
  }, [issueId]);

  const pollActiveRun = useCallback(async () => {
    if (!issueId) return;
    try {
      const activeRun = await heartbeatsApi.activeRunForIssue(issueId);
      if (activeRun && (activeRun.status === "running" || activeRun.status === "queued")) {
        setIsRunning(true);
        const events = await heartbeatsApi.events(activeRun.id);
        const assistantTexts = events
          .filter((e) => {
            const p = e.payload as Record<string, unknown> | null;
            return p?.type === "assistant" || p?.subtype === "assistant_text";
          })
          .map((e) => {
            const p = e.payload as Record<string, unknown> | null;
            const content = p?.content ?? p?.text ?? "";
            return typeof content === "string" ? content : JSON.stringify(content);
          });
        if (assistantTexts.length > 0) {
          setStreamingText(assistantTexts[assistantTexts.length - 1]);
        }
      } else {
        if (isRunning) {
          setIsRunning(false);
          setStreamingText("");
          await loadComments();
        }
      }
    } catch {
      // silently fail
    }
  }, [issueId, isRunning, loadComments]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  useEffect(() => {
    if (isRunning) {
      pollRef.current = setInterval(pollActiveRun, 2000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isRunning, pollActiveRun]);

  // Convert comments to ThreadMessageLike
  const threadMessages = useMemo((): ThreadMessageLike[] => {
    const msgs = comments.map((c) => commentToThreadMessage(c, currentUserId));
    if (isRunning && streamingText) {
      msgs.push({
        id: "streaming",
        role: "assistant",
        content: [{ type: "text", text: streamingText }],
      });
    }
    return msgs;
  }, [comments, currentUserId, isRunning, streamingText]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onNew = useCallback(
    async (message: any) => {
      const textPart = message.content.find((p: { type: string; text?: string }) => p.type === "text" && p.text);
      if (!textPart?.text) return;

      await issuesApi.addComment(issueId, textPart.text);

      setComments((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}`,
          issueId,
          body: textPart.text!,
          authorAgentId: null,
          authorUserId: currentUserId,
          authorAgentName: null,
          authorUserName: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as unknown as IssueComment,
      ]);

      try {
        await agentsApi.wakeup(agentId, {
          source: "on_demand",
          triggerDetail: "manual",
          reason: "Chat message on issue",
        });
      } catch {
        // agent might already be running
      }

      setIsRunning(true);
      pollActiveRun();
    },
    [issueId, agentId, currentUserId, pollActiveRun],
  );

  // @ts-expect-error -- adapter type mismatch with assistant-ui generics
  const runtime = useExternalStoreRuntime({
    messages: threadMessages,
    isRunning,
    onNew,
  });

  return {
    runtime,
    isRunning,
    reload: loadComments,
  };
}
