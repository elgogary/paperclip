import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useCompany } from "../../context/CompanyContext";
import { skillsApi, type AuditResult } from "../../api/skills";
import { cn } from "../../lib/utils";
import { BarChart3, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SkillAuditCardProps {
  skillId: string;
}

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

function DetailBar({ label, value }: { label: string; value: number }) {
  const color =
    value >= 80 ? "bg-emerald-500/70" : value >= 60 ? "bg-amber-500/70" : "bg-red-500/70";
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-40 text-muted-foreground truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${value}%` }} />
      </div>
      <span className="w-6 text-right text-muted-foreground">{value}</span>
    </div>
  );
}

export function SkillAuditCard({ skillId }: SkillAuditCardProps) {
  const { selectedCompanyId } = useCompany();
  const [result, setResult] = useState<AuditResult | null>(null);

  const audit = useMutation({
    mutationFn: () => skillsApi.audit(selectedCompanyId!, skillId),
    onSuccess: (data) => setResult(data),
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
        >
          {audit.isPending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              Auditing...
            </>
          ) : (
            <>
              <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
              Run Audit
            </>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ScoreBar score={result.score} />

      <div className="space-y-2">
        <DetailBar label="Clarity" value={result.details.clarity} />
        <DetailBar label="Trigger specificity" value={result.details.triggerSpecificity} />
        <DetailBar label="Instruction completeness" value={result.details.instructionCompleteness} />
        <DetailBar label="Example coverage" value={result.details.exampleCoverage} />
        <DetailBar label="Edge case handling" value={result.details.edgeCaseHandling} />
      </div>

      {result.strengths.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            Strengths
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
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            Suggestions
          </p>
          <ul className="space-y-1">
            {result.suggestions.map((s, i) => (
              <li key={i} className="text-xs text-muted-foreground ml-5">- {s}</li>
            ))}
          </ul>
        </div>
      )}

      <Button
        size="sm"
        variant="ghost"
        className="text-xs"
        onClick={() => audit.mutate()}
        disabled={audit.isPending}
      >
        {audit.isPending ? "Re-auditing..." : "Re-audit"}
      </Button>
    </div>
  );
}
