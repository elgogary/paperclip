import { useState } from "react";
import { cn } from "../../lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MessageSquare,
  Plus,
  ChevronLeft,
  Crown,
  Brain,
  Rocket,
  Bug,
  Server,
  Briefcase,
  Phone,
  BarChart3,
  Palette,
} from "lucide-react";

const AGENT_ICONS: Record<string, typeof Crown> = {
  crown: Crown,
  brain: Brain,
  rocket: Rocket,
  bug: Bug,
  server: Server,
  briefcase: Briefcase,
  phone: Phone,
  "chart-bar": BarChart3,
  palette: Palette,
};

type Agent = {
  id: string;
  name: string;
  title: string | null;
  icon: string | null;
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
  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

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

      {/* New conversation button */}
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

      {/* Agent picker */}
      <div className="px-3 pb-3">
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
          Agent
        </label>
        <select
          className="w-full px-2.5 py-1.5 text-xs border rounded-md bg-card"
          value={selectedAgentId ?? ""}
          onChange={(e) => onSelectAgent(e.target.value)}
        >
          <option value="">Select agent...</option>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name} — {agent.title ?? agent.status}
            </option>
          ))}
        </select>
      </div>

      {/* Selected agent card */}
      {selectedAgent && (
        <div className="mx-3 mb-3 p-2.5 bg-primary/5 border border-primary/20 rounded-md">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center text-white">
              {(() => {
                const IconComp = AGENT_ICONS[selectedAgent.icon ?? ""] ?? Brain;
                return <IconComp className="h-3.5 w-3.5" />;
              })()}
            </div>
            <div>
              <div className="text-xs font-semibold">{selectedAgent.name}</div>
              <div className="text-[10px] text-muted-foreground">{selectedAgent.title}</div>
            </div>
          </div>
        </div>
      )}

      {/* Conversation history */}
      <div className="px-3 mb-1.5">
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          History
        </label>
      </div>
      <ScrollArea className="flex-1">
        <div className="px-2 pb-3">
          {conversations.length === 0 ? (
            <p className="text-[11px] text-muted-foreground px-1 py-2">
              No conversations yet
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
      </ScrollArea>
    </div>
  );
}
