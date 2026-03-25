import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock @paperclipai/db to prevent postgres client from being loaded in unit tests
vi.mock("@paperclipai/db", () => ({
  skills: { companyId: "companyId", id: "id", createdAt: "createdAt" },
  skillAgentAccess: { skillId: "skillId", agentId: "agentId", createdAt: "createdAt" },
  mcpServerConfigs: { companyId: "companyId", id: "id", createdAt: "createdAt" },
  mcpAgentAccess: { mcpServerId: "mcpServerId", agentId: "agentId", createdAt: "createdAt" },
  mcpCatalog: { id: "id", popularity: "popularity" },
  connectors: { companyId: "companyId", id: "id", createdAt: "createdAt" },
  plugins: { companyId: "companyId", id: "id", createdAt: "createdAt" },
  pluginAgentAccess: { pluginId: "pluginId", agentId: "agentId", createdAt: "createdAt" },
}));

import { toSlug } from "../utils/slug.js";
import { skillsService } from "../services/skills.js";
import { mcpServersService } from "../services/mcp-servers.js";
import { connectorsService } from "../services/connectors.js";
import { pluginsService } from "../services/plugins.js";

// ── toSlug ──────────────────────────────────────────────────────────────────────

describe("toSlug", () => {
  it("converts name to lowercase slug", () => {
    expect(toSlug("My Skill")).toBe("my-skill");
  });

  it("replaces spaces and special chars with hyphens", () => {
    expect(toSlug("Hello World! @#$")).toBe("hello-world");
  });

  it("trims leading/trailing hyphens", () => {
    expect(toSlug("  --test-- ")).toBe("test");
  });

  it("collapses multiple hyphens", () => {
    expect(toSlug("a   b---c")).toBe("a-b-c");
  });

  it("handles single word", () => {
    expect(toSlug("simple")).toBe("simple");
  });

  it("handles empty string", () => {
    expect(toSlug("")).toBe("");
  });
});

// ── Helper: chainable mock DB ───────────────────────────────────────────────────

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
  // Terminal methods that resolve
  mockDb.limit = vi.fn().mockResolvedValue(resolveValue);
  mockDb.returning = vi.fn().mockResolvedValue(resolveValue);
  // orderBy without limit is terminal for some queries (listAccess, listCatalog)
  mockDb.orderBy = vi.fn().mockImplementation(() => {
    // Return self so .limit() can chain, but also act as a thenable
    const result = Object.create(mockDb);
    result.then = (resolve: any) => Promise.resolve(resolveValue).then(resolve);
    result.catch = (reject: any) => Promise.resolve(resolveValue).catch(reject);
    return result;
  });
  // where without limit is terminal for delete/update chains
  mockDb.where = vi.fn().mockImplementation(() => {
    const result = Object.create(mockDb);
    result.then = (resolve: any) => Promise.resolve(resolveValue).then(resolve);
    result.catch = (reject: any) => Promise.resolve(resolveValue).catch(reject);
    return result;
  });
  // transaction passes the mock as tx
  mockDb.transaction = vi.fn(async (cb: any) => cb(mockDb));

  return mockDb;
}

// ── skillsService ───────────────────────────────────────────────────────────────

