export interface ParsedFeedback {
  skillFeedbacks: Array<{
    skillSlug: string;
    version?: number;
    used: boolean;
    helpful: "yes" | "no" | "partial" | null;
  }>;
  novelPatterns: Array<{
    description: string;
    tools: string[];
  }>;
  noSkillsUsed: boolean;
}

/**
 * Parses SKILL_FEEDBACK blocks from heartbeat run transcripts.
 *
 * Expected format:
 * ```
 * SKILL_FEEDBACK:
 * - skill: code-review | version: 4 | used: yes | helpful: yes
 * - novel_pattern: "retry with backoff" | tools: [github.create_pr]
 * - no_skills_used: false
 * ```
 */
export function parseSkillFeedback(transcript: string): ParsedFeedback {
  const result: ParsedFeedback = {
    skillFeedbacks: [],
    novelPatterns: [],
    noSkillsUsed: false,
  };

  // Find the SKILL_FEEDBACK block
  const blockMatch = transcript.match(/SKILL_FEEDBACK:\s*\n((?:\s*-\s+.+\n?)*)/i);
  if (!blockMatch) return result;

  const lines = blockMatch[1].split("\n").filter((l) => l.trim().startsWith("-"));

  for (const line of lines) {
    const trimmed = line.replace(/^\s*-\s+/, "").trim();

    // Parse skill line: skill: slug | version: N | used: yes | helpful: yes
    const skillMatch = trimmed.match(/^skill:\s*([^\s|]+)/);
    if (skillMatch) {
      const versionMatch = trimmed.match(/version:\s*(\d+)/);
      const usedMatch = trimmed.match(/used:\s*(yes|no)/i);
      const helpfulMatch = trimmed.match(/helpful:\s*(yes|no|partial)/i);

      result.skillFeedbacks.push({
        skillSlug: skillMatch[1],
        version: versionMatch ? parseInt(versionMatch[1], 10) : undefined,
        used: usedMatch ? usedMatch[1].toLowerCase() === "yes" : false,
        helpful: helpfulMatch ? (helpfulMatch[1].toLowerCase() as "yes" | "no" | "partial") : null,
      });
      continue;
    }

    // Parse novel_pattern line: novel_pattern: "description" | tools: [tool1, tool2]
    const patternMatch = trimmed.match(/^novel_pattern:\s*"([^"]+)"/);
    if (patternMatch) {
      const toolsMatch = trimmed.match(/tools:\s*\[([^\]]*)\]/);
      const tools = toolsMatch
        ? toolsMatch[1]
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [];

      result.novelPatterns.push({
        description: patternMatch[1],
        tools,
      });
      continue;
    }

    // Parse no_skills_used line
    const noSkillsMatch = trimmed.match(/^no_skills_used:\s*(true|yes)/i);
    if (noSkillsMatch) {
      result.noSkillsUsed = true;
    }
  }

  return result;
}
