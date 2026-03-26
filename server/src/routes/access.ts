import { Router } from "express";
import type { Db } from "@paperclipai/db";
import type { DeploymentExposure, DeploymentMode } from "@paperclipai/shared";
import { accessAuthRoutes } from "./access-auth.js";
import { accessInvitesRoutes } from "./access-invites.js";
import { accessMembersRoutes } from "./access-members.js";
import { accessSkillsRoutes } from "./access-skills.js";

// Re-export every public symbol so existing imports from "./access.js" keep working.
export {
  companyInviteExpiresAt,
  buildJoinDefaultsPayloadForAccept,
  mergeJoinDefaultsPayloadForReplay,
  canReplayOpenClawGatewayInviteAccept,
  normalizeAgentDefaultsForJoin,
  buildInviteOnboardingTextDocument,
  agentJoinGrantsFromDefaults,
  resolveJoinRequestAgentManagerId
} from "./access-helpers.js";

export function accessRoutes(
  db: Db,
  opts: {
    deploymentMode: DeploymentMode;
    deploymentExposure: DeploymentExposure;
    bindHost: string;
    allowedHostnames: string[];
  }
) {
  const router = Router();

  router.use(accessAuthRoutes(db, opts));
  router.use(accessSkillsRoutes(db, opts));
  router.use(accessInvitesRoutes(db, opts));
  router.use(accessMembersRoutes(db, opts));

  return router;
}
