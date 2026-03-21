type ChatToolsDrawerProps = {
  open: boolean;
  agentConfig: Record<string, unknown> | undefined;
  onSelectTool: (key: string) => void;
  onClose: () => void;
};

export function ChatToolsDrawer({
  open,
  agentConfig,
  onSelectTool,
  onClose,
}: ChatToolsDrawerProps) {
  if (!open) return null;

  const entries = agentConfig
    ? Object.entries(agentConfig).filter(
        ([key]) =>
          key.toLowerCase().includes("skill") ||
          key.toLowerCase().includes("tool") ||
          key.toLowerCase().includes("adapter"),
      )
    : [];

  return (
    <div className="absolute inset-0 bg-card z-10 overflow-y-auto p-3 animate-in slide-in-from-right-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
        Agent Tools & Skills
      </p>
      {agentConfig ? (
        <div className="space-y-1">
          {entries.map(([key, value]) => (
            <button
              key={key}
              onClick={() => { onSelectTool(key); onClose(); }}
              className="w-full text-left p-2 rounded-lg hover:bg-muted text-xs border border-transparent hover:border-border"
            >
              <div className="font-medium">{key}</div>
              <div className="text-[10px] text-muted-foreground truncate">
                {typeof value === "string" ? value : JSON.stringify(value).slice(0, 60)}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Loading agent configuration...</p>
      )}
    </div>
  );
}