describe("skillsService", () => {
  it("returns service object with expected methods", () => {
    const svc = skillsService({} as any);
    expect(typeof svc.list).toBe("function");
    expect(typeof svc.get).toBe("function");
    expect(typeof svc.create).toBe("function");
    expect(typeof svc.update).toBe("function");
    expect(typeof svc.remove).toBe("function");
    expect(typeof svc.listAccess).toBe("function");
    expect(typeof svc.updateAccess).toBe("function");
    expect(typeof svc.bulkUpdateAccess).toBe("function");
  });

  it("list() chains select -> from -> where -> orderBy -> limit", async () => {
    const db = createMockDb([{ id: "s1", name: "Skill A" }]);
    const svc = skillsService(db as any);
    const result = await svc.list("company-1");
    expect(db.select).toHaveBeenCalled();
    expect(db.from).toHaveBeenCalled();
    expect(result).toEqual([{ id: "s1", name: "Skill A" }]);
  });

  it("create() calls insert -> values -> returning", async () => {
    const created = { id: "new-id", name: "New Skill", slug: "new-skill" };
    const db = createMockDb([created]);
    const svc = skillsService(db as any);
    const result = await svc.create({ companyId: "c1", name: "New Skill" });
    expect(db.insert).toHaveBeenCalled();
    expect(db.values).toHaveBeenCalled();
    expect(db.returning).toHaveBeenCalled();
    expect(result).toEqual(created);
  });

  it("update() calls update -> set -> where -> returning", async () => {
    const updated = { id: "s1", name: "Updated", slug: "updated" };
    const db = createMockDb([updated]);
    const svc = skillsService(db as any);
    const result = await svc.update("s1", { name: "Updated" });
    expect(db.update).toHaveBeenCalled();
    expect(db.set).toHaveBeenCalled();
    expect(result).toEqual(updated);
  });

  it("remove() calls delete -> where", async () => {
    const db = createMockDb();
    const svc = skillsService(db as any);
    await svc.remove("s1");
    expect(db.delete).toHaveBeenCalled();
  });

  it("bulkUpdateAccess() uses transaction", async () => {
    const db = createMockDb();
    const svc = skillsService(db as any);
    await svc.bulkUpdateAccess("s1", [
      { agentId: "a1", granted: true },
      { agentId: "a2", granted: false },
    ]);
    expect(db.transaction).toHaveBeenCalled();
    // insert called once per grant inside the transaction
    expect(db.insert).toHaveBeenCalledTimes(2);
  });
});

// ── mcpServersService ───────────────────────────────────────────────────────────

describe("mcpServersService", () => {
  it("returns service object with expected methods", () => {
    const svc = mcpServersService({} as any);
    expect(typeof svc.list).toBe("function");
    expect(typeof svc.get).toBe("function");
    expect(typeof svc.create).toBe("function");
    expect(typeof svc.update).toBe("function");
    expect(typeof svc.remove).toBe("function");
    expect(typeof svc.toggleEnabled).toBe("function");
    expect(typeof svc.updateHealth).toBe("function");
    expect(typeof svc.listAccess).toBe("function");
    expect(typeof svc.updateAccess).toBe("function");
    expect(typeof svc.bulkUpdateAccess).toBe("function");
    expect(typeof svc.listCatalog).toBe("function");
    expect(typeof svc.installFromCatalog).toBe("function");
  });

  it("listCatalog() calls select -> from -> orderBy", async () => {
    const catalog = [{ id: "c1", name: "GitHub" }];
    const db = createMockDb(catalog);
    const svc = mcpServersService(db as any);
    const result = await svc.listCatalog();
    expect(db.select).toHaveBeenCalled();
    expect(db.from).toHaveBeenCalled();
    expect(result).toEqual(catalog);
  });

  it("toggleEnabled() calls update -> set -> where", async () => {
    const db = createMockDb();
    const svc = mcpServersService(db as any);
    await svc.toggleEnabled("srv-1", false);
    expect(db.update).toHaveBeenCalled();
    expect(db.set).toHaveBeenCalled();
  });

  it("updateHealth() calls update -> set -> where", async () => {
    const db = createMockDb();
    const svc = mcpServersService(db as any);
    await svc.updateHealth("srv-1", "healthy");
    expect(db.update).toHaveBeenCalled();
    expect(db.set).toHaveBeenCalled();
  });

  it("installFromCatalog() throws when catalog entry not found", async () => {
    const db = createMockDb([]);
    // Override limit to return empty for the catalog lookup
    db.limit = vi.fn().mockResolvedValue([]);
    const svc = mcpServersService(db as any);
    await expect(svc.installFromCatalog("c1", "missing-id", {})).rejects.toThrow(
      "Catalog entry not found: missing-id",
    );
  });

  it("installFromCatalog() creates server from catalog entry", async () => {
    const catalogEntry = {
      id: "cat-1",
      name: "GitHub MCP",
      transport: "stdio",
      defaultCommand: "npx",
      defaultArgs: ["@github/mcp"],
    };
    const installedServer = { id: "srv-new", name: "GitHub MCP", slug: "github-mcp" };

    const db = createMockDb([]);
    // First limit call returns catalog entry, returning call returns installed server
    let limitCallCount = 0;
    db.limit = vi.fn().mockImplementation(() => {
      limitCallCount++;
      return Promise.resolve(limitCallCount === 1 ? [catalogEntry] : []);
    });
    db.returning = vi.fn().mockResolvedValue([installedServer]);

    const svc = mcpServersService(db as any);
    const result = await svc.installFromCatalog("c1", "cat-1", { GITHUB_TOKEN: "tok" });
    expect(result).toEqual(installedServer);
    expect(db.insert).toHaveBeenCalled();
  });
});

