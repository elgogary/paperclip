import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock @paperclipai/db — must include all table symbols used by skill-* services
vi.mock("@paperclipai/db", () => ({
  skills: {
    id: "id", companyId: "companyId", slug: "slug", enabled: "enabled",
    instructions: "instructions", version: "version", updatedAt: "updatedAt",
    evolutionStatus: "evolutionStatus", qualityMetrics: "qualityMetrics",
  },
  skillVersions: {
    id: "id", skillId: "skillId", version: "version", createdAt: "createdAt",
    origin: "origin", fullContent: "fullContent",
  },
  evolutionEvents: {
    id: "id", companyId: "companyId", skillId: "skillId", eventType: "eventType",
    sourceMonitor: "sourceMonitor", status: "status", createdAt: "createdAt",
    analysis: "analysis",
  },
  skillAgentMetrics: {
    skillId: "skillId", skillVersion: "skillVersion", agentId: "agentId",
    appliedCount: "appliedCount", successCount: "successCount",
    failureCount: "failureCount", totalTokens: "totalTokens",
  },
}));

import { parseSkillFeedback } from "../services/skill-feedback-parser.js";
import { skillVersionsService } from "../services/skill-versions.js";
import { skillEvolutionService } from "../services/skill-evolution.js";
import { skillAuditService } from "../services/skill-audit.js";
import { skillCreatorService } from "../services/skill-creator.js";
import { skillMetricsTracker } from "../services/skill-metrics-tracker.js";
import { skillRetrievalService } from "../services/skill-retrieval.js";

// ── Chainable mock DB (same pattern as toolkit-services.test.ts) ────────────

function createMockDb(resolveValue: unknown = []) {
  const mockDb: Record<string, any> = {};
  const chainMethods = [
    "select", "from", "where", "orderBy", "limit",
    "insert", "values", "returning",
    "update", "set",
    "delete",
    "onConflictDoUpdate",
  ];
  for (const method of chainMethods) {
    mockDb[method] = vi.fn().mockReturnValue(mockDb);
  }
  mockDb.limit = vi.fn().mockResolvedValue(resolveValue);
  mockDb.returning = vi.fn().mockResolvedValue(resolveValue);
  mockDb.orderBy = vi.fn().mockImplementation(() => {
    const result = Object.create(mockDb);
    result.then = (resolve: any) => Promise.resolve(resolveValue).then(resolve);
    result.catch = (reject: any) => Promise.resolve(resolveValue).catch(reject);
    return result;
  });
  mockDb.where = vi.fn().mockImplementation(() => {
    const result = Object.create(mockDb);
    result.then = (resolve: any) => Promise.resolve(resolveValue).then(resolve);
    result.catch = (reject: any) => Promise.resolve(resolveValue).catch(reject);
    return result;
  });
  mockDb.transaction = vi.fn(async (cb: any) => cb(mockDb));
  mockDb.execute = vi.fn().mockResolvedValue(resolveValue);
  return mockDb;
}

// ── parseSkillFeedback ──────────────────────────────────────────────────────

