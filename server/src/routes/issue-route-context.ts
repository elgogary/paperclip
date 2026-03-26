import type { Request, Response } from "express";
import type { Db } from "@paperclipai/db";
import type { StorageService } from "../storage/types.js";
import {
  accessService,
  agentService,
  executionWorkspaceService,
  goalService,
  heartbeatService,
  issueApprovalService,
  issueService,
  documentService,
  logActivity,
  projectService,
  routineService,
  workProductService,
} from "../services/index.js";
import { getActorInfo } from "./authz.js";

/** Bag of pre-built services shared across issue sub-routers. */
export interface IssueRouteServices {
  db: Db;
  storage: StorageService;
  svc: ReturnType<typeof issueService>;
  access: ReturnType<typeof accessService>;
  heartbeat: ReturnType<typeof heartbeatService>;
  agentsSvc: ReturnType<typeof agentService>;
  projectsSvc: ReturnType<typeof projectService>;
  goalsSvc: ReturnType<typeof goalService>;
  issueApprovalsSvc: ReturnType<typeof issueApprovalService>;
  executionWorkspacesSvc: ReturnType<typeof executionWorkspaceService>;
  workProductsSvc: ReturnType<typeof workProductService>;
  documentsSvc: ReturnType<typeof documentService>;
  routinesSvc: ReturnType<typeof routineService>;
  logActivity: (params: Parameters<typeof logActivity>[1]) => Promise<void>;
}

export function buildIssueRouteServices(db: Db, storage: StorageService): IssueRouteServices {
  return {
    db,
    storage,
    svc: issueService(db),
    access: accessService(db),
    heartbeat: heartbeatService(db),
    agentsSvc: agentService(db),
    projectsSvc: projectService(db),
    goalsSvc: goalService(db),
    issueApprovalsSvc: issueApprovalService(db),
    executionWorkspacesSvc: executionWorkspaceService(db),
    workProductsSvc: workProductService(db),
    documentsSvc: documentService(db),
    routinesSvc: routineService(db),
    logActivity: (params: Parameters<typeof logActivity>[1]) => logActivity(db, params),
  };
}

export async function normalizeIssueIdentifier(
  svc: IssueRouteServices["svc"],
  rawId: string,
): Promise<string> {
  if (/^[A-Z]+-\d+$/i.test(rawId)) {
    const issue = await svc.getByIdentifier(rawId);
    if (issue) return issue.id;
  }
  return rawId;
}

export async function resolveIssueProjectAndGoal(
  services: Pick<IssueRouteServices, "projectsSvc" | "goalsSvc">,
  issue: { companyId: string; projectId: string | null; goalId: string | null },
): Promise<{
  project: Awaited<ReturnType<IssueRouteServices["projectsSvc"]["getById"]>>;
  goal: Awaited<ReturnType<IssueRouteServices["goalsSvc"]["getById"]>> | null;
}> {
  const { projectsSvc, goalsSvc } = services;
  const projectPromise = issue.projectId ? projectsSvc.getById(issue.projectId) : Promise.resolve(null);
  const directGoalPromise = issue.goalId ? goalsSvc.getById(issue.goalId) : Promise.resolve(null);
  const [project, directGoal] = await Promise.all([projectPromise, directGoalPromise]);

  if (directGoal) {
    return { project, goal: directGoal };
  }

  const projectGoalId = project?.goalId ?? project?.goalIds[0] ?? null;
  if (projectGoalId) {
    const projectGoal = await goalsSvc.getById(projectGoalId);
    return { project, goal: projectGoal };
  }

  if (!issue.projectId) {
    const defaultGoal = await goalsSvc.getDefaultCompanyGoal(issue.companyId);
    return { project, goal: defaultGoal };
  }

  return { project, goal: null };
}

export function requireAgentRunId(req: Request, res: Response) {
  if (req.actor.type !== "agent") return null;
  const runId = req.actor.runId?.trim();
  if (runId) return runId;
  res.status(401).json({ error: "Agent run id required" });
  return null;
}

export async function assertAgentRunCheckoutOwnership(
  services: Pick<IssueRouteServices, "svc" | "logActivity">,
  req: Request,
  res: Response,
  issue: { id: string; companyId: string; status: string; assigneeAgentId: string | null },
) {
  if (req.actor.type !== "agent") return true;
  const actorAgentId = req.actor.agentId;
  if (!actorAgentId) {
    res.status(403).json({ error: "Agent authentication required" });
    return false;
  }
  if (issue.status !== "in_progress" || issue.assigneeAgentId !== actorAgentId) {
    return true;
  }
  const runId = requireAgentRunId(req, res);
  if (!runId) return false;
  const ownership = await services.svc.assertCheckoutOwner(issue.id, actorAgentId, runId);
  if (ownership.adoptedFromRunId) {
    const actor = getActorInfo(req);
    await services.logActivity({
      companyId: issue.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "issue.checkout_lock_adopted",
      entityType: "issue",
      entityId: issue.id,
      details: {
        previousCheckoutRunId: ownership.adoptedFromRunId,
        checkoutRunId: runId,
        reason: "stale_checkout_run",
      },
    });
  }
  return true;
}
