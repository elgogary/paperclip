import { Command } from "cmdk";
import {
  HelpCircle,
  Trash2,
  Activity,
  RotateCcw,
} from "lucide-react";

type SlashCommand = {
  name: string;
  description: string;
  icon: typeof HelpCircle;
  action: "insert" | "execute";
};

const COMMANDS: SlashCommand[] = [
  { name: "help", description: "Show available commands", icon: HelpCircle, action: "execute" },
  { name: "clear", description: "Clear conversation display", icon: Trash2, action: "execute" },
  { name: "status", description: "Ask agent for status update", icon: Activity, action: "insert" },
  { name: "retry", description: "Re-run the agent's heartbeat", icon: RotateCcw, action: "execute" },
];

type SlashCommandMenuProps = {
  open: boolean;
  search: string;
  onSelect: (command: SlashCommand) => void;
  onClose: () => void;
};

export type { SlashCommand };

export function SlashCommandMenu({
  open,
  search,
  onSelect,
  onClose,
}: SlashCommandMenuProps) {
  if (!open) return null;

  const filtered = COMMANDS.filter((cmd) =>
    cmd.name.includes(search.toLowerCase().replace("/", "")),
  );

  return (
    <div className="absolute bottom-full left-0 z-50 w-64 rounded-lg border bg-popover shadow-lg overflow-hidden mb-1">
      <Command className="bg-transparent" shouldFilter={false}>
        <Command.List className="max-h-48 overflow-y-auto p-1">
          {filtered.map((cmd) => {
            const Icon = cmd.icon;
            return (
              <Command.Item
                key={cmd.name}
                value={cmd.name}
                onSelect={() => { onSelect(cmd); onClose(); }}
                className="flex items-center gap-2 px-2 py-1.5 text-xs rounded cursor-pointer data-[selected]:bg-primary/10"
              >
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                <div>
                  <span className="font-medium">/{cmd.name}</span>
                  <span className="text-muted-foreground ml-1.5">{cmd.description}</span>
                </div>
              </Command.Item>
            );
          })}
          {filtered.length === 0 && (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              No commands found
            </div>
          )}
        </Command.List>
      </Command>
    </div>
  );
}