describe("parseSkillFeedback", () => {
  it("parses single skill feedback line", () => {
    const transcript = `Some preamble text
SKILL_FEEDBACK:
- skill: code-review | version: 4 | used: yes | helpful: yes
Done.`;
    const result = parseSkillFeedback(transcript);
    expect(result.skillFeedbacks).toHaveLength(1);
    expect(result.skillFeedbacks[0]).toEqual({
      skillSlug: "code-review",
      version: 4,
      used: true,
      helpful: "yes",
    });
  });

  it("parses multiple skill feedbacks", () => {
    const transcript = `SKILL_FEEDBACK:
- skill: code-review | version: 2 | used: yes | helpful: yes
- skill: deploy-check | version: 1 | used: yes | helpful: no
`;
    const result = parseSkillFeedback(transcript);
    expect(result.skillFeedbacks).toHaveLength(2);
    expect(result.skillFeedbacks[0].skillSlug).toBe("code-review");
    expect(result.skillFeedbacks[1].skillSlug).toBe("deploy-check");
    expect(result.skillFeedbacks[1].helpful).toBe("no");
  });

  it("parses novel_pattern with tools", () => {
    const transcript = `SKILL_FEEDBACK:
- novel_pattern: "retry with backoff" | tools: [github.create_pr, slack.send]
`;
    const result = parseSkillFeedback(transcript);
    expect(result.novelPatterns).toHaveLength(1);
    expect(result.novelPatterns[0].description).toBe("retry with backoff");
    expect(result.novelPatterns[0].tools).toEqual(["github.create_pr", "slack.send"]);
  });

  it("parses no_skills_used: true", () => {
    const transcript = `SKILL_FEEDBACK:
- no_skills_used: true
`;
    const result = parseSkillFeedback(transcript);
    expect(result.noSkillsUsed).toBe(true);
    expect(result.skillFeedbacks).toHaveLength(0);
  });

  it("handles empty transcript (no SKILL_FEEDBACK block)", () => {
    const result = parseSkillFeedback("Just a normal conversation with no feedback block.");
    expect(result.skillFeedbacks).toHaveLength(0);
    expect(result.novelPatterns).toHaveLength(0);
    expect(result.noSkillsUsed).toBe(false);
  });

  it("handles malformed lines gracefully", () => {
    const transcript = `SKILL_FEEDBACK:
- garbage line with no structure
- skill: valid-one | used: yes | helpful: partial
- another bad line
`;
    const result = parseSkillFeedback(transcript);
    expect(result.skillFeedbacks).toHaveLength(1);
    expect(result.skillFeedbacks[0].skillSlug).toBe("valid-one");
    expect(result.skillFeedbacks[0].helpful).toBe("partial");
  });
});

// ── skillVersionsService ────────────────────────────────────────────────────

describe("skillVersionsService", () => {
  it("returns service with expected methods", () => {
    const svc = skillVersionsService({} as any);
    expect(typeof svc.listVersions).toBe("function");
    expect(typeof svc.getVersion).toBe("function");
    expect(typeof svc.createVersion).toBe("function");
    expect(typeof svc.diffVersions).toBe("function");
    expect(typeof svc.rollback).toBe("function");
  });

  it("createVersion auto-increments version number", async () => {
    const created = { id: "v1", skillId: "s1", version: 4, fullContent: "new" };
    const db = createMockDb([]);
    // First limit call: maxVersion query returns 3
    let limitCalls = 0;
    db.limit = vi.fn().mockImplementation(() => {
      limitCalls++;
      if (limitCalls === 1) return Promise.resolve([{ maxVersion: 3 }]);
      // getVersion for prev version (version 3) — return null so no diff
      return Promise.resolve([]);
    });
    db.returning = vi.fn().mockResolvedValue([created]);

    const svc = skillVersionsService(db as any);
    const result = await svc.createVersion("s1", {
      origin: "manual",
      fullContent: "new content",
    });
    expect(result.version).toBe(4);
    expect(db.insert).toHaveBeenCalled();
  });

  it("rollback creates new version with origin='manual'", async () => {
    const targetVersion = { id: "v2", skillId: "s1", version: 2, fullContent: "old content" };
    const rolledBack = { id: "v5", skillId: "s1", version: 5, fullContent: "old content" };
    const db = createMockDb([]);
    let limitCalls = 0;
    db.limit = vi.fn().mockImplementation(() => {
      limitCalls++;
      // Call 1: getVersion for targetVersion (inside rollback)
      if (limitCalls === 1) return Promise.resolve([targetVersion]);
      // Call 2: maxVersion query inside createVersion
      if (limitCalls === 2) return Promise.resolve([{ maxVersion: 4 }]);
      // Call 3+: getVersion for prev version diff
      return Promise.resolve([]);
    });
    db.returning = vi.fn().mockResolvedValue([rolledBack]);

    const svc = skillVersionsService(db as any);
    const result = await svc.rollback("s1", 2);
    expect(result).toEqual(rolledBack);
    expect(db.insert).toHaveBeenCalled();
  });

  it("diffVersions returns diff string", async () => {
    const v1 = { id: "v1", skillId: "s1", version: 1, fullContent: "line1\nline2" };
    const v2 = { id: "v2", skillId: "s1", version: 2, fullContent: "line1\nline3" };
    const db = createMockDb([]);
    db.limit = vi.fn()
      .mockResolvedValueOnce([v1])
      .mockResolvedValueOnce([v2]);

    const svc = skillVersionsService(db as any);
    const diff = await svc.diffVersions("s1", 1, 2);
    expect(diff).toContain("- line2");
    expect(diff).toContain("+ line3");
  });
});

