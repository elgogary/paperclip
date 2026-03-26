import { describe, expect, it, vi } from "vitest";

vi.mock("@paperclipai/db", () => {
  const fake = () => fake;
  Object.assign(fake, {
    select: fake,
    from: fake,
    where: fake,
    orderBy: fake,
    limit: fake,
    update: fake,
    set: fake,
    insert: fake,
    values: fake,
    returning: fake,
    onConflictDoUpdate: fake,
    onConflictDoNothing: fake,
    then: (resolve: (v: unknown) => unknown) => resolve([]),
    [Symbol.toPrimitive]: () => "",
  });

  const col = (name: string) => ({ name, $inferSelect: {}, $inferInsert: {} });
  return {
    agents: col("agents"),
    agentRuntimeState: col("agentRuntimeState"),
    agentTaskSessions: col("agentTaskSessions"),
    heartbeatRuns: col("heartbeatRuns"),
    heartbeatRunEvents: col("heartbeatRunEvents"),
    companies: col("companies"),
    companySkills: col("companySkills"),
    companySecrets: col("companySecrets"),
    issues: col("issues"),
    issueComments: col("issueComments"),
    projects: col("projects"),
    workspaces: col("workspaces"),
    workspaceOperations: col("workspaceOperations"),
    budgets: col("budgets"),
    budgetLedger: col("budgetLedger"),
    instanceSettings: col("instanceSettings"),
    agentBudgets: col("agentBudgets"),
  };
});

vi.mock("../services/run-log-store.js", () => ({
  getRunLogStore: () => ({ read: vi.fn(), append: vi.fn(), create: vi.fn() }),
}));

vi.mock("../services/company-skills.js", () => ({
  companySkillService: () => ({ list: vi.fn(), get: vi.fn() }),
}));

vi.mock("../services/budgets.js", () => ({
  budgetService: () => ({ check: vi.fn(), record: vi.fn() }),
}));

vi.mock("../services/secrets.js", () => ({
  secretService: () => ({ get: vi.fn(), list: vi.fn() }),
}));

vi.mock("../services/issues.js", () => ({
  issueService: () => ({ get: vi.fn(), list: vi.fn() }),
}));

vi.mock("../services/execution-workspaces.js", () => ({
  executionWorkspaceService: () => ({ resolve: vi.fn() }),
}));

vi.mock("../services/workspace-operations.js", () => ({
  workspaceOperationService: () => ({ execute: vi.fn() }),
}));

vi.mock("../services/instance-settings.js", () => ({
  instanceSettingsService: () => ({
    getGeneral: async () => ({ censorUsernameInLogs: false }),
  }),
}));

vi.mock("../log-redaction.js", () => ({
  redactCurrentUserText: (text: string) => text,
}));

import { heartbeatService } from "../services/heartbeat.js";

const EXPECTED_METHODS = [
  "list",
  "getRun",
  "getRuntimeState",
  "listTaskSessions",
  "resetRuntimeSession",
  "listEvents",
  "readLog",
  "invoke",
  "wakeup",
  "reportRunActivity",
  "reapOrphanedRuns",
  "resumeQueuedRuns",
  "tickTimers",
  "cancelRun",
  "cancelActiveForAgent",
  "cancelBudgetScopeWork",
  "getActiveRunForAgent",
] as const;

describe("heartbeatService wiring smoke test", () => {
  const fakeDb = new Proxy(
    {},
    {
      get(_target, _prop) {
        const chain = (): unknown =>
          new Proxy(Object.assign(chain, { then: (r: (v: unknown) => unknown) => r([]) }), {
            get(t, p) {
              if (p === "then") return t.then;
              return chain();
            },
          });
        return chain();
      },
    },
  );

  const svc = heartbeatService(fakeDb as any);

  for (const method of EXPECTED_METHODS) {
    it(`exposes "${method}" as a function`, () => {
      expect(svc[method]).toBeDefined();
      expect(typeof svc[method]).toBe("function");
    });
  }

  it("getActiveRunForAgent does not throw TypeError", async () => {
    const result = await svc.getActiveRunForAgent("agent-nonexistent");
    expect(result).toBeNull();
  });

  it("list does not throw TypeError", async () => {
    const result = await svc.list("company-1");
    expect(Array.isArray(result)).toBe(true);
  });
});
