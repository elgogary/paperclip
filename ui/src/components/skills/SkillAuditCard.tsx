import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useCompany } from "../../context/CompanyContext";
import { skillsApi, type AuditResult } from "../../api/skills";
import { cn } from "../../lib/utils";
import { BarChart3, CheckCircle2, AlertTriangle, Loader2, Sparkles, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SkillAuditCardProps {
  skillId: string;
  onEnhanceAccepted?: () => void;
}

const DETAIL_MAX: Record<string, number> = {
  clarity: 20,
  triggerSpecificity: 20,
  instructionCompleteness: 25,
  exampleCoverage: 20,
  edgeCaseHandling: 15,
};

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-3">
      <span className="text-2xl font-bold">{score}</span>
      <span className="text-sm text-muted-foreground">/100</span>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function DetailBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.round((Math.min(value, max) / max) * 100);
  const color =
    pct >= 80 ? "bg-emerald-500/70" : pct >= 60 ? "bg-amber-500/70" : "bg-red-500/70";
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-40 text-muted-foreground truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 text-right text-muted-foreground">{Math.min(value, max)}/{max}</span>
    </div>
  );
}

interface EnhancePreview {
  originalScore: number;
  enhancedScore: number;
  enhancedContent: string;
  changes: string[];
}

export function SkillAuditCard({ skillId, onEnhanceAccepted }: SkillAuditCardProps) {
  const { selectedCompanyId } = useCompany();
  const [result, setResult] = useState<AuditResult | null>(null);
  const [enhancePreview, setEnhancePreview] = useState<EnhancePreview | null>(null);

  const audit = useMutation({
    mutationFn: () => skillsApi.audit(selectedCompanyId!, skillId),
    onSuccess: (data) => { setResult(data); setEnhancePreview(null); },
  });

  const enhance = useMutation({
    mutationFn: () => skillsApi.enhance(selectedCompanyId!, skillId),
    onSuccess: (data) => setEnhancePreview(data),
  });

  const acceptEnhance = useMutation({
    mutationFn: () =>
      skillsApi.acceptEnhancement(selectedCompanyId!, skillId, {
        enhancedContent: enhancePreview!.enhancedContent,
        changes: enhancePreview!.changes,
      }),
    onSuccess: () => {
      setEnhancePreview(null);
      setResult(null);
      onEnhanceAccepted?.();
      // Re-audit to show new score
      audit.mutate();
    },
  });

  if (!result) {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <BarChart3 className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-xs text-muted-foreground">Run an audit to check skill quality</p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => audit.mutate()}
          disabled={audit.isPending}
          aria-label="Run skill audit"
        >
          {audit.isPending ? (
            <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Auditing...</>
          ) : (
            <><BarChart3 className="h-3.5 w-3.5 mr-1.5" />Run Audit</>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ScoreBar score={result.score} />

      <div className="space-y-2">
        <DetailBar label="Clarity" value={result.details.clarity} max={DETAIL_MAX.clarity} />
        <DetailBar label="Trigger specificity" value={result.details.triggerSpecificity} max={DETAIL_MAX.triggerSpecificity} />
        <DetailBar label="Instruction completeness" value={result.details.instructionCompleteness} max={DETAIL_MAX.instructionCompleteness} />
        <DetailBar label="Example coverage" value={result.details.exampleCoverage} max={DETAIL_MAX.exampleCoverage} />
        <DetailBar label="Edge case handling" value={result.details.edgeCaseHandling} max={DETAIL_MAX.edgeCaseHandling} />
      </div>

      {result.strengths.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />Strengths
          </p>
          <ul className="space-y-1">
            {result.strengths.map((s, i) => (
              <li key={i} className="text-xs text-muted-foreground ml-5">- {s}</li>
            ))}
          </ul>
        </div>
      )}

      {result.suggestions.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />Suggestions
          </p>
          <ul className="space-y-1">
            {result.suggestions.map((s, i) => (
              <li key={i} className="text-xs text-muted-foreground ml-5">- {s}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Enhance Preview */}
      {enhancePreview && (
        <div className="border border-border rounded-lg p-3 bg-card space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-purple-400" />AI Enhancement Preview
            </p>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">{enhancePreview.originalScore}</span>
              <span className="text-muted-foreground">→</span>
              <span className="text-emerald-500 font-semibold">{enhancePreview.enhancedScore}</span>
            </div>
          </div>
          <ul className="space-y-1">
            {enhancePreview.changes.map((c, i) => (
              <li key={i} className="text-xs text-muted-foreground ml-2 flex items-center gap-1.5">
                <span className="text-emerald-500">+</span> {c}
              </li>
            ))}
          </ul>
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              variant="default"
              className="text-xs"
              onClick={() => acceptEnhance.mutate()}
              disabled={acceptEnhance.isPending}
              aria-label="Accept enhancement"
            >
              {acceptEnhance.isPending ? (
                <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Saving...</>
              ) : (
                <><Check className="h-3 w-3 mr-1" />Accept & Save as New Version</>
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-xs"
              onClick={() => setEnhancePreview(null)}
              aria-label="Reject enhancement"
            >
              <X className="h-3 w-3 mr-1" />Reject
            </Button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="ghost"
          className="text-xs"
          onClick={() => audit.mutate()}
          disabled={audit.isPending}
        >
          {audit.isPending ? "Re-auditing..." : "Re-audit"}
        </Button>
        {result.score < 90 && !enhancePreview && (
          <Button
            size="sm"
            variant="outline"
            className="text-xs"
            onClick={() => enhance.mutate()}
            disabled={enhance.isPending}
            aria-label="Enhance skill with AI"
          >
            {enhance.isPending ? (
              <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Enhancing...</>
            ) : (
              <><Sparkles className="h-3.5 w-3.5 mr-1.5 text-purple-400" />Enhance with AI</>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