// ── skillEvolutionService ───────────────────────────────────────────────────

describe("skillEvolutionService", () => {
  it("returns service with expected methods", () => {
    const svc = skillEvolutionService({} as any);
    expect(typeof svc.analyzeRun).toBe("function");
    expect(typeof svc.handleToolDegradation).toBe("function");
    expect(typeof svc.sweepMetrics).toBe("function");
    expect(typeof svc.applyEvolution).toBe("function");
    expect(typeof svc.rejectEvolution).toBe("function");
    expect(typeof svc.listEvents).toBe("function");
    expect(typeof svc.getEvent).toBe("function");
  });

  it("analyzeRun returns null when no feedback found", async () => {
    const db = createMockDb([]);
    const svc = skillEvolutionService(db as any);
    const result = await svc.analyzeRun({
      runId: "r1", companyId: "c1", agentId: "a1",
      transcript: "No feedback block here.",
    });
    expect(result).toBeNull();
  });

  it("analyzeRun creates FIX event when skill failed", async () => {
    const fixEvent = { id: "ev1", eventType: "fix", status: "pending" };
    const db = createMockDb([]);
    // findSkillBySlug lookup returns a skill
    db.limit = vi.fn().mockResolvedValue([{ id: "s1", slug: "bad-skill" }]);
    db.returning = vi.fn().mockResolvedValue([fixEvent]);

    const svc = skillEvolutionService(db as any);
    const result = await svc.analyzeRun({
      runId: "r1", companyId: "c1", agentId: "a1",
      transcript: `SKILL_FEEDBACK:
- skill: bad-skill | version: 1 | used: yes | helpful: no
`,
    });
    expect(result).toEqual(fixEvent);
    expect(db.insert).toHaveBeenCalled();
  });

  it("analyzeRun creates CAPTURED event for novel pattern", async () => {
    const capturedEvent = { id: "ev2", eventType: "captured", status: "pending" };
    const db = createMockDb([]);
    db.returning = vi.fn().mockResolvedValue([capturedEvent]);

    const svc = skillEvolutionService(db as any);
    const result = await svc.analyzeRun({
      runId: "r1", companyId: "c1", agentId: "a1",
      transcript: `SKILL_FEEDBACK:
- novel_pattern: "auto-retry on 429" | tools: [http.request]
`,
    });
    expect(result).toEqual(capturedEvent);
    expect(db.insert).toHaveBeenCalled();
  });

  it("rejectEvolution updates status to rejected", async () => {
    const db = createMockDb([]);
    // getEventById lookup
    db.limit = vi.fn().mockResolvedValue([{ id: "ev1", analysis: { foo: "bar" } }]);

    const svc = skillEvolutionService(db as any);
    await svc.rejectEvolution("ev1", "Not useful");
    expect(db.update).toHaveBeenCalled();
    expect(db.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "rejected",
        reviewedBy: "board",
        analysis: expect.objectContaining({ rejectionReason: "Not useful" }),
      }),
    );
  });
});

// ── skillAuditService ───────────────────────────────────────────────────────

