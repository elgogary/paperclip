import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "../../context/CompanyContext";
import { skillsApi, type Skill } from "../../api/skills";
import { queryKeys } from "../../lib/queryKeys";
import { cn } from "../../lib/utils";
import { Search, ChevronDown, ChevronRight } from "lucide-react";

interface SkillListPanelProps {
  selectedId: string | undefined;
  onSelect: (skill: Skill) => void;
}

interface ExampleSkill {
  id: string;
  name: string;
  icon: string;
}

const EXAMPLE_SKILLS: ExampleSkill[] = [
  { id: "ex-skill-creator", name: "skill-creator", icon: "\u{1F4BB}" },
  { id: "ex-brand-guide", name: "brand-guidelines", icon: "\u{1F3A8}" },
  { id: "ex-mcp-builder", name: "mcp-builder", icon: "\u{1F50C}" },
  { id: "ex-web-scraper", name: "web-scraper", icon: "\u{1F310}" },
  { id: "ex-doc-writer", name: "doc-writer", icon: "\u{1F4DD}" },
  { id: "ex-canvas-design", name: "canvas-design", icon: "\u{2728}" },
];

interface CollapsibleSectionProps {
  label: string;
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function CollapsibleSection({ label, count, defaultOpen = true, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 w-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? (
          <ChevronDown className="h-3 w-3 shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0" />
        )}
        <span className="flex-1 text-left">{label}</span>
        <span className="text-[10px] rounded-full bg-muted px-1.5 py-px">{count}</span>
      </button>
      {open && <div className="mt-0.5">{children}</div>}
    </div>
  );
}

export function SkillListPanel({ selectedId, onSelect }: SkillListPanelProps) {
  const { selectedCompanyId } = useCompany();
  const [search, setSearch] = useState("");

  const { data: skillsData } = useQuery({
    queryKey: queryKeys.skills.list(selectedCompanyId!),
    queryFn: () => skillsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const skills: Skill[] = skillsData?.skills ?? [];

  const { mySkills, builtinSkills } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = skills.filter(
      (s) => !q || s.name.toLowerCase().includes(q) || (s.description ?? "").toLowerCase().includes(q),
    );
    return {
      mySkills: filtered.filter((s) => s.source === "user" || s.source === "community"),
      builtinSkills: filtered.filter((s) => s.source === "builtin"),
    };
  }, [skills, search]);

  const filteredExamples = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return EXAMPLE_SKILLS;
    return EXAMPLE_SKILLS.filter((e) => e.name.includes(q));
  }, [search]);

  return (
    <div className="w-[250px] border-r border-border flex flex-col shrink-0 bg-background">
      {/* Search */}
      <div className="px-3 py-2 border-b border-border shrink-0">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search skills..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-7 pr-2 py-1.5 rounded-md border border-border bg-card text-xs text-foreground outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      {/* Skill list */}
      <div className="flex-1 overflow-y-auto py-1">
        <CollapsibleSection label="My Skills" count={mySkills.length}>
          {mySkills.map((skill) => (
            <SkillItem
              key={skill.id}
              name={skill.name}
              active={selectedId === skill.id}
              enabled={skill.enabled}
              dotColor="bg-emerald-500"
              onClick={() => onSelect(skill)}
            />
          ))}
          {mySkills.length === 0 && (
            <p className="px-3 py-2 text-[11px] text-muted-foreground/60 italic">
              No custom skills
            </p>
          )}
        </CollapsibleSection>

        <CollapsibleSection label="Built-in" count={builtinSkills.length}>
          {builtinSkills.map((skill) => (
            <SkillItem
              key={skill.id}
              name={skill.name}
              active={selectedId === skill.id}
              enabled={skill.enabled}
              dotColor="bg-blue-500"
              onClick={() => onSelect(skill)}
            />
          ))}
          {builtinSkills.length === 0 && (
            <p className="px-3 py-2 text-[11px] text-muted-foreground/60 italic">
              No built-in skills
            </p>
          )}
        </CollapsibleSection>

        <CollapsibleSection label="Examples" count={filteredExamples.length} defaultOpen={false}>
          {filteredExamples.map((ex) => (
            <div
              key={ex.id}
              className="flex items-center gap-2.5 px-3 py-1.5 text-xs text-muted-foreground/60 cursor-default"
            >
              <span className="w-4 text-center text-xs opacity-50">{ex.icon}</span>
              <span className="truncate">{ex.name}</span>
            </div>
          ))}
        </CollapsibleSection>
      </div>
    </div>
  );
}

interface SkillItemProps {
  name: string;
  active: boolean;
  enabled: boolean;
  dotColor: string;
  onClick: () => void;
}

function SkillItem({ name, active, enabled, dotColor, onClick }: SkillItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 w-full px-3 py-1.5 text-xs transition-colors",
        active
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
        !enabled && "opacity-50",
      )}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full shrink-0", enabled ? dotColor : "bg-muted-foreground/30")}
      />
      <span className="truncate">{name}</span>
    </button>
  );
}
