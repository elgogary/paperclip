import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../../context/CompanyContext";
import { skillsApi, type GeneratedSkill } from "../../api/skills";
import { queryKeys } from "../../lib/queryKeys";
import { useToast } from "../../context/ToastContext";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SkillMarkdownPreview } from "./SkillMarkdownPreview";
import { Sparkles, Loader2, RefreshCw, X } from "lucide-react";

interface SkillAICreateDialogProps {
  open: boolean;
  onClose: () => void;
}

const CATEGORIES = ["Coding", "Research", "Communication", "Data", "Custom"];

export function SkillAICreateDialog({ open, onClose }: SkillAICreateDialogProps) {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [generated, setGenerated] = useState<GeneratedSkill | null>(null);

  const generate = useMutation({
    mutationFn: () =>
      skillsApi.generate(selectedCompanyId!, description, category || undefined),
    onSuccess: (data) => setGenerated(data),
  });

  const createSkill = useMutation({
    mutationFn: () => {
      if (!generated) throw new Error("No generated skill");
      return skillsApi.create(selectedCompanyId!, {
        name: generated.name,
        description: generated.description,
        category: generated.category,
        instructions: generated.instructions,
        triggerHint: generated.triggerHint,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.skills.list(selectedCompanyId!) });
      pushToast({ title: "Skill created", body: generated?.name, tone: "success" });
      handleClose();
    },
  });

  function handleClose() {
    setDescription("");
    setCategory("");
    setGenerated(null);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent showCloseButton={false} className="sm:max-w-[640px] p-0 gap-0 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-400" />
            <h3 className="text-base font-bold">AI Skill Creator</h3>
          </div>
          <button onClick={handleClose} aria-label="Close" className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Input section */}
          {!generated && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Describe your skill</label>
                <textarea
                  className="w-full min-h-[100px] p-3 rounded-md border border-border bg-card
                             text-sm text-foreground outline-none resize-y
                             placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
                  placeholder="e.g., A skill that helps agents write API documentation from code, including request/response examples and error codes..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Category (optional)</label>
                <select
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="">Auto-detect</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Generated preview */}
          {generated && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-bold">{generated.name}</h4>
                  <span className="text-[10px] rounded-full bg-purple-500/15 text-purple-400 px-2 py-0.5 font-medium">
                    {generated.category}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-1">{generated.description}</p>
                <p className="text-[11px] text-muted-foreground/70">
                  Trigger: {generated.triggerHint}
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Generated Instructions</label>
                <div className="rounded-md border border-border bg-card p-4 max-h-[300px] overflow-y-auto">
                  <SkillMarkdownPreview content={generated.instructions} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border shrink-0">
          <Button variant="outline" size="sm" onClick={handleClose}>
            Cancel
          </Button>
          <div className="flex gap-2">
            {generated ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => generate.mutate()}
                  disabled={generate.isPending}
                >
                  <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${generate.isPending ? "animate-spin" : ""}`} />
                  Regenerate
                </Button>
                <Button
                  size="sm"
                  onClick={() => createSkill.mutate()}
                  disabled={createSkill.isPending}
                >
                  {createSkill.isPending ? "Creating..." : "Create Skill"}
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                onClick={() => generate.mutate()}
                disabled={!description.trim() || generate.isPending}
              >
                {generate.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                    Generate
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
