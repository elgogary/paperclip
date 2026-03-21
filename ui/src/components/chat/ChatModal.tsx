/**
 * ChatModal — Floating chat button with 3 modes:
 *   FAB → Popup (small, bottom-right) → Full Panel (sidebar)
 *
 * Inspired by Sanad AI's 3-mode chat widget pattern.
 */
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import * as ThreadPrimitive from "@assistant-ui/react";
import * as ComposerPrimitive from "@assistant-ui/react";
import { useCompany } from "../../context/CompanyContext";
import { agentsApi } from "../../api/agents";
import { issuesApi } from "../../api/issues";
import { queryKeys } from "../../lib/queryKeys";
import { usePaperclipChat } from "./paperclip-runtime";
import { cn } from "../../lib/utils";
import { MarkdownBody } from "../MarkdownBody";
import {
  MessageSquare,
  X,
  Maximize2,
  Minimize2,
  Send,
  Loader2,
  Mic,
  Paperclip as PaperclipIcon,
  History,
  Wrench,
  ChevronLeft,
  Plus,
  Crown,
  Brain,
  Rocket,
  Bug,
  Server,
  Briefcase,
  Phone,
  BarChart3,
  Palette,
  Zap,
  Trash2,
  Download,
} from "lucide-react";

type ChatMode = "closed" | "popup" | "panel";

const AGENT_ICONS: Record<string, typeof Crown> = {
  crown: Crown, brain: Brain, rocket: Rocket, bug: Bug,
  server: Server, briefcase: Briefcase, phone: Phone,
  "chart-bar": BarChart3, palette: Palette, zap: Zap,
};

const ROLE_COLORS: Record<string, string> = {
  ceo: "bg-amber-500", cto: "bg-purple-500", engineer: "bg-blue-500",
  pm: "bg-teal-500", qa: "bg-orange-500", devops: "bg-slate-500",
  general: "bg-indigo-500", researcher: "bg-emerald-500",
};

export function ChatModal() {
  const { selectedCompanyId: companyId } = useCompany();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<ChatMode>("closed");
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: agents = [] } = useQuery({
    queryKey: queryKeys.agents.list(companyId!),
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
    queryKey: ["chat-comments", selectedIssueId],
    queryFn: () => issuesApi.listComments(selectedIssueId!),
    enabled: !!selectedIssueId,
    refetchInterval: 3000,
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
      queryClient.invalidateQueries({ queryKey: ["chat-comments", selectedIssueId] });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);

  const handleSend = () => {
    if (!inputValue.trim()) return;
    sendMessage.mutate(inputValue.trim());
    setInputValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
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
  const AgentIcon = AGENT_ICONS[selectedAgent?.icon ?? ""] ?? Zap;

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
                onClick={() => { setSelectedAgentId(null); setSelectedIssueId(null); }}
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
              <button className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground" title="History">
                <History className="h-3.5 w-3.5" />
              </button>
              <button className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground" title="Tools">
                <Wrench className="h-3.5 w-3.5" />
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
      <div className="flex-1 overflow-y-auto">
        {!selectedAgentId ? (
          /* Agent selection */
          <div className="p-3 space-y-1">
            <p className="text-[11px] text-muted-foreground px-1 mb-2">Select an agent to chat with:</p>
            {agents.map((agent: { id: string; name: string; title: string | null; icon: string | null; role: string; status: string }) => {
              const Icon = AGENT_ICONS[agent.icon ?? ""] ?? Zap;
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
                <div key={comment.id} className={cn("flex", isAgent ? "justify-start" : "justify-end")}>
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
                </div>
              );
            })}
            {sendMessage.isPending && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-md px-3.5 py-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Agent is thinking...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input toolbar */}
      {selectedIssueId && (
        <div className="border-t p-3 shrink-0">
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                rows={1}
                className="w-full resize-none rounded-xl border bg-background px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 pr-20 min-h-[40px] max-h-[120px]"
              />
              <div className="absolute right-2 bottom-1.5 flex items-center gap-0.5">
                <button className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground" title="Attach file">
                  <PaperclipIcon className="h-3.5 w-3.5" />
                </button>
                <button className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground" title="Voice input">
                  <Mic className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || sendMessage.isPending}
              className="h-10 w-10 rounded-xl bg-primary text-white flex items-center justify-center hover:bg-primary/90 disabled:opacity-50 shrink-0"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
