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

export type EnhanceResult = {
  originalScore: number;
  enhancedScore: number;
  enhancedContent: string;
  changes: string[];
};

function analyzeSkillContent(instructions: string): AuditResult {
  const lines = instructions.split("\n");
  const hasHeadings = lines.some((l) => l.startsWith("#"));
  const headingCount = lines.filter((l) => /^#{1,3}\s/.test(l)).length;
  const hasCodeBlock = instructions.includes("```");
  const codeBlockCount = Math.floor((instructions.match(/```/g) || []).length / 2);
  const hasExamples = /example|e\.g\.|for instance/i.test(instructions);
  const hasTrigger = /when to use|trigger|use when/i.test(instructions);
  const hasEdgeCases = /edge case|exception|fallback|error|fail/i.test(instructions);
  const hasInput = /input|parameter|argument|required|optional/i.test(instructions);
  const hasOutput = /output|return|result|response/i.test(instructions);
  const wordCount = instructions.split(/\s+/).length;

  // Scale to 100: clarity(20) + trigger(20) + completeness(25) + examples(20) + edge(15) = 100
  const clarity = Math.min(20, hasHeadings ? 10 + headingCount * 2 : 3);
  const triggerSpec = hasTrigger ? 20 : 3;
  const completeness = Math.min(25, Math.floor(wordCount / 20) + (hasInput ? 2 : 0) + (hasOutput ? 2 : 0));
  const examples = Math.min(20, (hasCodeBlock ? 4 + codeBlockCount * 2 : 0) + (hasExamples ? 8 : 0));
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

  return {
    score: Math.min(100, clarity + triggerSpec + completeness + examples + edgeCases),
    strengths,
    suggestions,
    details: { clarity, triggerSpecificity: triggerSpec, instructionCompleteness: completeness, exampleCoverage: examples, edgeCaseHandling: edgeCases },
  };
}

function enhanceSkillContent(instructions: string, audit: AuditResult): EnhanceResult {
  let enhanced = instructions;
  const changes: string[] = [];

  // Fix missing headings
  if (audit.details.clarity < 10 && !instructions.startsWith("#")) {
    const firstLine = instructions.split("\n")[0].trim();
    enhanced = `# ${firstLine}\n\n${enhanced}`;
    changes.push("Added main heading");
  }

  // Fix missing trigger section
  if (audit.details.triggerSpecificity < 10) {
    const triggerSection = "\n\n## When to Use\n\nUse this skill when you need to perform the task described above. Trigger conditions:\n- User explicitly requests this capability\n- Task matches the skill's domain\n- No simpler approach exists\n";
    const insertPos = enhanced.indexOf("\n## ") > 0 ? enhanced.indexOf("\n## ") : enhanced.length;
    enhanced = enhanced.slice(0, insertPos) + triggerSection + enhanced.slice(insertPos);
    changes.push("Added 'When to Use' trigger section");
  }

  // Fix missing edge cases
  if (audit.details.edgeCaseHandling < 10) {
    enhanced += "\n\n## Edge Cases & Error Handling\n\n- **Empty input**: Return early with a helpful message if no input is provided\n- **Invalid format**: Validate input format before processing\n- **Timeout/failure**: Retry once, then report the error clearly\n- **Partial results**: Return what succeeded and note what failed\n";
    changes.push("Added edge case handling section");
  }

  // Fix missing examples
  if (audit.details.exampleCoverage < 10) {
    enhanced += "\n\n## Examples\n\n### Basic Usage\n```\n# Example invocation\nInput: [describe typical input]\nOutput: [describe expected output]\n```\n\n### Advanced Usage\n```\n# Complex scenario\nInput: [describe complex input]\nOutput: [describe expected output with edge cases handled]\n```\n";
    changes.push("Added example section with code blocks");
  }

  // Fix short content
  if (audit.details.instructionCompleteness < 15) {
    enhanced += "\n\n## Detailed Instructions\n\n1. **Preparation**: Gather required context before starting\n2. **Execution**: Follow the steps described above precisely\n3. **Validation**: Verify the output matches expectations\n4. **Reporting**: Summarize what was done and any issues encountered\n";
    changes.push("Added detailed step-by-step instructions");
  }

  // Fix missing input/output
  if (!/input|parameter|argument|required/i.test(instructions)) {
    const ioSection = "\n\n## Input & Output\n\n**Input (Required)**:\n- Target or subject to process\n\n**Input (Optional)**:\n- Mode: fast (default) or deep\n- Scope: specific file or full module\n\n**Output**:\n- Results summary with actionable recommendations\n";
    const triggerIdx = enhanced.indexOf("## When to Use");
    if (triggerIdx > 0) {
      const afterTrigger = enhanced.indexOf("\n## ", triggerIdx + 10);
      const pos = afterTrigger > 0 ? afterTrigger : enhanced.length;
      enhanced = enhanced.slice(0, pos) + ioSection + enhanced.slice(pos);
    } else {
      enhanced += ioSection;
    }
    changes.push("Added input/output specification");
  }

  const enhancedAudit = analyzeSkillContent(enhanced);

  return {
    originalScore: audit.score,
    enhancedScore: enhancedAudit.score,
    enhancedContent: enhanced,
    changes,
  };
}

export function skillAuditService(db: Db) {
  return {
    async auditSkill(skillId: string): Promise<AuditResult> {
      const rows = await db.select().from(skills).where(eq(skills.id, skillId)).limit(1);
      const skill = rows[0];
      if (!skill) throw new Error(`Skill ${skillId} not found`);
      return analyzeSkillContent(skill.instructions);
    },

    async enhanceSkill(skillId: string): Promise<EnhanceResult> {
      const rows = await db.select().from(skills).where(eq(skills.id, skillId)).limit(1);
      const skill = rows[0];
      if (!skill) throw new Error(`Skill ${skillId} not found`);
      const audit = analyzeSkillContent(skill.instructions);
      return enhanceSkillContent(skill.instructions, audit);
    },
  };
}
