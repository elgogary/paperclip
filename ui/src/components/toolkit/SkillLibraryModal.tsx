import { useState, useMemo } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "../../lib/utils";
import { SKILL_CATEGORY_BADGE } from "./toolkit-constants";
import { X } from "lucide-react";

interface SkillLibraryModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (template: SkillTemplate) => void;
}

export interface SkillTemplate {
  name: string;
  icon: string;
  description: string;
  category: string;
}

const TEMPLATES: SkillTemplate[] = [
  { name: "skill-creator", icon: "\u{1F4BB}", description: "Create new skills with proper structure and metadata.", category: "Coding" },
  { name: "brand-guidelines", icon: "\u{1F3A8}", description: "Apply brand voice, typography, and visual guidelines.", category: "Custom" },
  { name: "mcp-builder", icon: "\u{1F50C}", description: "Build MCP servers with tool definitions and transport.", category: "Coding" },
  { name: "internal-comms", icon: "\u{1F4E8}", description: "Draft internal communications with proper tone.", category: "Communication" },
  { name: "data-pipeline", icon: "\u{1F4CA}", description: "Design and implement data transformation pipelines.", category: "Data" },
  { name: "web-scraper", icon: "\u{1F310}", description: "Extract structured data from websites reliably.", category: "Research" },
  { name: "doc-writer", icon: "\u{1F4DD}", description: "Generate technical documentation from code.", category: "Coding" },
  { name: "canvas-design", icon: "\u{2728}", description: "Create visual designs and layouts.", category: "Custom" },
];

const CATEGORIES = ["All", "Coding", "Research", "Communication", "Data", "Custom"];

export function SkillLibraryModal({ open, onClose, onAdd }: SkillLibraryModalProps) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return TEMPLATES.filter((t) => {
      if (q && !t.name.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q)) return false;
      if (activeCategory !== "All" && t.category !== activeCategory) return false;
      return true;
    });
  }, [search, activeCategory]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent showCloseButton={false} className="sm:max-w-[680px] p-0 gap-0">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <h3 className="text-base font-bold">Skill Library</h3>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  activeCategory === cat
                    ? "bg-accent text-foreground border-foreground/20"
                    : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {filtered.map((tpl) => (
              <div
                key={tpl.name}
                className="rounded-md border border-border bg-background p-3 cursor-pointer hover:border-foreground/20 transition-colors"
              >
                <div className="font-semibold text-sm flex items-center gap-1.5">
                  {tpl.icon} {tpl.name}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{tpl.description}</p>
                <div className="flex items-center justify-between mt-2.5">
                  <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium", SKILL_CATEGORY_BADGE[tpl.category] ?? "bg-muted text-muted-foreground")}>
                    {tpl.category}
                  </span>
                  <Button size="sm" variant="default" className="h-6 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white" onClick={() => onAdd(tpl)}>
                    Add
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No skills match your search.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
