import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { agents as agentsTable, companies } from "@paperclipai/db";
import { eq } from "drizzle-orm";
import {
  deriveAgentUrlKey,
  resetAgentSessionSchema,
  type InstanceSchedulerHeartbeatAgent,
} from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import {
  agentAccessService,
  issueService,
  logActivity,
} from "../services/index.js";
import { assertBoard, assertCompanyAccess, assertInstanceAdmin } from "./authz.js";
import { redactEventPayload } from "../redaction.js";
import { renderOrgChartSvg, renderOrgChartPng, type OrgNode, type OrgChartStyle, ORG_CHART_STYLES } from "./org-chart-svg.js";
import { agentConfigRoutes } from "./agent-config.js";
import { agentLifecycleRoutes } from "./agent-lifecycle.js";
import { agentHeartbeatRoutes } from "./agent-heartbeats.js";
import {
  createAgentRouteContext,
  normalizeAgentReference,
  actorCanReadConfigurationsForCompany,
  buildAgentDetail,
  redactForRestrictedAgentView,
  toLeanOrgNode,
  parseSchedulerHeartbeatPolicy,
} from "./agent-helpers.js";

export function agentRoutes(db: Db) {
  const ctx = createAgentRouteContext(db);
  const router = Router();

  router.param("id", async (req, _res, next, rawId) => {
    try {
      req.params.id = await normalizeAgentReference(ctx, req, String(rawId));
      next();
    } catch (err) {
      next(err);
    }
  });

  // --- Sub-routers (share the same ctx / param middleware) ---
  router.use(agentConfigRoutes(ctx));
  router.use(agentLifecycleRoutes(ctx));
  router.use(agentHeartbeatRoutes(ctx));

  // --- Agent list & detail ---

  router.get("/companies/:companyId/agents", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    let result = await ctx.svc.list(companyId);

    // Per-agent ACL filtering for non-admin board users
    if (req.actor.type === "board" && !req.actor.isInstanceAdmin && req.actor.userId) {
      const accessSvc = agentAccessService(db);
      const grants = await accessSvc.listByUser(companyId, req.actor.userId);
      if (grants.length > 0) {
        const allowedIds = new Set(grants.map((g) => g.agentId));
        result = result.filter((agent) => allowedIds.has(agent.id));
      }
    }

    const canReadConfigs = await actorCanReadConfigurationsForCompany(ctx, req, companyId);
    if (canReadConfigs || req.actor.type === "board") {
      res.json(result);
      return;
    }
    res.json(result.map((agent) => redactForRestrictedAgentView(agent)));
  });

  router.get("/agents/me", async (req, res) => {
    if (req.actor.type !== "agent" || !req.actor.agentId) {
      res.status(401).json({ error: "Agent authentication required" });
      return;
    }
    const agent = await ctx.svc.getById(req.actor.agentId);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    res.json(await buildAgentDetail(ctx, agent));
  });

  router.get("/agents/me/inbox-lite", async (req, res) => {
    if (req.actor.type !== "agent" || !req.actor.agentId || !req.actor.companyId) {
      res.status(401).json({ error: "Agent authentication required" });
      return;
    }

    const issuesSvc = issueService(db);
    const rows = await issuesSvc.list(req.actor.companyId, {
      assigneeAgentId: req.actor.agentId,
      status: "todo,in_progress,blocked",
    });

    res.json(
      rows.map((issue) => ({
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        status: issue.status,
        priority: issue.priority,
        projectId: issue.projectId,
        goalId: issue.goalId,
        parentId: issue.parentId,
        updatedAt: issue.updatedAt,
        activeRun: issue.activeRun,
      })),
    );
  });

  router.get("/agents/:id", async (req, res) => {
    const id = req.params.id as string;
    const agent = await ctx.svc.getById(id);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    assertCompanyAccess(req, agent.companyId);
    if (req.actor.type === "agent" && req.actor.agentId !== id) {
      const canRead = await actorCanReadConfigurationsForCompany(ctx, req, agent.companyId);
      if (!canRead) {
        res.json(await buildAgentDetail(ctx, agent, { restricted: true }));
        return;
      }
    }
    res.json(await buildAgentDetail(ctx, agent));
  });

  // --- Org chart ---

  router.get("/companies/:companyId/org", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const tree = await ctx.svc.orgForCompany(companyId);
    const leanTree = tree.map((node) => toLeanOrgNode(node as Record<string, unknown>));
    res.json(leanTree);
  });

  router.get("/companies/:companyId/org.svg", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const style = (ORG_CHART_STYLES.includes(req.query.style as OrgChartStyle) ? req.query.style : "warmth") as OrgChartStyle;
    const tree = await ctx.svc.orgForCompany(companyId);
    const leanTree = tree.map((node) => toLeanOrgNode(node as Record<string, unknown>));
    const svg = renderOrgChartSvg(leanTree as unknown as OrgNode[], style);
    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "no-cache");
    res.send(svg);
  });

  router.get("/companies/:companyId/org.png", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const style = (ORG_CHART_STYLES.includes(req.query.style as OrgChartStyle) ? req.query.style : "warmth") as OrgChartStyle;
    const tree = await ctx.svc.orgForCompany(companyId);
    const leanTree = tree.map((node) => toLeanOrgNode(node as Record<string, unknown>));
    const png = await renderOrgChartPng(leanTree as unknown as OrgNode[], style);
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "no-cache");
    res.send(png);
  });

  // --- Instance-level scheduler heartbeats ---

  router.get("/instance/scheduler-heartbeats", async (req, res) => {
    assertInstanceAdmin(req);

    const rows = await db
      .select({
        id: agentsTable.id,
        companyId: agentsTable.companyId,
        agentName: agentsTable.name,
        role: agentsTable.role,
        title: agentsTable.title,
        status: agentsTable.status,
        adapterType: agentsTable.adapterType,
        runtimeConfig: agentsTable.runtimeConfig,
        lastHeartbeatAt: agentsTable.lastHeartbeatAt,
        companyName: companies.name,
        companyIssuePrefix: companies.issuePrefix,
      })
      .from(agentsTable)
      .innerJoin(companies, eq(agentsTable.companyId, companies.id))
      .orderBy(companies.name, agentsTable.name);

    const items: InstanceSchedulerHeartbeatAgent[] = rows
      .map((row) => {
        const policy = parseSchedulerHeartbeatPolicy(row.runtimeConfig);
        const statusEligible =
          row.status !== "paused" &&
          row.status !== "terminated" &&
          row.status !== "pending_approval";

        return {
          id: row.id,
          companyId: row.companyId,
          companyName: row.companyName,
          companyIssuePrefix: row.companyIssuePrefix,
          agentName: row.agentName,
          agentUrlKey: deriveAgentUrlKey(row.agentName, row.id),
          role: row.role as InstanceSchedulerHeartbeatAgent["role"],
          title: row.title,
          status: row.status as InstanceSchedulerHeartbeatAgent["status"],
          adapterType: row.adapterType,
          intervalSec: policy.intervalSec,
          heartbeatEnabled: policy.enabled,
          schedulerActive: statusEligible && policy.enabled && policy.intervalSec > 0,
          lastHeartbeatAt: row.lastHeartbeatAt,
        };
      })
      .filter((item) =>
        item.status !== "paused" &&
        item.status !== "terminated" &&
        item.status !== "pending_approval",
      )
      .sort((left, right) => {
        if (left.schedulerActive !== right.schedulerActive) {
          return left.schedulerActive ? -1 : 1;
        }
        const companyOrder = left.companyName.localeCompare(right.companyName);
        if (companyOrder !== 0) return companyOrder;
        return left.agentName.localeCompare(right.agentName);
      });

    res.json(items);
  });

  // --- Runtime state & task sessions ---

  router.get("/agents/:id/runtime-state", async (req, res) => {
    assertBoard(req);
    const id = req.params.id as string;
    const agent = await ctx.svc.getById(id);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    assertCompanyAccess(req, agent.companyId);

    const state = await ctx.heartbeat.getRuntimeState(id);
    res.json(state);
  });

  router.get("/agents/:id/task-sessions", async (req, res) => {
    assertBoard(req);
    const id = req.params.id as string;
    const agent = await ctx.svc.getById(id);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    assertCompanyAccess(req, agent.companyId);

    const sessions = await ctx.heartbeat.listTaskSessions(id);
    res.json(
      sessions.map((session) => ({
        ...session,
        sessionParamsJson: redactEventPayload(session.sessionParamsJson ?? null),
      })),
    );
  });

  router.post("/agents/:id/runtime-state/reset-session", validate(resetAgentSessionSchema), async (req, res) => {
    assertBoard(req);
    const id = req.params.id as string;
    const agent = await ctx.svc.getById(id);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    assertCompanyAccess(req, agent.companyId);

    const taskKey =
      typeof req.body.taskKey === "string" && req.body.taskKey.trim().length > 0
        ? req.body.taskKey.trim()
        : null;
    const state = await ctx.heartbeat.resetRuntimeSession(id, { taskKey });

    await logActivity(db, {
      companyId: agent.companyId,
      actorType: "user",
      actorId: req.actor.userId ?? "board",
      action: "agent.runtime_session_reset",
      entityType: "agent",
      entityId: id,
      details: { taskKey: taskKey ?? null },
    });

    res.json(state);
  });

  return router;
}