// ── connectorsService ───────────────────────────────────────────────────────────

describe("connectorsService", () => {
  it("returns service object with expected methods", () => {
    const svc = connectorsService({} as any);
    expect(typeof svc.list).toBe("function");
    expect(typeof svc.get).toBe("function");
    expect(typeof svc.create).toBe("function");
    expect(typeof svc.updateStatus).toBe("function");
    expect(typeof svc.remove).toBe("function");
    expect(typeof svc.disconnect).toBe("function");
  });

  it("disconnect() calls update -> set -> where with revoked status", async () => {
    const db = createMockDb();
    const svc = connectorsService(db as any);
    await svc.disconnect("conn-1");
    expect(db.update).toHaveBeenCalled();
    expect(db.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "revoked", oauthTokenEncrypted: null }),
    );
  });

  it("updateStatus() sets status and optional tokens", async () => {
    const db = createMockDb();
    const svc = connectorsService(db as any);
    await svc.updateStatus("conn-1", "connected", {
      encrypted: "enc-token",
      refreshEncrypted: "enc-refresh",
    });
    expect(db.update).toHaveBeenCalled();
    expect(db.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "connected",
        oauthTokenEncrypted: "enc-token",
        oauthRefreshTokenEncrypted: "enc-refresh",
      }),
    );
  });

  it("create() calls insert -> values -> returning", async () => {
    const created = { id: "conn-new", name: "Slack", slug: "slack" };
    const db = createMockDb([created]);
    const svc = connectorsService(db as any);
    const result = await svc.create({ companyId: "c1", name: "Slack", provider: "slack" });
    expect(db.insert).toHaveBeenCalled();
    expect(result).toEqual(created);
  });
});

// ── pluginsService ──────────────────────────────────────────────────────────────

describe("pluginsService", () => {
  it("returns service object with expected methods", () => {
    const svc = pluginsService({} as any);
    expect(typeof svc.list).toBe("function");
    expect(typeof svc.get).toBe("function");
    expect(typeof svc.create).toBe("function");
    expect(typeof svc.update).toBe("function");
    expect(typeof svc.remove).toBe("function");
    expect(typeof svc.toggleEnabled).toBe("function");
    expect(typeof svc.updateHealth).toBe("function");
    expect(typeof svc.listAccess).toBe("function");
    expect(typeof svc.updateAccess).toBe("function");
    expect(typeof svc.bulkUpdateAccess).toBe("function");
  });

  it("updateHealth() sets status, tools, and toolCount", async () => {
    const db = createMockDb();
    const tools = [{ name: "read_file", description: "Reads a file" }];
    const svc = pluginsService(db as any);
    await svc.updateHealth("p1", "healthy", tools);
    expect(db.update).toHaveBeenCalled();
    expect(db.set).toHaveBeenCalledWith(
      expect.objectContaining({
        healthStatus: "healthy",
        tools,
        toolCount: 1,
      }),
    );
  });

  it("updateHealth() without tools does not set tools/toolCount", async () => {
    const db = createMockDb();
    const svc = pluginsService(db as any);
    await svc.updateHealth("p1", "unhealthy");
    expect(db.set).toHaveBeenCalledWith(
      expect.not.objectContaining({ tools: expect.anything() }),
    );
  });

  it("toggleEnabled() calls update -> set -> where", async () => {
    const db = createMockDb();
    const svc = pluginsService(db as any);
    await svc.toggleEnabled("p1", true);
    expect(db.update).toHaveBeenCalled();
    expect(db.set).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true }),
    );
  });

  it("bulkUpdateAccess() uses transaction with one insert per grant", async () => {
    const db = createMockDb();
    const svc = pluginsService(db as any);
    await svc.bulkUpdateAccess("p1", [
      { agentId: "a1", granted: true },
      { agentId: "a2", granted: false },
      { agentId: "a3", granted: true },
    ]);
    expect(db.transaction).toHaveBeenCalled();
    expect(db.insert).toHaveBeenCalledTimes(3);
  });
});
