import { eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { skills } from "@paperclipai/db";

export type AuditResult = {
  score: number;
  strengths: string[];
  suggestions: string[];
  details: {
    clarity: number;
    triggerSpecificity: number;
    instructionCompleteness: number;
    exampleCoverage: number;
    edgeCaseHandling: number;
  };
};

// TODO: Replace with LLM-based analysis when LiteLLM integration is ready
function analyzeSkillContent(instructions: string): AuditResult {
  const lines = instructions.split("\n");
  const hasHeadings = lines.some((l) => l.startsWith("#"));
  const hasCodeBlock = instructions.includes("```");
  const hasExamples = /example|e\.g\.|for instance/i.test(instructions);
  const hasTrigger = /when to use|trigger|use when/i.test(instructions);
  const hasEdgeCases = /edge case|exception|fallback|error|fail/i.test(instructions);
  const wordCount = instructions.split(/\s+/).length;

  const clarity = hasHeadings ? 15 : 5;
  const triggerSpec = hasTrigger ? 18 : 5;
  const completeness = Math.min(20, Math.floor(wordCount / 25));
  const examples = hasCodeBlock || hasExamples ? 16 : 4;
  const edgeCases = hasEdgeCases ? 15 : 3;

  const strengths: string[] = [];
  const suggestions: string[] = [];

  if (hasHeadings) strengths.push("Well-structured with headings");
  else suggestions.push("Add markdown headings to structure the skill");

  if (hasTrigger) strengths.push("Clear trigger/usage conditions defined");
  else suggestions.push("Add a 'When to Use' section with trigger conditions");

  if (hasCodeBlock || hasExamples) strengths.push("Includes examples");
  else suggestions.push("Add examples or code blocks to illustrate usage");

  if (hasEdgeCases) strengths.push("Covers edge cases and error handling");
  else suggestions.push("Add edge case handling and failure scenarios");

  if (wordCount >= 100) strengths.push("Comprehensive instructions");
  else suggestions.push("Expand instructions with more detail (currently too brief)");

  return {
    score: clarity + triggerSpec + completeness + examples + edgeCases,
    strengths,
    suggestions,
    details: {
      clarity,
      triggerSpecificity: triggerSpec,
      instructionCompleteness: completeness,
      exampleCoverage: examples,
      edgeCaseHandling: edgeCases,
    },
  };
}

export function skillAuditService(db: Db) {
  return {
    async auditSkill(skillId: string): Promise<AuditResult> {
      const rows = await db.select().from(skills).where(eq(skills.id, skillId)).limit(1);
      const skill = rows[0];
      if (!skill) {
        throw new Error(`Skill ${skillId} not found`);
      }
      return analyzeSkillContent(skill.instructions);
    },
  };
}