describe("skillAuditService", () => {
  it("returns higher score for well-structured content", async () => {
    const wellStructured = `# My Skill

## When to Use
Use when deploying to production.

## Instructions
1. Run tests
2. Check coverage

## Examples
\`\`\`bash
npm test
\`\`\`

## Edge Cases
Handle timeout errors by retrying.
`;
    const db = createMockDb([]);
    db.limit = vi.fn().mockResolvedValue([{ id: "s1", instructions: wellStructured }]);

    const svc = skillAuditService(db as any);
    const result = await svc.auditSkill("s1");
    expect(result.score).toBeGreaterThan(50);
  });

  it("returns lower score for minimal content", async () => {
    const minimal = "Do the thing.";
    const db = createMockDb([]);
    db.limit = vi.fn().mockResolvedValue([{ id: "s2", instructions: minimal }]);

    const svc = skillAuditService(db as any);
    const result = await svc.auditSkill("s2");
    expect(result.score).toBeLessThan(30);
  });

  it("includes strengths and suggestions", async () => {
    const content = "# Title\nSome instructions here.";
    const db = createMockDb([]);
    db.limit = vi.fn().mockResolvedValue([{ id: "s3", instructions: content }]);

    const svc = skillAuditService(db as any);
    const result = await svc.auditSkill("s3");
    expect(Array.isArray(result.strengths)).toBe(true);
    expect(Array.isArray(result.suggestions)).toBe(true);
    expect(result.strengths.length + result.suggestions.length).toBeGreaterThan(0);
  });
});

// ── skillCreatorService ─────────────────────────────────────────────────────

describe("skillCreatorService", () => {
  it("generates skill with proper slug from description", async () => {
    const svc = skillCreatorService({} as any);
    const result = await svc.generateSkill({
      description: "Review pull requests for security issues",
      companyId: "c1",
    });
    expect(result.slug).toMatch(/^[a-z0-9-]+$/);
    expect(result.slug.length).toBeGreaterThan(0);
  });

  it("includes frontmatter and template sections", async () => {
    const svc = skillCreatorService({} as any);
    const result = await svc.generateSkill({
      description: "Deploy to staging",
      category: "ops",
      companyId: "c1",
    });
    expect(result.instructions).toContain("---");
    expect(result.instructions).toContain("## When to Use");
    expect(result.instructions).toContain("## Instructions");
    expect(result.instructions).toContain("## Examples");
    expect(result.instructions).toContain("## Edge Cases");
    expect(result.category).toBe("ops");
  });
});

// ── skillMetricsTracker ─────────────────────────────────────────────────────

describe("skillMetricsTracker", () => {
  it("returns service with expected methods", () => {
    const svc = skillMetricsTracker({} as any);
    expect(typeof svc.recordUsage).toBe("function");
    expect(typeof svc.getSkillMetrics).toBe("function");
    expect(typeof svc.getAgentMetrics).toBe("function");
  });

  it("recordUsage calls upsert (insert + onConflictDoUpdate)", async () => {
    const db = createMockDb();
    const svc = skillMetricsTracker(db as any);
    await svc.recordUsage({
      skillId: "s1", skillVersion: 1, agentId: "a1",
      used: true, successful: true, tokenCount: 500,
    });
    expect(db.insert).toHaveBeenCalled();
    expect(db.values).toHaveBeenCalled();
    expect(db.onConflictDoUpdate).toHaveBeenCalled();
  });
});

// ── skillRetrievalService ───────────────────────────────────────────────────

describe("skillRetrievalService", () => {
  it("returns service with retrieveForTask method", () => {
    const svc = skillRetrievalService({} as any);
    expect(typeof svc.retrieveForTask).toBe("function");
  });

  it("retrieveForTask calls execute with FTS query", async () => {
    const db = createMockDb([]);
    // execute returns empty → fallback path
    db.execute = vi.fn().mockResolvedValue([]);
    db.limit = vi.fn().mockResolvedValue([]);

    const svc = skillRetrievalService(db as any);
    const result = await svc.retrieveForTask({
      taskDescription: "deploy to production",
      agentId: "a1",
      companyId: "c1",
    });
    expect(db.execute).toHaveBeenCalled();
    expect(Array.isArray(result)).toBe(true);
  });
});
