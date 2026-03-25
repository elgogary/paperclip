import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../../context/CompanyContext";
import { skillsApi, type SkillVersion } from "../../api/skills";
import { queryKeys } from "../../lib/queryKeys";
import { cn } from "../../lib/utils";
import { Button } from "@/components/ui/button";
import { History, RotateCcw, GitCompare, Loader2 } from "lucide-react";

interface SkillVersionHistoryProps {
  skillId: string;
  currentContent: string;
  onContentRestore: (content: string) => void;
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.round(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.round(days / 7)}w ago`;
}

function originLabel(origin: string): { text: string; color: string } {
  switch (origin.toLowerCase()) {
    case "fix":
      return { text: "FIX", color: "bg-amber-500/15 text-amber-400" };
    case "derived":
      return { text: "DERIVED", color: "bg-purple-500/15 text-purple-400" };
    case "rollback":
      return { text: "ROLLBACK", color: "bg-red-500/15 text-red-400" };
    default:
      return { text: "manual", color: "bg-muted text-muted-foreground" };
  }
}

export function SkillVersionHistory({
  skillId,
  currentContent,
  onContentRestore,
}: SkillVersionHistoryProps) {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const [selectedVersion, setSelectedVersion] = useState<SkillVersion | null>(null);
  const [showDiff, setShowDiff] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.skills.versions(selectedCompanyId!, skillId),
    queryFn: () => skillsApi.listVersions(selectedCompanyId!, skillId),
    enabled: !!selectedCompanyId,
  });

  const versions: SkillVersion[] = data?.versions ?? [];

  const rollback = useMutation({
    mutationFn: (targetVersion: number) =>
      skillsApi.rollback(selectedCompanyId!, skillId, targetVersion),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.skills.versions(selectedCompanyId!, skillId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.skills.list(selectedCompanyId!) });
      setSelectedVersion(null);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        <span className="text-xs">Loading versions...</span>
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-6">
        <History className="h-6 w-6 text-muted-foreground/40" />
        <p className="text-xs text-muted-foreground">No version history yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Version timeline */}
      <div className="space-y-1">
        {versions.map((v, i) => {
          const { text: oLabel, color: oColor } = originLabel(v.origin);
          const isCurrent = i === 0;
          const isSelected = selectedVersion?.id === v.id;

          return (
            <button
              key={v.id}
              type="button"
              onClick={() => setSelectedVersion(isSelected ? null : v)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors",
                isSelected
                  ? "bg-accent border border-foreground/10"
                  : "hover:bg-accent/50",
              )}
            >
              {/* Timeline dot */}
              <div className="flex flex-col items-center shrink-0">
                <div
                  className={cn(
                    "h-2.5 w-2.5 rounded-full",
                    isCurrent ? "bg-emerald-500" : "bg-muted-foreground/30",
                  )}
                />
                {i < versions.length - 1 && <div className="w-px h-4 bg-border" />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">
                    v{v.version}
                    {isCurrent && <span className="text-muted-foreground ml-1">(current)</span>}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-1.5 py-px text-[9px] font-medium",
                      oColor,
                    )}
                  >
                    {oLabel}
                  </span>
                </div>
                {v.triggerReason && (
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                    {v.triggerReason}
                  </p>
                )}
              </div>

              <span className="text-[10px] text-muted-foreground shrink-0">
                {formatTimeAgo(v.createdAt)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected version actions */}
      {selectedVersion && (
        <div className="border border-border rounded-md p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold">
              Version {selectedVersion.version}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="text-xs h-7"
                onClick={() => setShowDiff(!showDiff)}
              >
                <GitCompare className="h-3 w-3 mr-1" />
                {showDiff ? "Show full" : "Diff with current"}
              </Button>
              {versions[0]?.id !== selectedVersion.id && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7"
                  onClick={() => rollback.mutate(selectedVersion.version)}
                  disabled={rollback.isPending}
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  {rollback.isPending ? "Rolling back..." : "Rollback"}
                </Button>
              )}
            </div>
          </div>

          {showDiff && selectedVersion.contentDiff ? (
            <pre className="bg-[oklch(0.12_0_0)] p-3 rounded-md text-xs overflow-x-auto max-h-[300px] overflow-y-auto font-mono">
              {selectedVersion.contentDiff.split("\n").map((line, i) => (
                <div
                  key={i}
                  className={cn(
                    line.startsWith("+") && !line.startsWith("+++")
                      ? "text-emerald-400 bg-emerald-500/10"
                      : line.startsWith("-") && !line.startsWith("---")
                        ? "text-red-400 bg-red-500/10"
                        : "text-muted-foreground",
                  )}
                >
                  {line}
                </div>
              ))}
            </pre>
          ) : (
            <pre className="bg-[oklch(0.12_0_0)] p-3 rounded-md text-xs overflow-x-auto max-h-[300px] overflow-y-auto font-mono text-muted-foreground whitespace-pre-wrap">
              {selectedVersion.fullContent}
            </pre>
          )}

          <Button
            size="sm"
            variant="ghost"
            className="text-xs"
            onClick={() => onContentRestore(selectedVersion.fullContent)}
          >
            Load into editor
          </Button>
        </div>
      )}
    </div>
  );
}
