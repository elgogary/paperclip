import { cn } from "../../lib/utils";

type Conversation = {
  id: string;
  identifier: string | null;
  title: string;
};

type ChatHistoryDrawerProps = {
  open: boolean;
  conversations: Conversation[];
  selectedIssueId: string | null;
  onSelectConversation: (id: string) => void;
  onClose: () => void;
};

export function ChatHistoryDrawer({
  open,
  conversations,
  selectedIssueId,
  onSelectConversation,
  onClose,
}: ChatHistoryDrawerProps) {
  if (!open) return null;

  return (
    <div className="absolute inset-0 bg-card z-10 overflow-y-auto p-3 space-y-1 animate-in slide-in-from-left-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
        Conversation History
      </p>
      {conversations.map((conv) => (
        <button
          key={conv.id}
          onClick={() => { onSelectConversation(conv.id); onClose(); }}
          className={cn(
            "w-full text-left p-2.5 rounded-lg text-xs border transition-all",
            conv.id === selectedIssueId
              ? "border-primary/30 bg-primary/5"
              : "border-transparent hover:bg-muted",
          )}
        >
          <div className="font-medium truncate">{conv.title}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {conv.identifier ?? conv.id.slice(0, 8)}
          </div>
        </button>
      ))}
    </div>
  );
}
