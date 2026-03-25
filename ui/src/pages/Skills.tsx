import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { skillsApi, type Skill, type CreateSkillInput } from "../api/skills";
import { queryKeys } from "../lib/queryKeys";
import { SkillListPanel } from "../components/skills/SkillListPanel";
import { SkillDetailPanel } from "../components/skills/SkillDetailPanel";
import { SkillAICreateDialog } from "../components/skills/SkillAICreateDialog";
import { PageSkeleton } from "../components/PageSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EvolutionTimeline } from "../components/skills/EvolutionTimeline";
import { EvolutionPendingReviews } from "../components/skills/EvolutionPendingReviews";
import { Plus, Sparkles, BookOpenCheck, Dna } from "lucide-react";

export function Skills() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();

  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [aiCreateOpen, setAiCreateOpen] = useState(false);
  const [evoOpen, setEvoOpen] = useState(false);

  // Create form state
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCategory, setNewCategory] = useState("Custom");
  const [newInvokedBy, setNewInvokedBy] = useState("user_or_agent");
  const [newTrigger, setNewTrigger] = useState("");
  const [newInstructions, setNewInstructions] = useState("");

  useEffect(() => {
    setBreadcrumbs([{ label: "Skills" }]);
  }, [setBreadcrumbs]);

  const { data: skillsData, isLoading } = useQuery({
    queryKey: queryKeys.skills.list(selectedCompanyId!),
    queryFn: () => skillsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  // Keep selected skill in sync with latest data
  useEffect(() => {
    if (!skillsData?.skills) return;
    setSelectedSkill((prev) => {
      if (!prev) return null;
      const fresh = skillsData.skills.find((s) => s.id === prev.id);
      return fresh ?? null;
    });
  }, [skillsData]);

  const createSkill = useMutation({
    mutationFn: (data: CreateSkillInput) => skillsApi.create(selectedCompanyId!, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.skills.list(selectedCompanyId!) });
      setCreateOpen(false);
      resetCreateForm();
      if (data?.skill) setSelectedSkill(data.skill);
    },
  });

  function resetCreateForm() {
    setNewName("");
    setNewDesc("");
    setNewCategory("Custom");
    setNewInvokedBy("user_or_agent");
    setNewTrigger("");
    setNewInstructions("");
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

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div>
          <h1 className="text-xl font-bold">Skills</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Reusable instruction templates that give agents expertise.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={evoOpen ? "secondary" : "outline"}
            size="sm"
            onClick={() => setEvoOpen(!evoOpen)}
          >
            <Dna className="h-3.5 w-3.5 mr-1.5" />
            Evolution
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAiCreateOpen(true)}>
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            AI Create
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New
          </Button>
        </div>
      </div>

      {/* Split view */}
      <div className="flex flex-1 overflow-hidden">
        <SkillListPanel
          selectedId={selectedSkill?.id}
          onSelect={setSelectedSkill}
        />

        {selectedSkill ? (
          <SkillDetailPanel skill={selectedSkill} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
            <BookOpenCheck className="h-12 w-12 text-muted-foreground/20 mb-4" />
            <p className="text-sm font-medium text-muted-foreground">
              Select a skill to view details
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Or create a new one with the button above.
            </p>
          </div>
        )}

        {/* Evolution side panel */}
        {evoOpen && (
          <div className="w-[320px] border-l border-border shrink-0 flex flex-col bg-background overflow-hidden">
            <div className="px-4 py-3 border-b border-border shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Dna className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Evolution</h3>
              </div>
              <button
                type="button"
                onClick={() => setEvoOpen(false)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-5">
              <EvolutionPendingReviews />
              <div className="border-t border-border pt-4">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Recent Activity
                </p>
                <EvolutionTimeline />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Skill Sheet */}
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
            <Button variant="outline" size="sm" onClick={() => { setCreateOpen(false); resetCreateForm(); }}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreate} disabled={!newName.trim() || createSkill.isPending}>
              {createSkill.isPending ? "Creating..." : "Create Skill"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* AI Create Dialog */}
      <SkillAICreateDialog
        open={aiCreateOpen}
        onClose={() => setAiCreateOpen(false)}
      />
    </div>
  );
}
