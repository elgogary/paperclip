import { cn } from "../../lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AGENT_ICONS, ROLE_COLORS, DEFAULT_ICON } from "./chat-constants";
import {
  MessageSquare,
  Plus,
  ChevronLeft,
} from "lucide-react";

type Agent = {
  id: string;
  name: string;
  title: string | null;
  icon: string | null;
  role: string;
  status: string;
};

type ConversationIssue = {
  id: string;
  identifier: string;
  title: string;
  status: string;
  updatedAt: string;
};

type ChatSidebarProps = {
  agents: Agent[];
  selectedAgentId: string | null;
  onSelectAgent: (agentId: string) => void;
  conversations: ConversationIssue[];
  selectedIssueId: string | null;
  onSelectConversation: (issueId: string) => void;
  onNewConversation: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
};

export function ChatSidebar({
  agents,
  selectedAgentId,
  onSelectAgent,
  conversations,
  selectedIssueId,
  onSelectConversation,
  onNewConversation,
  collapsed,
  onToggleCollapse,
}: ChatSidebarProps) {
  if (collapsed) {
    return (
      <div className="w-10 border-r bg-card flex flex-col items-center py-3 gap-2">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggleCollapse}>
          <MessageSquare className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="w-[260px] min-w-[260px] border-r bg-card flex flex-col">
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between">
        <h3 className="text-sm font-semibold">Chat</h3>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggleCollapse}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {/* Agent cards */}
        {!selectedAgentId ? (
          <div className="p-3 space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
              Select Agent
            </label>
            {agents.map((agent) => {
              const IconComp = AGENT_ICONS[agent.icon ?? ""] ?? DEFAULT_ICON;
              const bgColor = ROLE_COLORS[agent.role] ?? "bg-muted-foreground";
              return (
                <button
                  key={agent.id}
                  onClick={() => onSelectAgent(agent.id)}
                  className="w-full flex items-center gap-2.5 p-2.5 rounded-lg border border-transparent hover:border-primary/20 hover:bg-primary/5 transition-all text-left group"
                >
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0", bgColor)}>
                    <IconComp className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold truncate group-hover:text-primary">
                      {agent.name}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {agent.title ?? agent.role}
                    </div>
                  </div>
                  <div className={cn(
                    "w-2 h-2 rounded-full flex-shrink-0",
                    agent.status === "idle" ? "bg-green-400" :
                    agent.status === "running" ? "bg-blue-400 animate-pulse" :
                    agent.status === "paused" ? "bg-yellow-400" : "bg-muted"
                  )} />
                </button>
              );
            })}
          </div>
        ) : (
          <>
            {/* Selected agent header + back */}
            <div className="p-3 border-b">
              <button
                onClick={() => onSelectAgent("")}
                className="text-[11px] text-muted-foreground hover:text-primary mb-2 flex items-center gap-1"
              >
                <ChevronLeft className="h-3 w-3" />
                All agents
              </button>
              {(() => {
                const agent = agents.find((a) => a.id === selectedAgentId);
                if (!agent) return null;
                const IconComp = AGENT_ICONS[agent.icon ?? ""] ?? DEFAULT_ICON;
                const bgColor = ROLE_COLORS[agent.role] ?? "bg-muted-foreground";
                return (
                  <div className="flex items-center gap-2.5">
                    <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center text-white", bgColor)}>
                      <IconComp className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{agent.name}</div>
                      <div className="text-[11px] text-muted-foreground">{agent.title}</div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* New conversation */}
            <div className="p-3">
              <Button
                className="w-full gap-2 text-xs"
                size="sm"
                onClick={onNewConversation}
              >
                <Plus className="h-3.5 w-3.5" />
                New Conversation
              </Button>
            </div>

            {/* Conversation history */}
            <div className="px-3 mb-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Conversations
              </label>
            </div>
            <div className="px-2 pb-3">
              {conversations.length === 0 ? (
                <p className="text-[11px] text-muted-foreground px-1 py-2">
                  No conversations yet. Click "New Conversation" to start.
                </p>
              ) : (
                conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => onSelectConversation(conv.id)}
                    className={cn(
                      "w-full text-left px-2.5 py-2 rounded-md text-xs mb-0.5 transition-colors",
                      conv.id === selectedIssueId
                        ? "bg-primary/10 text-primary font-medium"
                        : "hover:bg-muted text-foreground",
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <MessageSquare className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{conv.title}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 pl-[18px]">
                      {conv.identifier}
                    </div>
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </ScrollArea>
    </div>
  );
}
