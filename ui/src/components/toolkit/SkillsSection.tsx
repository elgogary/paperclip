import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../../context/CompanyContext";
import { skillsApi, type Skill, type CreateSkillInput } from "../../api/skills";
import { agentsApi } from "../../api/agents";
import { queryKeys } from "../../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SkillDetailDrawer } from "./SkillDetailDrawer";
import { SkillLibraryModal } from "./SkillLibraryModal";
import { cn } from "../../lib/utils";
import {
  Plus, BookOpen, Search, LayoutGrid, List,
  FileText, Code2,
} from "lucide-react";

import { SKILL_CATEGORY_BADGE, AGENT_COLORS, getInitials } from "./toolkit-constants";

type ViewMode = "cards" | "list";
type Filter = "all" | "custom" | "builtin";

const SKILL_ICONS: Record<string, string> = {
  "add-api-method": "\u{1F4E6}",
  til: "\u{1F9EA}",
  "debug-agent": "\u{1F41B}",
  "code-review": "\u{1F4DD}",
  research: "\u{1F50D}",
  "data-analysis": "\u{1F4CA}",
};

export function SkillsSection() {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);

  // Create form state
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCategory, setNewCategory] = useState("Custom");
  const [newInvokedBy, setNewInvokedBy] = useState("user_or_agent");
  const [newTrigger, setNewTrigger] = useState("");
  const [newInstructions, setNewInstructions] = useState("");

  const { data: skillsData, isLoading, isError } = useQuery({
    queryKey: queryKeys.skills.list(selectedCompanyId!),
    queryFn: () => skillsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: agents = [] } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const skills: Skill[] = skillsData?.skills ?? [];

  const toggleSkill = useMutation({
    mutationFn: (skill: Skill) =>
      skillsApi.update(selectedCompanyId!, skill.id, { enabled: !skill.enabled }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.skills.list(selectedCompanyId!) }),
  });

  const createSkill = useMutation({
    mutationFn: (data: CreateSkillInput) => skillsApi.create(selectedCompanyId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.skills.list(selectedCompanyId!) });
      setCreateOpen(false);
      resetCreateForm();
    },
  });

  function resetCreateForm() {
    setNewName(""); setNewDesc(""); setNewCategory("Custom");
    setNewInvokedBy("user_or_agent"); setNewTrigger(""); setNewInstructions("");
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return skills.filter((s) => {
      if (q && !s.name.toLowerCase().includes(q) && !(s.description ?? "").toLowerCase().includes(q)) return false;
      if (filter === "custom" && s.source !== "user") return false;
      if (filter === "builtin" && s.source !== "builtin") return false;
      return true;
    });
  }, [skills, search, filter]);

  const customCount = skills.filter((s) => s.source === "user").length;
  const builtinCount = skills.filter((s) => s.source === "builtin").length;
  const agentsUsingCount = agents.length; // TODO: fetch actual per-skill access data for accurate count

  function openDetail(skill: Skill) {
    setSelectedSkill(skill);
    setDetailOpen(true);
  }

  function handleCreate() {
    createSkill.mutate({
      name: newName,
      description: newDesc || null,
      category: newCategory || null,
      invokedBy: newInvokedBy as "user_or_agent" | "agent_only" | "user_only",
      triggerHint: newTrigger || null,
      instructions: newInstructions || "",
    });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between px-5 py-3.5 border-b border-border shrink-0">
        <div>
          <h2 className="text-xl font-bold">Skills</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Give your agents role-level expertise with reusable instruction templates
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setLibraryOpen(true)}>
            <BookOpen className="h-3.5 w-3.5 mr-1.5" />
            Browse Library
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New Skill
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="rounded-lg border border-border bg-card p-3.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xl font-bold">{customCount}</p>
                <p className="text-[11px] text-muted-foreground">Custom Skills</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
                <FileText className="h-4 w-4" />
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-3.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xl font-bold">{builtinCount}</p>
                <p className="text-[11px] text-muted-foreground">Built-in</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400">
                <BookOpen className="h-4 w-4" />
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-3.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xl font-bold">{agentsUsingCount}</p>
                <p className="text-[11px] text-muted-foreground">Total Agents</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                <Code2 className="h-4 w-4" />
              </div>
            </div>
          </div>
        </div>

        {/* Search + Filters */}
        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search skills..."
              aria-label="Search skills"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-md border border-border bg-card text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
            />
          </div>
          {(["all", "custom", "builtin"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors capitalize",
                filter === f
                  ? "bg-accent text-foreground border-foreground/20"
                  : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {f === "builtin" ? "Built-in" : f === "all" ? "All" : "Custom"}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-0.5 rounded-md border border-border p-0.5">
            <button
              onClick={() => setViewMode("cards")}
              aria-label="Card view"
              className={cn(
                "rounded p-1 transition-colors",
                viewMode === "cards" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              aria-label="List view"
              className={cn(
                "rounded p-1 transition-colors",
                viewMode === "list" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Loading / Error */}
        {isLoading && (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <div className="animate-spin h-5 w-5 border-2 border-foreground/20 border-t-foreground rounded-full mr-3" />
            Loading skills...
          </div>
        )}
        {isError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Failed to load skills. Check your connection and try again.
          </div>
        )}

        {/* Card View */}
        {!isLoading && !isError && viewMode === "cards" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map((skill) => (
              <div
                key={skill.id}
                onClick={() => openDetail(skill)}
                className={cn(
                  "rounded-lg border border-border bg-card p-4 cursor-pointer transition-colors hover:border-foreground/20",
                  skill.source === "builtin" && "opacity-70",
                )}
              >
                <div className="flex items-center gap-2.5 mb-1.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-sm shrink-0">
                    {SKILL_ICONS[skill.slug] ?? skill.icon ?? "\u{1F4DC}"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{skill.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {skill.source === "builtin" ? "Built-in" : "Custom"} · {skill.source === "user" ? "User" : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleSkill.mutate(skill); }}
                    aria-label={`${skill.enabled ? "Disable" : "Enable"} ${skill.name}`}
                    className={cn(
                      "relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0",
                      skill.enabled ? "bg-emerald-500" : "bg-muted",
                    )}
                  >
                    <span className={cn(
                      "inline-block h-4 w-4 rounded-full bg-white transition-transform",
                      skill.enabled ? "translate-x-4" : "translate-x-0.5",
                    )} />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-2.5">
                  {skill.description}
                </p>
                <div className="flex items-center justify-between">
                  <span className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                    SKILL_CATEGORY_BADGE[skill.category ?? "Custom"] ?? "bg-muted text-muted-foreground",
                  )}>
                    {skill.category ?? "Custom"}
                  </span>
                  <div className="flex -space-x-1">
                    {agents.slice(0, 3).map((agent, i) => {
                      const c = AGENT_COLORS[i % AGENT_COLORS.length]!;
                      return (
                        <span
                          key={agent.id}
                          className="flex h-5 w-5 items-center justify-center rounded text-[8px] font-semibold border-2 border-card"
                          style={{ background: c.bg, color: c.fg }}
                        >
                          {getInitials(agent.name)}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* List View */
          <div className="min-w-full">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-10 bg-background">
                <tr className="border-b border-border">
                  <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-3 py-2">Skill</th>
                  <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-3 py-2 w-28">Category</th>
                  <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-3 py-2 w-24">Source</th>
                  <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-3 py-2 w-20">Agents</th>
                  <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-3 py-2 w-20">Enabled</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((skill) => (
                  <tr
                    key={skill.id}
                    onClick={() => openDetail(skill)}
                    className={cn(
                      "border-b border-border hover:bg-accent/50 transition-colors cursor-pointer",
                      skill.source === "builtin" && "opacity-70",
                    )}
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-xs shrink-0">
                          {SKILL_ICONS[skill.slug] ?? skill.icon ?? "\u{1F4DC}"}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{skill.name}</p>
                          <p className="text-[11px] text-muted-foreground truncate max-w-[200px]">{skill.description}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                        SKILL_CATEGORY_BADGE[skill.category ?? "Custom"] ?? "bg-muted text-muted-foreground",
                      )}>
                        {skill.category ?? "Custom"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {skill.source === "builtin" ? "Built-in" : "Custom"}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {Math.min(agents.length, 3)}
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); toggleSkill.mutate(skill); }}
                        aria-label={`${skill.enabled ? "Disable" : "Enable"} ${skill.name}`}
                        className={cn(
                          "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                          skill.enabled ? "bg-emerald-500" : "bg-muted",
                        )}
                      >
                        <span className={cn(
                          "inline-block h-4 w-4 rounded-full bg-white transition-transform",
                          skill.enabled ? "translate-x-4" : "translate-x-0.5",
                        )} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && !isError && skills.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-12">No skills yet. Create one or browse the library.</p>
        )}
        {!isLoading && !isError && skills.length > 0 && filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-12">No skills match the current filter.</p>
        )}
      </div>

      {/* Detail Drawer */}
      <SkillDetailDrawer
        open={detailOpen}
        onClose={() => { setDetailOpen(false); setSelectedSkill(null); }}
        skill={selectedSkill}
      />

      {/* Create Drawer */}
      <Sheet open={createOpen} onOpenChange={(o) => { if (!o) { setCreateOpen(false); resetCreateForm(); } }}>
        <SheetContent side="right" className="sm:max-w-[500px] flex flex-col p-0">
          <SheetHeader className="px-5 py-4 border-b border-border shrink-0">
            <SheetTitle className="text-[15px]">New Skill</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Skill Name</label>
              <Input placeholder="my-custom-skill" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <p className="text-[11px] text-muted-foreground">lowercase, hyphens only</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Description</label>
              <Input placeholder="What does this skill do?" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none"
                >
                  <option>Coding</option>
                  <option>Research</option>
                  <option>Communication</option>
                  <option>Data</option>
                  <option>Custom</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Invoked by</label>
                <select
                  value={newInvokedBy}
                  onChange={(e) => setNewInvokedBy(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none"
                >
                  <option value="user_or_agent">User or Agent</option>
                  <option value="user_only">User only</option>
                  <option value="agent_only">Agent only</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Trigger</label>
              <Input placeholder="Use when..." value={newTrigger} onChange={(e) => setNewTrigger(e.target.value)} />
              <p className="text-[11px] text-muted-foreground">When should agents auto-invoke this skill?</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Instructions</label>
              <Textarea
                placeholder="Write your skill instructions in markdown..."
                value={newInstructions}
                onChange={(e) => setNewInstructions(e.target.value)}
                className="min-h-[160px] font-mono text-xs"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end px-5 py-3 border-t border-border shrink-0">
            <Button variant="outline" size="sm" onClick={() => { setCreateOpen(false); resetCreateForm(); }}>Cancel</Button>
            <Button size="sm" onClick={handleCreate} disabled={!newName.trim() || createSkill.isPending}>
              {createSkill.isPending ? "Creating..." : "Create Skill"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Library Modal */}
      <SkillLibraryModal
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onAdd={(tpl) => {
          setLibraryOpen(false);
          createSkill.mutate({
            name: tpl.name,
            description: tpl.description,
            category: tpl.category,
            instructions: "",
          });
        }}
      />
    </div>
  );
}
