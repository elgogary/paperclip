/**
 * ChatView — 3-panel chat layout (Sidebar + Chat + Debug)
 * Uses assistant-ui primitives for the chat area, Paperclip APIs for data
 */
import { useCallback, useEffect, useState } from "react";
import {
  AssistantRuntimeProvider,
  ThreadPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
} from "@assistant-ui/react";
// Markdown rendering handled by MessagePrimitive.Content defaults
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../../context/CompanyContext";
import { agentsApi } from "../../api/agents";
import { issuesApi } from "../../api/issues";
import { heartbeatsApi } from "../../api/heartbeats";
import { queryKeys } from "../../lib/queryKeys";
import { usePaperclipChat } from "./paperclip-runtime";
import { ChatSidebar } from "./ChatSidebar";
import { ChatDebugPanel } from "./ChatDebugPanel";
import { ChatLearningBanner } from "./ChatLearningBanner";
import { Button } from "@/components/ui/button";
import { Send, Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

type ChatViewProps = {
  initialAgentId?: string;
  initialIssueId?: string;
};

export function ChatView({ initialAgentId, initialIssueId }: ChatViewProps) {
  const { selectedCompanyId: companyId } = useCompany();
  const queryClient = useQueryClient();

  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(
    initialAgentId ?? null,
  );
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(
    initialIssueId ?? null,
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [debugCollapsed, setDebugCollapsed] = useState(false);
  const [lessons, setLessons] = useState<
    { type: "lesson" | "rule" | "knowledge"; text: string }[]
  >([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  const { data: agents = [] } = useQuery({
    queryKey: queryKeys.agents.list(companyId!),
    queryFn: () => agentsApi.list(companyId!),
    enabled: !!companyId,
  });

  const { data: conversations = [] } = useQuery({
    queryKey: ["chat-conversations", companyId, selectedAgentId],
    queryFn: () =>
      issuesApi.list(companyId!, {
        assigneeAgentId: selectedAgentId!,
        status: "todo,in_progress,done,blocked",
      }),
    enabled: !!selectedAgentId && !!companyId,
  });

  const createConversation = useMutation({
    mutationFn: async () => {
      const agent = agents.find((a: { id: string }) => a.id === selectedAgentId);
      return issuesApi.create(companyId!, {
        title: `Chat with ${agent?.name ?? "Agent"}`,
        description: "Conversation started from Chat UI",
        status: "todo",
        assigneeAgentId: selectedAgentId!,
      });
    },
    onSuccess: (issue: { id: string }) => {
      setSelectedIssueId(issue.id);
      queryClient.invalidateQueries({
        queryKey: ["chat-conversations", companyId, selectedAgentId],
      });
    },
  });

  const { runtime, isRunning } = usePaperclipChat({
    issueId: selectedIssueId ?? "",
    companyId: companyId ?? "",
    agentId: selectedAgentId ?? "",
    currentUserId: null,
  });

  useEffect(() => {
    if (!selectedIssueId) return;
    const pollRun = async () => {
      try {
        const run = await heartbeatsApi.activeRunForIssue(selectedIssueId);
        if (run?.id) setActiveRunId(run.id);
      } catch {
        // no run
      }
    };
    pollRun();
    if (isRunning) {
      const interval = setInterval(pollRun, 3000);
      return () => clearInterval(interval);
    }
  }, [selectedIssueId, isRunning]);

  const handleNewConversation = useCallback(() => {
    if (selectedAgentId) {
      createConversation.mutate();
    }
  }, [selectedAgentId, createConversation]);

  const showChat = selectedAgentId && selectedIssueId;

  const convItems = conversations.map((c: { id: string; identifier: string | null; title: string; status: string; updatedAt: string | Date }) => ({
    id: c.id,
    identifier: c.identifier ?? c.id.slice(0, 8),
    title: c.title,
    status: c.status,
    updatedAt: typeof c.updatedAt === "string" ? c.updatedAt : c.updatedAt.toISOString(),
  }));

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-background">
      <ChatSidebar
        agents={agents}
        selectedAgentId={selectedAgentId}
        onSelectAgent={(id) => {
          setSelectedAgentId(id);
          setSelectedIssueId(null);
        }}
        conversations={convItems}
        selectedIssueId={selectedIssueId}
        onSelectConversation={setSelectedIssueId}
        onNewConversation={handleNewConversation}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {showChat ? (
          <AssistantRuntimeProvider runtime={runtime}>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <ThreadPrimitive.Messages
                components={{
                  UserMessage: () => (
                    <MessagePrimitive.Root className="flex justify-end mb-3">
                      <div className="max-w-[70%] rounded-2xl rounded-br-md bg-primary text-primary-foreground px-4 py-2.5 text-sm">
                        <MessagePrimitive.Content />
                      </div>
                    </MessagePrimitive.Root>
                  ),
                  AssistantMessage: () => (
                    <MessagePrimitive.Root className="flex justify-start mb-3">
                      <div className="max-w-[70%] rounded-2xl rounded-bl-md bg-muted px-4 py-2.5 text-sm">
                        <MessagePrimitive.Content />
                      </div>
                    </MessagePrimitive.Root>
                  ),
                }}
              />
              {isRunning && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground px-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Agent is working...
                </div>
              )}
            </div>

            {lessons.length > 0 && (
              <ChatLearningBanner
                lessons={lessons}
                onDismiss={() => setLessons([])}
              />
            )}

            <div className="border-t p-3">
              <ComposerPrimitive.Root className="flex items-end gap-2">
                <ComposerPrimitive.Input
                  placeholder="Type a message..."
                  className="flex-1 resize-none rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[40px] max-h-[200px]"
                />
                <ComposerPrimitive.Send asChild>
                  <Button size="icon" className="h-10 w-10 rounded-xl shrink-0">
                    <Send className="h-4 w-4" />
                  </Button>
                </ComposerPrimitive.Send>
              </ComposerPrimitive.Root>
            </div>
          </AssistantRuntimeProvider>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-3">
              <div className="text-4xl">💬</div>
              <h2 className="text-lg font-semibold">Optiflow Chat</h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                Select an agent from the sidebar, then start or continue a
                conversation.
              </p>
            </div>
          </div>
        )}
      </div>

      {showChat && (
        <ChatDebugPanel
          runId={activeRunId}
          isRunning={isRunning}
          collapsed={debugCollapsed}
          onToggleCollapse={() => setDebugCollapsed((c) => !c)}
        />
      )}
    </div>
  );
}
