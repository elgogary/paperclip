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
  const headingCount = lines.filter((l) => /^#{1,3}\s/.test(l)).length;
  const hasCodeBlock = instructions.includes("```");
  const codeBlockCount = (instructions.match(/```/g) || []).length / 2;
  const hasExamples = /example|e\.g\.|for instance/i.test(instructions);
  const hasTrigger = /when to use|trigger|use when/i.test(instructions);
  const hasEdgeCases = /edge case|exception|fallback|error|fail/i.test(instructions);
  const hasInput = /input|parameter|argument|required|optional/i.test(instructions);
  const hasOutput = /output|return|result|response/i.test(instructions);
  const wordCount = instructions.split(/\s+/).length;

  // Scale to 100: clarity(20) + trigger(20) + completeness(25) + examples(20) + edge(15)
  const clarity = hasHeadings ? Math.min(20, 10 + headingCount * 2) : 3;
  const triggerSpec = hasTrigger ? 20 : 3;
  const completeness = Math.min(25, Math.floor(wordCount / 20)) + (hasInput ? 2 : 0) + (hasOutput ? 2 : 0);
  const examples = (hasCodeBlock ? Math.min(12, 4 + Math.floor(codeBlockCount) * 2) : 0) + (hasExamples ? 8 : 0);
  const edgeCases = hasEdgeCases ? 15 : 2;

  const strengths: string[] = [];
  const suggestions: string[] = [];

  if (hasHeadings && headingCount >= 3) strengths.push("Well-structured with multiple sections");
  else if (hasHeadings) strengths.push("Has headings");
  else suggestions.push("Add markdown headings to structure the skill");

  if (hasTrigger) strengths.push("Clear trigger/usage conditions defined");
  else suggestions.push("Add a 'When to Use' section with trigger conditions");

  if (hasCodeBlock && hasExamples) strengths.push("Rich examples with code blocks");
  else if (hasCodeBlock || hasExamples) strengths.push("Includes examples");
  else suggestions.push("Add examples or code blocks to illustrate usage");

  if (hasEdgeCases) strengths.push("Covers edge cases and error handling");
  else suggestions.push("Add edge case handling and failure scenarios");

  if (wordCount >= 500) strengths.push("Comprehensive and detailed instructions");
  else if (wordCount >= 100) strengths.push("Good instruction coverage");
  else suggestions.push("Expand instructions with more detail (currently too brief)");

  if (hasInput && hasOutput) strengths.push("Clear input/output specification");
  else if (!hasInput) suggestions.push("Document required inputs and parameters");

  const rawScore = clarity + triggerSpec + Math.min(25, completeness) + Math.min(20, examples) + edgeCases;

  return {
    score: Math.min(100, rawScore),
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
