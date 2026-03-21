/**
 * ChatView — 3-panel chat layout (Sidebar + Chat + Debug)
 * Uses assistant-ui for message rendering, custom composer for full feature parity with ChatModal.
 * Phase 1.5: markdown, typing indicator, voice, attachments, slash commands, suggestions, copy.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AssistantRuntimeProvider,
  ThreadPrimitive,
  MessagePrimitive,
} from "@assistant-ui/react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useCompany } from "../../context/CompanyContext";
import { agentsApi } from "../../api/agents";
import { issuesApi } from "../../api/issues";
import { queryKeys } from "../../lib/queryKeys";
import { cn } from "../../lib/utils";
import { usePaperclipChat } from "./paperclip-runtime";
import { ChatSidebar } from "./ChatSidebar";
import { ChatDebugPanel } from "./ChatDebugPanel";
import { ChatLearningBanner } from "./ChatLearningBanner";
import { TypingIndicator } from "./TypingIndicator";
import { QuickSuggestions } from "./QuickSuggestions";
import { SlashCommandMenu, type SlashCommand } from "./SlashCommandMenu";
import { VoiceRecorder } from "./VoiceRecorder";
import { MarkdownBody } from "../MarkdownBody";
import {
  Send,
  Paperclip as PaperclipIcon,
  X,
  Copy,
  Check,
} from "lucide-react";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={handleCopy}
      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-background/50 text-muted-foreground hover:text-foreground"
      title="Copy message"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

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
  const [inputValue, setInputValue] = useState("");
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashSearch, setSlashSearch] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: agents = [] } = useQuery({
    queryKey: queryKeys.agents.list(companyId ?? ""),
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

  const { runtime, isRunning, activeRunId, comments } = usePaperclipChat({
    issueId: selectedIssueId ?? "",
    companyId: companyId ?? "",
    agentId: selectedAgentId ?? "",
    currentUserId: null,
  });

  const sendMessage = useMutation({
    mutationFn: async (text: string) => {
      if (!selectedIssueId) return;
      await issuesApi.addComment(selectedIssueId, text);
      try {
        await agentsApi.wakeup(selectedAgentId!, {
          source: "on_demand",
          triggerDetail: "manual",
          reason: "Chat message",
        });
      } catch { /* agent may be running */ }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.comments(selectedIssueId!) });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);

  const handleSend = useCallback(async () => {
    if (!inputValue.trim() && attachments.length === 0) return;

    if (inputValue.trim()) {
      sendMessage.mutate(inputValue.trim());
    }

    if (attachments.length > 0) {
      await Promise.all(
        attachments.map((file) =>
          issuesApi.uploadAttachment(companyId!, selectedIssueId!, file).catch(() => {
            /* individual upload failed — continue with rest */
          }),
        ),
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.attachments(selectedIssueId!) });
    }

    setInputValue("");
    setAttachments([]);
  }, [inputValue, attachments, selectedIssueId, companyId, sendMessage, queryClient]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Escape" && slashOpen) {
      setSlashOpen(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputValue(val);
    if (val.startsWith("/")) {
      setSlashOpen(true);
      setSlashSearch(val);
    } else {
      setSlashOpen(false);
    }
  };

  const handleSlashCommand = useCallback(async (cmd: SlashCommand) => {
    setSlashOpen(false);
    if (cmd.name === "status") {
      setInputValue("What is your current status?");
    } else if (cmd.name === "clear") {
      if (selectedIssueId) {
        queryClient.setQueryData(queryKeys.issues.comments(selectedIssueId), []);
      }
      setInputValue("");
    } else if (cmd.name === "help") {
      setInputValue("/help — show commands\n/clear — clear chat\n/status — ask status\n/retry — re-run heartbeat");
    } else if (cmd.name === "retry") {
      if (selectedAgentId) {
        try { await agentsApi.wakeup(selectedAgentId, { source: "on_demand", triggerDetail: "manual", reason: "Retry from chat" }); } catch { /* agent may be running */ }
      }
      setInputValue("");
    }
  }, [selectedIssueId, selectedAgentId, queryClient]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setAttachments((prev) => [...prev, ...files]);
    e.target.value = "";
  };

  const handleNewConversation = useCallback(() => {
    if (selectedAgentId) {
      createConversation.mutate();
    }
  }, [selectedAgentId, createConversation]);

  const showChat = selectedAgentId && selectedIssueId;
  const selectedAgent = agents.find((a: { id: string }) => a.id === selectedAgentId);

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
          setSelectedAgentId(id || null);
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
          <>
            {/* Messages area — render from comments directly with markdown + copy */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {comments.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Send a message to start the conversation
                </p>
              )}
              {comments.map((comment: { id: string; body: string; authorAgentId: string | null; authorUserId: string | null }) => {
                const isAgent = !!comment.authorAgentId;
                return (
                  <div key={comment.id} className={cn("flex group items-start gap-1", isAgent ? "justify-start" : "justify-end")}>
                    {!isAgent && <CopyButton text={comment.body} />}
                    <div className={cn(
                      "max-w-[70%] rounded-2xl px-4 py-2.5 text-sm",
                      isAgent
                        ? "bg-muted rounded-bl-md"
                        : "bg-primary text-primary-foreground rounded-br-md"
                    )}>
                      {isAgent ? (
                        <MarkdownBody className="text-sm [&_pre]:text-xs">{comment.body}</MarkdownBody>
                      ) : (
                        <div className="whitespace-pre-wrap break-words">{comment.body}</div>
                      )}
                    </div>
                    {isAgent && <CopyButton text={comment.body} />}
                  </div>
                );
              })}
              {(sendMessage.isPending || isRunning) && (
                <div className="flex justify-start">
                  <div className="max-w-[70%] rounded-2xl rounded-bl-md bg-muted px-4 py-2.5">
                    <TypingIndicator />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {lessons.length > 0 && (
              <ChatLearningBanner
                lessons={lessons}
                onDismiss={() => setLessons([])}
              />
            )}

            {/* Composer — custom textarea with all features */}
            <div className="border-t shrink-0">
              <QuickSuggestions
                agentRole={selectedAgent?.role ?? "general"}
                onSelect={(text) => setInputValue(text)}
                visible={comments.length === 0 && !inputValue}
              />

              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-1 px-4 pb-1">
                  {attachments.map((file, i) => (
                    <span key={i} className="text-[10px] bg-muted px-2 py-0.5 rounded-full flex items-center gap-1">
                      {file.name}
                      <button onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}>
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="p-3 pt-1.5">
                <div className="flex items-end gap-2">
                  <div className="flex-1 relative">
                    <SlashCommandMenu
                      open={slashOpen}
                      search={slashSearch}
                      onSelect={handleSlashCommand}
                      onClose={() => setSlashOpen(false)}
                    />
                    <textarea
                      value={inputValue}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyDown}
                      placeholder="Type a message... (/ for commands)"
                      rows={1}
                      className="w-full resize-none rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 pr-20 min-h-[40px] max-h-[200px]"
                    />
                    <div className="absolute right-2 bottom-1.5 flex items-center gap-0.5">
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileSelect}
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                        title="Attach file"
                      >
                        <PaperclipIcon className="h-3.5 w-3.5" />
                      </button>
                      <VoiceRecorder
                        onTranscript={(text) => setInputValue((prev) => prev + text)}
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleSend}
                    disabled={(!inputValue.trim() && attachments.length === 0) || sendMessage.isPending}
                    className="h-10 w-10 rounded-xl bg-primary text-white flex items-center justify-center hover:bg-primary/90 disabled:opacity-50 shrink-0"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </>
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
          agentId={selectedAgentId}
          companyId={companyId}
        />
      )}
    </div>
  );
}
