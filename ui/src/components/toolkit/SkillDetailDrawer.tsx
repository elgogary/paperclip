import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useCompany } from "../../context/CompanyContext";
import { skillsApi, type Skill } from "../../api/skills";
import { queryKeys } from "../../lib/queryKeys";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AgentAccessChips } from "./AgentAccessChips";
import { Trash2 } from "lucide-react";
import { cn } from "../../lib/utils";

interface SkillDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  skill: Skill | null;
}

export function SkillDetailDrawer({ open, onClose, skill }: SkillDetailDrawerProps) {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();

  const [description, setDescription] = useState("");
  const [triggerHint, setTriggerHint] = useState("");
  const [instructions, setInstructions] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [grants, setGrants] = useState<{ agentId: string; granted: boolean }[]>([]);

  const { data: accessData } = useQuery({
    queryKey: queryKeys.skills.access(selectedCompanyId!, skill?.id ?? ""),
    queryFn: () => skillsApi.getAccess(selectedCompanyId!, skill!.id),
    enabled: !!selectedCompanyId && !!skill,
  });

  useEffect(() => {
    if (skill) {
      setDescription(skill.description ?? "");
      setTriggerHint(skill.triggerHint ?? "");
      setInstructions(skill.instructions ?? "");
      setEnabled(skill.enabled);
    }
  }, [skill]);

  useEffect(() => {
    if (accessData?.access) {
      setGrants(accessData.access.map((a) => ({ agentId: a.agentId, granted: a.granted })));
    }
  }, [accessData]);

  const updateSkill = useMutation({
    mutationFn: () =>
      skillsApi.update(selectedCompanyId!, skill!.id, {
        description: description || null,
        triggerHint: triggerHint || null,
        instructions,
        enabled,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.skills.list(selectedCompanyId!) });
      onClose();
    },
  });

  const updateAccess = useMutation({
    mutationFn: (newGrants: { agentId: string; granted: boolean }[]) =>
      skillsApi.updateAccess(selectedCompanyId!, skill!.id, newGrants),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.skills.access(selectedCompanyId!, skill!.id) });
    },
  });

  const deleteSkill = useMutation({
    mutationFn: () => skillsApi.remove(selectedCompanyId!, skill!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.skills.list(selectedCompanyId!) });
      onClose();
    },
  });

  function handleSave() {
    updateSkill.mutate();
    updateAccess.mutate(grants);
  }

  if (!skill) return null;

  const sourceLabel = skill.source === "builtin" ? "Built-in" : "Custom";
  const updatedDate = new Date(skill.updatedAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="sm:max-w-[500px] flex flex-col p-0">
        <SheetHeader className="px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-[15px]">
              {skill.icon ?? ""} {skill.name}
            </SheetTitle>
            <button
              type="button"
              onClick={() => setEnabled(!enabled)}
              className={cn(
                "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                enabled ? "bg-emerald-500" : "bg-muted",
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 rounded-full bg-white transition-transform",
                  enabled ? "translate-x-4" : "translate-x-0.5",
                )}
              />
            </button>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <div className="text-[11px] text-muted-foreground">
            {sourceLabel} · Updated {updatedDate} · Invoked by {skill.invokedBy?.replace(/_/g, " ") ?? "user or agent"}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold">Description</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold">Trigger</label>
            <Input value={triggerHint} onChange={(e) => setTriggerHint(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold">Agent Access</label>
            <AgentAccessChips
              grants={grants}
              onUpdate={(g) => setGrants(g)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold">Instructions</label>
            <Textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="min-h-[200px] font-mono text-xs bg-background"
              style={{ tabSize: 2, whiteSpace: "pre-wrap" }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-border shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => deleteSkill.mutate()}
            disabled={deleteSkill.isPending}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Delete
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Discard</Button>
            <Button size="sm" onClick={handleSave} disabled={updateSkill.isPending}>
              {updateSkill.isPending ? "Saving..." : "Save Skill"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
