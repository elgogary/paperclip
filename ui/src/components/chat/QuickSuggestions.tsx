const ROLE_SUGGESTIONS: Record<string, string[]> = {
  ceo: ["Weekly report", "Budget review", "Team status", "Strategic priorities"],
  cto: ["Code review", "Architecture decision", "Tech debt audit", "Security review"],
  engineer: ["Implementation plan", "Bug investigation", "Test coverage", "Code walkthrough"],
  pm: ["Roadmap update", "Feature prioritization", "Sprint review", "User feedback"],
  qa: ["Test results", "Bug report", "Regression check", "Release checklist"],
  devops: ["Deploy status", "Server health", "Backup check", "Infrastructure audit"],
  general: ["What's your status?", "Help me with...", "Run your heartbeat", "What can you do?"],
};

type QuickSuggestionsProps = {
  agentRole: string;
  onSelect: (text: string) => void;
  visible: boolean;
};

export function QuickSuggestions({ agentRole, onSelect, visible }: QuickSuggestionsProps) {
  if (!visible) return null;

  const suggestions = ROLE_SUGGESTIONS[agentRole] ?? ROLE_SUGGESTIONS.general!;

  return (
    <div className="flex flex-wrap gap-1.5 px-3 py-2">
      {suggestions.map((text) => (
        <button
          key={text}
          onClick={() => onSelect(text)}
          className="text-[11px] px-2.5 py-1 rounded-full border border-border bg-background hover:bg-primary/5 hover:border-primary/30 text-muted-foreground hover:text-foreground transition-colors"
        >
          {text}
        </button>
      ))}
    </div>
  );
}
