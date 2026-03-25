import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useCompany } from "../../context/CompanyContext";
import { skillsApi, type Skill } from "../../api/skills";
import { queryKeys } from "../../lib/queryKeys";
import { useToast } from "../../context/ToastContext";
import { cn } from "../../lib/utils";
import { Button } from "@/components/ui/button";
import { SkillMarkdownPreview } from "./SkillMarkdownPreview";
import { SkillCodeEditor } from "./SkillCodeEditor";
import { SkillVersionHistory } from "./SkillVersionHistory";
import { SkillAuditCard } from "./SkillAuditCard";
import { AgentAccessChips } from "../toolkit/AgentAccessChips";
import { SkillMetricsCard } from "./SkillMetricsCard";
import {
  Eye, Code2, Save, Undo2, Trash2, Copy,
  ChevronDown, ChevronRight, BarChart3, History, Users, Dna,
} from "lucide-react";

interface SkillDetailPanelProps {
  skill: Skill;
}

type ViewMode = "preview" | "code";
type BottomSection = "audit" | "versions" | "agents" | "evolution";

export function SkillDetailPanel({ skill }: SkillDetailPanelProps) {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const [instructions, setInstructions] = useState(skill.instructions);
  const [enabled, setEnabled] = useState(skill.enabled);
  const [description, setDescription] = useState(skill.description ?? "");
  const [triggerHint, setTriggerHint] = useState(skill.triggerHint ?? "");
  const [grants, setGrants] = useState<{ agentId: string; granted: boolean }[]>([]);
  const [expandedSection, setExpandedSection] = useState<BottomSection | null>(null);

  // Sync state when skill changes
  useEffect(() => {
    setInstructions(skill.instructions);
    setEnabled(skill.enabled);
    setDescription(skill.description ?? "");
    setTriggerHint(skill.triggerHint ?? "");
    setExpandedSection(null);
    setViewMode("preview");
  }, [skill.id]);

  const { data: accessData } = useQuery({
    queryKey: queryKeys.skills.access(selectedCompanyId!, skill.id),
    queryFn: () => skillsApi.getAccess(selectedCompanyId!, skill.id),
    enabled: !!selectedCompanyId,
  });

  useEffect(() => {
    if (accessData?.access) {
      setGrants(accessData.access.map((a) => ({ agentId: a.agentId, granted: a.granted })));
    }
  }, [accessData]);

  const isDirty =
    instructions !== skill.instructions ||
    enabled !== skill.enabled ||
    description !== (skill.description ?? "") ||
    triggerHint !== (skill.triggerHint ?? "");

  const updateSkill = useMutation({
    mutationFn: () =>
      skillsApi.update(selectedCompanyId!, skill.id, {
        description: description || null,
        triggerHint: triggerHint || null,
        instructions,
        enabled,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.skills.list(selectedCompanyId!) });
      pushToast({ title: "Skill saved", body: skill.name, tone: "success" });
    },
  });

  const updateAccess = useMutation({
    mutationFn: (newGrants: { agentId: string; granted: boolean }[]) =>
      skillsApi.updateAccess(selectedCompanyId!, skill.id, newGrants),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.skills.access(selectedCompanyId!, skill.id) });
    },
  });

  const deleteSkill = useMutation({
    mutationFn: () => skillsApi.remove(selectedCompanyId!, skill.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.skills.list(selectedCompanyId!) });
      pushToast({ title: "Skill deleted", body: skill.name, tone: "info" });
    },
  });

  const toggleSkill = useMutation({
    mutationFn: () =>
      skillsApi.update(selectedCompanyId!, skill.id, { enabled: !enabled }),
    onSuccess: () => {
      setEnabled(!enabled);
      queryClient.invalidateQueries({ queryKey: queryKeys.skills.list(selectedCompanyId!) });
    },
  });

  function handleSave() {
    updateSkill.mutate(undefined, {
      onSuccess: () => {
        if (grants.length > 0) updateAccess.mutate(grants);
      },
    });
  }

  function handleDiscard() {
    setInstructions(skill.instructions);
    setEnabled(skill.enabled);
    setDescription(skill.description ?? "");
    setTriggerHint(skill.triggerHint ?? "");
  }

  const duplicateSkill = useMutation({
    mutationFn: () =>
      skillsApi.create(selectedCompanyId!, {
        name: `${skill.name}-copy`,
        description: skill.description,
        category: skill.category,
        instructions: skill.instructions,
        triggerHint: skill.triggerHint,
        invokedBy: skill.invokedBy,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.skills.list(selectedCompanyId!) });
      pushToast({ title: "Skill duplicated", tone: "success" });
    },
    onError: () => {
      pushToast({ title: "Failed to duplicate skill", tone: "error" });
    },
  });

  function toggleSection(section: BottomSection) {
    setExpandedSection(expandedSection === section ? null : section);
  }

  const sourceLabel = skill.source === "builtin" ? "Built-in" : "Custom";
  const updatedDate = new Date(skill.updatedAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const invokedByLabel = skill.invokedBy?.replace(/_/g, " ") ?? "user or agent";

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border shrink-0">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold">{skill.name}</h2>
          <button
            type="button"
            onClick={() => toggleSkill.mutate()}
            aria-label={enabled ? "Disable skill" : "Enable skill"}
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

        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>Added by: {sourceLabel}</span>
          <span className="text-border">|</span>
          <span>Last updated: {updatedDate}</span>
          <span className="text-border">|</span>
          <span>Invoked by: {invokedByLabel}</span>
        </div>

        {/* Description (editable) */}
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add a description..."
          className="mt-2 w-full text-xs text-muted-foreground bg-transparent border-none outline-none placeholder:text-muted-foreground/50"
        />
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-5 py-4">
          {/* Preview / Code toggle */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
              <button
                onClick={() => setViewMode("preview")}
                className={cn(
                  "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs transition-colors",
                  viewMode === "preview"
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Eye className="h-3 w-3" />
                Preview
              </button>
              <button
                onClick={() => setViewMode("code")}
                className={cn(
                  "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs transition-colors",
                  viewMode === "code"
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Code2 className="h-3 w-3" />
                Code
              </button>
            </div>

            {/* Trigger hint */}
            {viewMode === "code" && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">Trigger:</span>
                <input
                  type="text"
                  value={triggerHint}
                  onChange={(e) => setTriggerHint(e.target.value)}
                  placeholder="When to invoke..."
                  className="text-[11px] text-muted-foreground bg-transparent border-b border-border outline-none w-48 focus:border-foreground/30"
                />
              </div>
            )}
          </div>

          {/* Content */}
          {viewMode === "preview" ? (
            <SkillMarkdownPreview content={instructions} />
          ) : (
            <SkillCodeEditor
              content={instructions}
              onChange={setInstructions}
            />
          )}

          {/* Bottom collapsible sections */}
          <div className="mt-6 border-t border-border pt-4 space-y-2">
            {/* Audit Score */}
            <BottomSectionToggle
              icon={BarChart3}
              label="Audit Score"
              open={expandedSection === "audit"}
              onClick={() => toggleSection("audit")}
            />
            {expandedSection === "audit" && (
              <div className="pl-6 pb-3">
                <SkillAuditCard skillId={skill.id} />
              </div>
            )}

            {/* Versions */}
            <BottomSectionToggle
              icon={History}
              label="Versions"
              open={expandedSection === "versions"}
              onClick={() => toggleSection("versions")}
            />
            {expandedSection === "versions" && (
              <div className="pl-6 pb-3">
                <SkillVersionHistory
                  skillId={skill.id}
                  currentContent={instructions}
                  onContentRestore={(content) => {
                    setInstructions(content);
                    setViewMode("code");
                  }}
                />
              </div>
            )}

            {/* Agent Access */}
            <BottomSectionToggle
              icon={Users}
              label="Agent Access"
              open={expandedSection === "agents"}
              onClick={() => toggleSection("agents")}
            />
            {expandedSection === "agents" && (
              <div className="pl-6 pb-3">
                <AgentAccessChips
                  grants={grants}
                  onUpdate={(g) => {
                    setGrants(g);
                    updateAccess.mutate(g);
                  }}
                />
              </div>
            )}

            {/* Evolution Metrics */}
            <BottomSectionToggle
              icon={Dna}
              label="Evolution"
              open={expandedSection === "evolution"}
              onClick={() => toggleSection("evolution")}
            />
            {expandedSection === "evolution" && (
              <div className="pl-6 pb-3">
                <SkillMetricsCard skillId={skill.id} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-border shrink-0 bg-background">
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive text-xs"
            onClick={() => {
              if (window.confirm(`Delete skill "${skill.name}"? This cannot be undone.`)) {
                deleteSkill.mutate();
              }
            }}
            disabled={deleteSkill.isPending}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Delete
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => duplicateSkill.mutate()}
            disabled={duplicateSkill.isPending}
          >
            <Copy className="h-3.5 w-3.5 mr-1" />
            {duplicateSkill.isPending ? "Duplicating..." : "Duplicate"}
          </Button>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={handleDiscard}
            disabled={!isDirty}
          >
            <Undo2 className="h-3.5 w-3.5 mr-1" />
            Discard
          </Button>
          <Button
            size="sm"
            className="text-xs"
            onClick={handleSave}
            disabled={!isDirty || updateSkill.isPending}
          >
            <Save className="h-3.5 w-3.5 mr-1" />
            {updateSkill.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface BottomSectionToggleProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  open: boolean;
  onClick: () => void;
}

function BottomSectionToggle({ icon: Icon, label, open, onClick }: BottomSectionToggleProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 w-full px-0 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
    >
      {open ? (
        <ChevronDown className="h-3 w-3 shrink-0" />
      ) : (
        <ChevronRight className="h-3 w-3 shrink-0" />
      )}
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {label}
    </button>
  );
}
