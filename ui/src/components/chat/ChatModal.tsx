/**
 * ChatModal — Floating chat button with 3 modes:
 *   FAB → Popup (small, bottom-right) → Full Panel (sidebar)
 *
 * Phase 1.5: All features wired — markdown, slash commands, voice,
 * attachments, copy, history, export, clear, suggestions, typing indicator.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../../context/CompanyContext";
import { agentsApi } from "../../api/agents";
import { issuesApi } from "../../api/issues";
import { heartbeatsApi } from "../../api/heartbeats";
import { queryKeys } from "../../lib/queryKeys";
import { cn } from "../../lib/utils";
import { MarkdownBody } from "../MarkdownBody";
import { TypingIndicator } from "./TypingIndicator";
import { QuickSuggestions } from "./QuickSuggestions";
import { SlashCommandMenu, type SlashCommand } from "./SlashCommandMenu";
import { VoiceRecorder } from "./VoiceRecorder";
import { ChatHistoryDrawer } from "./ChatHistoryDrawer";
import { ChatToolsDrawer } from "./ChatToolsDrawer";
import { AGENT_ICONS, ROLE_COLORS, DEFAULT_ICON } from "./chat-constants";
import {
  MessageSquare,
  X,
  Maximize2,
  Minimize2,
  Send,
  Paperclip as PaperclipIcon,
  History,
  Wrench,
  ChevronLeft,
  Plus,
  Trash2,
  Download,
  Copy,
  Check,
} from "lucide-react";

type ChatMode = "closed" | "popup" | "panel";

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

export function ChatModal() {
  const { selectedCompanyId: companyId } = useCompany();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<ChatMode>("closed");
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashSearch, setSlashSearch] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: agents = [] } = useQuery({
    queryKey: queryKeys.agents.list(companyId ?? ""),
    queryFn: () => agentsApi.list(companyId!),
    enabled: !!companyId && mode !== "closed",
  });

  const { data: conversations = [] } = useQuery({
    queryKey: ["chat-conversations", companyId, selectedAgentId],
    queryFn: () => issuesApi.list(companyId!, {
      assigneeAgentId: selectedAgentId!,
      status: "todo,in_progress,done,blocked",
    }),
    enabled: !!selectedAgentId && !!companyId,
  });

  const { data: comments = [] } = useQuery({
    queryKey: queryKeys.issues.comments(selectedIssueId ?? ""),
    queryFn: () => issuesApi.listComments(selectedIssueId!),
    enabled: !!selectedIssueId,
    refetchInterval: 5000,
  });

  const { data: activeRun } = useQuery({
    queryKey: queryKeys.issues.activeRun(selectedIssueId ?? ""),
    queryFn: () => heartbeatsApi.activeRunForIssue(selectedIssueId!),
    enabled: !!selectedIssueId,
    refetchInterval: 5000,
  });

  const isAgentRunning = activeRun?.status === "running" || activeRun?.status === "queued";

  const { data: agentConfig } = useQuery({
    queryKey: ["agent-config", selectedAgentId],
    queryFn: () => agentsApi.getConfiguration(selectedAgentId!),
    enabled: !!selectedAgentId && toolsOpen,
  });

  const createConversation = useMutation({
    mutationFn: async () => {
      const agent = agents.find((a: { id: string }) => a.id === selectedAgentId);
      return issuesApi.create(companyId!, {
        title: `Chat with ${agent?.name ?? "Agent"}`,
        description: "Conversation started from Chat modal",
        status: "todo",
        assigneeAgentId: selectedAgentId!,
      });
    },
    onSuccess: (issue: { id: string }) => {
      setSelectedIssueId(issue.id);
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    },
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

  const handleExport = useCallback(() => {
    if (!comments.length) return;
    const agent = agents.find((a: { id: string }) => a.id === selectedAgentId);
    const lines = comments.map((c: { authorAgentId: string | null; body: string }) => {
      const role = c.authorAgentId ? (agent?.name ?? "Agent") : "You";
      return `**${role}:**\n${c.body}\n`;
    });
    const md = `# Chat with ${agent?.name ?? "Agent"}\n\n${lines.join("\n---\n\n")}`;
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-${agent?.name ?? "agent"}-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [comments, agents, selectedAgentId]);

  const handleClear = useCallback(() => {
    if (!window.confirm("Clear this conversation display? (Messages are preserved in the issue)")) return;
    if (selectedIssueId) {
      queryClient.setQueryData(queryKeys.issues.comments(selectedIssueId), []);
    }
  }, [selectedIssueId, queryClient]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setAttachments((prev) => [...prev, ...files]);
    e.target.value = "";
  };

  // --- FAB Button ---
  if (mode === "closed") {
    return (
      <button
        onClick={() => setMode("popup")}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center"
      >
        <MessageSquare className="h-6 w-6" />
      </button>
    );
  }

  const isPopup = mode === "popup";
  const selectedAgent = agents.find((a: { id: string }) => a.id === selectedAgentId);
  const AgentIcon = AGENT_ICONS[selectedAgent?.icon ?? ""] ?? DEFAULT_ICON;

  return (
    <div
      className={cn(
        "fixed z-50 bg-card border shadow-2xl flex flex-col transition-all duration-300",
        isPopup
          ? "bottom-6 right-6 w-[380px] h-[520px] rounded-2xl"
          : "top-0 right-0 w-[440px] h-full rounded-none border-l"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card shrink-0">
        <div className="flex items-center gap-2.5">
          {selectedAgent ? (
            <>
              <button
                onClick={() => { setSelectedAgentId(null); setSelectedIssueId(null); setHistoryOpen(false); setToolsOpen(false); }}
                className="text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-white", ROLE_COLORS[selectedAgent.role] ?? "bg-muted")}>
                <AgentIcon className="h-3.5 w-3.5" />
              </div>
              <div>
                <div className="text-sm font-semibold leading-none">{selectedAgent.name}</div>
                <div className="text-[10px] text-muted-foreground">{selectedAgent.title}</div>
              </div>
            </>
          ) : (
            <>
              <MessageSquare className="h-5 w-5 text-primary" />
              <span className="text-sm font-semibold">Optiflow Chat</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          {selectedIssueId && (
            <>
              <button
                onClick={() => { setHistoryOpen(!historyOpen); setToolsOpen(false); }}
                className={cn("p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground", historyOpen && "bg-muted text-foreground")}
                title="History"
              >
                <History className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => { setToolsOpen(!toolsOpen); setHistoryOpen(false); }}
                className={cn("p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground", toolsOpen && "bg-muted text-foreground")}
                title="Tools"
              >
                <Wrench className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={handleExport}
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                title="Export conversation"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={handleClear}
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                title="Clear conversation"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          <button
            onClick={() => setMode(isPopup ? "panel" : "popup")}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
            title={isPopup ? "Expand" : "Minimize"}
          >
            {isPopup ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={() => setMode("closed")}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto relative">
        <ChatHistoryDrawer
          open={historyOpen}
          conversations={conversations}
          selectedIssueId={selectedIssueId}
          onSelectConversation={setSelectedIssueId}
          onClose={() => setHistoryOpen(false)}
        />
        <ChatToolsDrawer
          open={toolsOpen}
          agentConfig={agentConfig}
          onSelectTool={(key) => setInputValue(`/skill ${key}`)}
          onClose={() => setToolsOpen(false)}
        />

        {!selectedAgentId ? (
          /* Agent selection */
          <div className="p-3 space-y-1">
            <p className="text-[11px] text-muted-foreground px-1 mb-2">Select an agent to chat with:</p>
            {agents.map((agent: { id: string; name: string; title: string | null; icon: string | null; role: string; status: string }) => {
              const Icon = AGENT_ICONS[agent.icon ?? ""] ?? DEFAULT_ICON;
              return (
                <button
                  key={agent.id}
                  onClick={() => setSelectedAgentId(agent.id)}
                  className="w-full flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-primary/5 hover:border-primary/20 border border-transparent transition-all text-left"
                >
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-white", ROLE_COLORS[agent.role] ?? "bg-muted")}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold truncate">{agent.name}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{agent.title}</div>
                  </div>
                  <div className={cn("w-2 h-2 rounded-full",
                    agent.status === "idle" ? "bg-green-400" :
                    agent.status === "running" ? "bg-blue-400 animate-pulse" : "bg-muted"
                  )} />
                </button>
              );
            })}
          </div>
        ) : !selectedIssueId ? (
          /* Conversation list */
          <div className="p-3 space-y-2">
            <button
              onClick={() => createConversation.mutate()}
              className="w-full flex items-center justify-center gap-2 p-2.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90"
            >
              <Plus className="h-3.5 w-3.5" />
              New Conversation
            </button>
            {conversations.length === 0 ? (
              <p className="text-[11px] text-muted-foreground text-center py-4">
                No conversations yet
              </p>
            ) : (
              conversations.map((conv: { id: string; identifier: string | null; title: string }) => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedIssueId(conv.id)}
                  className="w-full text-left p-2.5 rounded-lg hover:bg-muted text-xs border border-transparent hover:border-border transition-all"
                >
                  <div className="font-medium truncate">{conv.title}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{conv.identifier ?? conv.id.slice(0, 8)}</div>
                </button>
              ))
            )}
          </div>
        ) : (
          /* Chat messages */
          <div className="p-3 space-y-3">
            {comments.length === 0 && (
              <p className="text-[11px] text-muted-foreground text-center py-8">
                Send a message to start the conversation
              </p>
            )}
            {comments.map((comment: { id: string; body: string; authorAgentId: string | null; authorUserId: string | null }) => {
              const isAgent = !!comment.authorAgentId;
              return (
                <div key={comment.id} className={cn("flex group items-start gap-1", isAgent ? "justify-start" : "justify-end")}>
                  {!isAgent && <CopyButton text={comment.body} />}
                  <div className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed",
                    isAgent
                      ? "bg-muted rounded-bl-md"
                      : "bg-primary text-primary-foreground rounded-br-md"
                  )}>
                    {isAgent ? (
                      <MarkdownBody className="text-[13px] [&_pre]:text-[11px]">{comment.body}</MarkdownBody>
                    ) : (
                      <div className="whitespace-pre-wrap break-words">{comment.body}</div>
                    )}
                  </div>
                  {isAgent && <CopyButton text={comment.body} />}
                </div>
              );
            })}
            {(sendMessage.isPending || isAgentRunning) && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-md px-3.5 py-2">
                  <TypingIndicator />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Quick Suggestions + Input toolbar */}
      {selectedIssueId && (
        <div className="border-t shrink-0">
          <QuickSuggestions
            agentRole={selectedAgent?.role ?? "general"}
            onSelect={(text) => setInputValue(text)}
            visible={comments.length === 0 && !inputValue}
          />

          {/* Attachment chips */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-1 px-3 pb-1">
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
                  className="w-full resize-none rounded-xl border bg-background px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 pr-20 min-h-[40px] max-h-[120px]"
                />
                <div className="absolute right-2 bottom-1.5 flex items-center gap-0.5">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
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
      )}
    </div>
  );
}
