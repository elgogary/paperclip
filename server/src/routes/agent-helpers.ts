import { generateKeyPairSync } from "node:crypto";
import path from "node:path";
import type { Db } from "@paperclipai/db";
import {
  isUuidLike,
  type AgentSkillSnapshot,
} from "@paperclipai/shared";
import {
  readPaperclipSkillSyncPreference,
  writePaperclipSkillSyncPreference,
} from "@paperclipai/adapter-utils/server-utils";
import type { Request } from "express";
import type { Router } from "express";
import {
  agentService,
  agentInstructionsService,
  accessService,
  approvalService,
  budgetService,
  companySkillService,
  heartbeatService,
  issueApprovalService,
  secretService,
  workspaceOperationService,
} from "../services/index.js";
import { conflict, forbidden, notFound, unprocessable } from "../errors.js";
import { assertCompanyAccess } from "./authz.js";
import { redactEventPayload } from "../redaction.js";
import { instanceSettingsService } from "../services/instance-settings.js";
import {
  DEFAULT_CODEX_LOCAL_BYPASS_APPROVALS_AND_SANDBOX,
  DEFAULT_CODEX_LOCAL_MODEL,
} from "@paperclipai/adapter-codex-local";
import { DEFAULT_CURSOR_LOCAL_MODEL } from "@paperclipai/adapter-cursor-local";
import { DEFAULT_GEMINI_LOCAL_MODEL } from "@paperclipai/adapter-gemini-local";
import { ensureOpenCodeModelConfiguredAndAvailable } from "@paperclipai/adapter-opencode-local/server";
import {
  loadDefaultAgentInstructionsBundle,
  resolveDefaultAgentInstructionsBundleRole,
} from "../services/default-agent-instructions.js";

export const DEFAULT_INSTRUCTIONS_PATH_KEYS: Record<string, string> = {
  claude_local: "instructionsFilePath",
  codex_local: "instructionsFilePath",
  gemini_local: "instructionsFilePath",
  opencode_local: "instructionsFilePath",
  cursor: "instructionsFilePath",
  pi_local: "instructionsFilePath",
};
export const DEFAULT_MANAGED_INSTRUCTIONS_ADAPTER_TYPES = new Set(Object.keys(DEFAULT_INSTRUCTIONS_PATH_KEYS));
export const KNOWN_INSTRUCTIONS_PATH_KEYS = new Set(["instructionsFilePath", "agentsMdPath"]);
export const KNOWN_INSTRUCTIONS_BUNDLE_KEYS = [
  "instructionsBundleMode",
  "instructionsRootPath",
  "instructionsEntryFile",
  "instructionsFilePath",
  "agentsMdPath",
] as const;

export interface AgentRouteContext {
  db: Db;
  svc: ReturnType<typeof agentService>;
  access: ReturnType<typeof accessService>;
  approvalsSvc: ReturnType<typeof approvalService>;
  budgets: ReturnType<typeof budgetService>;
  heartbeat: ReturnType<typeof heartbeatService>;
  issueApprovalsSvc: ReturnType<typeof issueApprovalService>;
  secretsSvc: ReturnType<typeof secretService>;
  instructions: ReturnType<typeof agentInstructionsService>;
  companySkills: ReturnType<typeof companySkillService>;
  workspaceOperations: ReturnType<typeof workspaceOperationService>;
  instanceSettings: ReturnType<typeof instanceSettingsService>;
  strictSecretsMode: boolean;
}

export function createAgentRouteContext(db: Db): AgentRouteContext {
  return {
    db,
    svc: agentService(db),
    access: accessService(db),
    approvalsSvc: approvalService(db),
    budgets: budgetService(db),
    heartbeat: heartbeatService(db),
    issueApprovalsSvc: issueApprovalService(db),
    secretsSvc: secretService(db),
    instructions: agentInstructionsService(),
    companySkills: companySkillService(db),
    workspaceOperations: workspaceOperationService(db),
    instanceSettings: instanceSettingsService(db),
    strictSecretsMode: process.env.PAPERCLIP_SECRETS_STRICT_MODE === "true",
  };
}

export async function getCurrentUserRedactionOptions(ctx: AgentRouteContext) {
  return {
    enabled: (await ctx.instanceSettings.getGeneral()).censorUsernameInLogs,
  };
}

export function canCreateAgents(agent: { role: string; permissions: Record<string, unknown> | null | undefined }) {
  if (!agent.permissions || typeof agent.permissions !== "object") return false;
  return Boolean((agent.permissions as Record<string, unknown>).canCreateAgents);
}

export async function buildAgentAccessState(
  ctx: AgentRouteContext,
  agent: NonNullable<Awaited<ReturnType<AgentRouteContext["svc"]["getById"]>>>,
) {
  const membership = await ctx.access.getMembership(agent.companyId, "agent", agent.id);
  const grants = membership
    ? await ctx.access.listPrincipalGrants(agent.companyId, "agent", agent.id)
    : [];
  const hasExplicitTaskAssignGrant = grants.some((grant) => grant.permissionKey === "tasks:assign");

  if (agent.role === "ceo") {
    return {
      canAssignTasks: true,
      taskAssignSource: "ceo_role" as const,
      membership,
      grants,
    };
  }

  if (canCreateAgents(agent)) {
    return {
      canAssignTasks: true,
      taskAssignSource: "agent_creator" as const,
      membership,
      grants,
    };
  }

  if (hasExplicitTaskAssignGrant) {
    return {
      canAssignTasks: true,
      taskAssignSource: "explicit_grant" as const,
      membership,
      grants,
    };
  }

  return {
    canAssignTasks: false,
    taskAssignSource: "none" as const,
    membership,
    grants,
  };
}

export async function buildAgentDetail(
  ctx: AgentRouteContext,
  agent: NonNullable<Awaited<ReturnType<AgentRouteContext["svc"]["getById"]>>>,
  options?: { restricted?: boolean },
) {
  const [chainOfCommand, accessState] = await Promise.all([
    ctx.svc.getChainOfCommand(agent.id),
    buildAgentAccessState(ctx, agent),
  ]);

  return {
    ...(options?.restricted ? redactForRestrictedAgentView(agent) : agent),
    chainOfCommand,
    access: accessState,
  };
}

export async function applyDefaultAgentTaskAssignGrant(
  ctx: AgentRouteContext,
  companyId: string,
  agentId: string,
  grantedByUserId: string | null,
) {
  await ctx.access.ensureMembership(companyId, "agent", agentId, "member", "active");
  await ctx.access.setPrincipalPermission(
    companyId,
    "agent",
    agentId,
    "tasks:assign",
    true,
    grantedByUserId,
  );
}

export async function assertCanCreateAgentsForCompany(ctx: AgentRouteContext, req: Request, companyId: string) {
  assertCompanyAccess(req, companyId);
  if (req.actor.type === "board") {
    if (req.actor.source === "local_implicit" || req.actor.isInstanceAdmin) return null;
    const allowed = await ctx.access.canUser(companyId, req.actor.userId, "agents:create");
    if (!allowed) {
      throw forbidden("Missing permission: agents:create");
    }
    return null;
  }
  if (!req.actor.agentId) throw forbidden("Agent authentication required");
  const actorAgent = await ctx.svc.getById(req.actor.agentId);
  if (!actorAgent || actorAgent.companyId !== companyId) {
    throw forbidden("Agent key cannot access another company");
  }
  const allowedByGrant = await ctx.access.hasPermission(companyId, "agent", actorAgent.id, "agents:create");
  if (!allowedByGrant && !canCreateAgents(actorAgent)) {
    throw forbidden("Missing permission: can create agents");
  }
  return actorAgent;
}

export async function assertCanReadConfigurations(ctx: AgentRouteContext, req: Request, companyId: string) {
  return assertCanCreateAgentsForCompany(ctx, req, companyId);
}

export async function actorCanReadConfigurationsForCompany(ctx: AgentRouteContext, req: Request, companyId: string) {
  assertCompanyAccess(req, companyId);
  if (req.actor.type === "board") {
    if (req.actor.source === "local_implicit" || req.actor.isInstanceAdmin) return true;
    return ctx.access.canUser(companyId, req.actor.userId, "agents:create");
  }
  if (!req.actor.agentId) return false;
  const actorAgent = await ctx.svc.getById(req.actor.agentId);
  if (!actorAgent || actorAgent.companyId !== companyId) return false;
  const allowedByGrant = await ctx.access.hasPermission(companyId, "agent", actorAgent.id, "agents:create");
  return allowedByGrant || canCreateAgents(actorAgent);
}

export async function assertCanUpdateAgent(ctx: AgentRouteContext, req: Request, targetAgent: { id: string; companyId: string }) {
  assertCompanyAccess(req, targetAgent.companyId);
  if (req.actor.type === "board") return;
  if (!req.actor.agentId) throw forbidden("Agent authentication required");

  const actorAgent = await ctx.svc.getById(req.actor.agentId);
  if (!actorAgent || actorAgent.companyId !== targetAgent.companyId) {
    throw forbidden("Agent key cannot access another company");
  }

  if (actorAgent.id === targetAgent.id) return;
  if (actorAgent.role === "ceo") return;
  const allowedByGrant = await ctx.access.hasPermission(
    targetAgent.companyId,
    "agent",
    actorAgent.id,
    "agents:create",
  );
  if (allowedByGrant || canCreateAgents(actorAgent)) return;
  throw forbidden("Only CEO or agent creators can modify other agents");
}

export async function assertCanReadAgent(req: Request, ctx: AgentRouteContext, targetAgent: { companyId: string }) {
  assertCompanyAccess(req, targetAgent.companyId);
  if (req.actor.type === "board") return;
  if (!req.actor.agentId) throw forbidden("Agent authentication required");

  const actorAgent = await ctx.svc.getById(req.actor.agentId);
  if (!actorAgent || actorAgent.companyId !== targetAgent.companyId) {
    throw forbidden("Agent key cannot access another company");
  }
}

export async function assertCanManageInstructionsPath(ctx: AgentRouteContext, req: Request, targetAgent: { id: string; companyId: string }) {
  assertCompanyAccess(req, targetAgent.companyId);
  if (req.actor.type === "board") return;
  if (!req.actor.agentId) throw forbidden("Agent authentication required");

  const actorAgent = await ctx.svc.getById(req.actor.agentId);
  if (!actorAgent || actorAgent.companyId !== targetAgent.companyId) {
    throw forbidden("Agent key cannot access another company");
  }
  if (actorAgent.id === targetAgent.id) return;

  const chainOfCommand = await ctx.svc.getChainOfCommand(targetAgent.id);
  if (chainOfCommand.some((manager) => manager.id === actorAgent.id)) return;

  throw forbidden("Only the target agent or an ancestor manager can update instructions path");
}

export async function resolveCompanyIdForAgentReference(ctx: AgentRouteContext, req: Request): Promise<string | null> {
  const companyIdQuery = req.query.companyId;
  const requestedCompanyId =
    typeof companyIdQuery === "string" && companyIdQuery.trim().length > 0
      ? companyIdQuery.trim()
      : null;
  if (requestedCompanyId) {
    assertCompanyAccess(req, requestedCompanyId);
    return requestedCompanyId;
  }
  if (req.actor.type === "agent" && req.actor.companyId) {
    return req.actor.companyId;
  }
  return null;
}

export async function normalizeAgentReference(ctx: AgentRouteContext, req: Request, rawId: string): Promise<string> {
  const raw = rawId.trim();
  if (isUuidLike(raw)) return raw;

  const companyId = await resolveCompanyIdForAgentReference(ctx, req);
  if (!companyId) {
    throw unprocessable("Agent shortname lookup requires companyId query parameter");
  }

  const resolved = await ctx.svc.resolveByReference(companyId, raw);
  if (resolved.ambiguous) {
    throw conflict("Agent shortname is ambiguous in this company. Use the agent ID.");
  }
  if (!resolved.agent) {
    throw notFound("Agent not found");
  }
  return resolved.agent.id;
}

export function parseSourceIssueIds(input: {
  sourceIssueId?: string | null;
  sourceIssueIds?: string[];
}): string[] {
  const values: string[] = [];
  if (Array.isArray(input.sourceIssueIds)) values.push(...input.sourceIssueIds);
  if (typeof input.sourceIssueId === "string" && input.sourceIssueId.length > 0) {
    values.push(input.sourceIssueId);
  }
  return Array.from(new Set(values));
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function preserveInstructionsBundleConfig(
  existingAdapterConfig: Record<string, unknown>,
  nextAdapterConfig: Record<string, unknown>,
) {
  const nextKeys = new Set(Object.keys(nextAdapterConfig));
  if (KNOWN_INSTRUCTIONS_BUNDLE_KEYS.some((key) => nextKeys.has(key))) {
    return nextAdapterConfig;
  }

  const merged = { ...nextAdapterConfig };
  for (const key of KNOWN_INSTRUCTIONS_BUNDLE_KEYS) {
    if (merged[key] === undefined && existingAdapterConfig[key] !== undefined) {
      merged[key] = existingAdapterConfig[key];
    }
  }
  return merged;
}

export function parseBooleanLike(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
    return null;
  }
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "no" || normalized === "off") {
    return false;
  }
  return null;
}

export function parseNumberLike(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseSchedulerHeartbeatPolicy(runtimeConfig: unknown) {
  const heartbeat = asRecord(asRecord(runtimeConfig)?.heartbeat) ?? {};
  return {
    enabled: parseBooleanLike(heartbeat.enabled) ?? true,
    intervalSec: Math.max(0, parseNumberLike(heartbeat.intervalSec) ?? 0),
  };
}

export function generateEd25519PrivateKeyPem(): string {
  const { privateKey } = generateKeyPairSync("ed25519");
  return privateKey.export({ type: "pkcs8", format: "pem" }).toString();
}

export function ensureGatewayDeviceKey(
  adapterType: string | null | undefined,
  adapterConfig: Record<string, unknown>,
): Record<string, unknown> {
  if (adapterType !== "openclaw_gateway") return adapterConfig;
  const disableDeviceAuth = parseBooleanLike(adapterConfig.disableDeviceAuth) === true;
  if (disableDeviceAuth) return adapterConfig;
  if (asNonEmptyString(adapterConfig.devicePrivateKeyPem)) return adapterConfig;
  return { ...adapterConfig, devicePrivateKeyPem: generateEd25519PrivateKeyPem() };
}

export function applyCreateDefaultsByAdapterType(
  adapterType: string | null | undefined,
  adapterConfig: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...adapterConfig };
  if (adapterType === "codex_local") {
    if (!asNonEmptyString(next.model)) {
      next.model = DEFAULT_CODEX_LOCAL_MODEL;
    }
    const hasBypassFlag =
      typeof next.dangerouslyBypassApprovalsAndSandbox === "boolean" ||
      typeof next.dangerouslyBypassSandbox === "boolean";
    if (!hasBypassFlag) {
      next.dangerouslyBypassApprovalsAndSandbox = DEFAULT_CODEX_LOCAL_BYPASS_APPROVALS_AND_SANDBOX;
    }
    return ensureGatewayDeviceKey(adapterType, next);
  }
  if (adapterType === "gemini_local" && !asNonEmptyString(next.model)) {
    next.model = DEFAULT_GEMINI_LOCAL_MODEL;
    return ensureGatewayDeviceKey(adapterType, next);
  }
  // OpenCode requires explicit model selection — no default
  if (adapterType === "cursor" && !asNonEmptyString(next.model)) {
    next.model = DEFAULT_CURSOR_LOCAL_MODEL;
  }
  return ensureGatewayDeviceKey(adapterType, next);
}

export async function assertAdapterConfigConstraints(
  ctx: AgentRouteContext,
  companyId: string,
  adapterType: string | null | undefined,
  adapterConfig: Record<string, unknown>,
) {
  if (adapterType !== "opencode_local") return;
  const { config: runtimeConfig } = await ctx.secretsSvc.resolveAdapterConfigForRuntime(companyId, adapterConfig);
  const runtimeEnv = asRecord(runtimeConfig.env) ?? {};
  try {
    await ensureOpenCodeModelConfiguredAndAvailable({
      model: runtimeConfig.model,
      command: runtimeConfig.command,
      cwd: runtimeConfig.cwd,
      env: runtimeEnv,
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw unprocessable(`Invalid opencode_local adapterConfig: ${reason}`);
  }
}

export function resolveInstructionsFilePath(candidatePath: string, adapterConfig: Record<string, unknown>) {
  const trimmed = candidatePath.trim();
  if (path.isAbsolute(trimmed)) return trimmed;

  const cwd = asNonEmptyString(adapterConfig.cwd);
  if (!cwd) {
    throw unprocessable(
      "Relative instructions path requires adapterConfig.cwd to be set to an absolute path",
    );
  }
  if (!path.isAbsolute(cwd)) {
    throw unprocessable("adapterConfig.cwd must be an absolute path to resolve relative instructions path");
  }
  return path.resolve(cwd, trimmed);
}

export async function materializeDefaultInstructionsBundleForNewAgent<T extends {
  id: string;
  companyId: string;
  name: string;
  role: string;
  adapterType: string;
  adapterConfig: unknown;
}>(ctx: AgentRouteContext, agent: T): Promise<T> {
  if (!DEFAULT_MANAGED_INSTRUCTIONS_ADAPTER_TYPES.has(agent.adapterType)) {
    return agent;
  }

  const adapterConfig = asRecord(agent.adapterConfig) ?? {};
  const hasExplicitInstructionsBundle =
    Boolean(asNonEmptyString(adapterConfig.instructionsBundleMode))
    || Boolean(asNonEmptyString(adapterConfig.instructionsRootPath))
    || Boolean(asNonEmptyString(adapterConfig.instructionsEntryFile))
    || Boolean(asNonEmptyString(adapterConfig.instructionsFilePath))
    || Boolean(asNonEmptyString(adapterConfig.agentsMdPath));
  if (hasExplicitInstructionsBundle) {
    return agent;
  }

  const promptTemplate = typeof adapterConfig.promptTemplate === "string"
    ? adapterConfig.promptTemplate
    : "";
  const files = promptTemplate.trim().length === 0
    ? await loadDefaultAgentInstructionsBundle(resolveDefaultAgentInstructionsBundleRole(agent.role))
    : { "AGENTS.md": promptTemplate };
  const materialized = await ctx.instructions.materializeManagedBundle(
    agent,
    files,
    { entryFile: "AGENTS.md", replaceExisting: false },
  );
  const nextAdapterConfig = { ...materialized.adapterConfig };
  delete nextAdapterConfig.promptTemplate;

  const updated = await ctx.svc.update(agent.id, { adapterConfig: nextAdapterConfig });
  return (updated as T | null) ?? { ...agent, adapterConfig: nextAdapterConfig };
}

export function summarizeAgentUpdateDetails(patch: Record<string, unknown>) {
  const changedTopLevelKeys = Object.keys(patch).sort();
  const details: Record<string, unknown> = { changedTopLevelKeys };

  const adapterConfigPatch = asRecord(patch.adapterConfig);
  if (adapterConfigPatch) {
    details.changedAdapterConfigKeys = Object.keys(adapterConfigPatch).sort();
  }

  const runtimeConfigPatch = asRecord(patch.runtimeConfig);
  if (runtimeConfigPatch) {
    details.changedRuntimeConfigKeys = Object.keys(runtimeConfigPatch).sort();
  }

  return details;
}

export function buildUnsupportedSkillSnapshot(
  adapterType: string,
  desiredSkills: string[] = [],
): AgentSkillSnapshot {
  return {
    adapterType,
    supported: false,
    mode: "unsupported",
    desiredSkills,
    entries: [],
    warnings: ["This adapter does not implement skill sync yet."],
  };
}

export function shouldMaterializeRuntimeSkillsForAdapter(adapterType: string) {
  return adapterType !== "claude_local";
}

export async function buildRuntimeSkillConfig(
  ctx: AgentRouteContext,
  companyId: string,
  adapterType: string,
  config: Record<string, unknown>,
) {
  const runtimeSkillEntries = await ctx.companySkills.listRuntimeSkillEntries(companyId, {
    materializeMissing: shouldMaterializeRuntimeSkillsForAdapter(adapterType),
  });
  return {
    ...config,
    paperclipRuntimeSkills: runtimeSkillEntries,
  };
}

export async function resolveDesiredSkillAssignment(
  ctx: AgentRouteContext,
  companyId: string,
  adapterType: string,
  adapterConfig: Record<string, unknown>,
  requestedDesiredSkills: string[] | undefined,
) {
  if (!requestedDesiredSkills) {
    return {
      adapterConfig,
      desiredSkills: null as string[] | null,
      runtimeSkillEntries: null as Awaited<ReturnType<typeof ctx.companySkills.listRuntimeSkillEntries>> | null,
    };
  }

  const resolvedRequestedSkills = await ctx.companySkills.resolveRequestedSkillKeys(
    companyId,
    requestedDesiredSkills,
  );
  const runtimeSkillEntries = await ctx.companySkills.listRuntimeSkillEntries(companyId, {
    materializeMissing: shouldMaterializeRuntimeSkillsForAdapter(adapterType),
  });
  const requiredSkills = runtimeSkillEntries
    .filter((entry) => entry.required)
    .map((entry) => entry.key);
  const desiredSkills = Array.from(new Set([...requiredSkills, ...resolvedRequestedSkills]));

  return {
    adapterConfig: writePaperclipSkillSyncPreference(adapterConfig, desiredSkills),
    desiredSkills,
    runtimeSkillEntries,
  };
}

export function redactForRestrictedAgentView(agent: Awaited<ReturnType<AgentRouteContext["svc"]["getById"]>>) {
  if (!agent) return null;
  return {
    ...agent,
    adapterConfig: {},
    runtimeConfig: {},
  };
}

export function redactAgentConfiguration(agent: Awaited<ReturnType<AgentRouteContext["svc"]["getById"]>>) {
  if (!agent) return null;
  return {
    id: agent.id,
    companyId: agent.companyId,
    name: agent.name,
    role: agent.role,
    title: agent.title,
    status: agent.status,
    reportsTo: agent.reportsTo,
    adapterType: agent.adapterType,
    adapterConfig: redactEventPayload(agent.adapterConfig),
    runtimeConfig: redactEventPayload(agent.runtimeConfig),
    permissions: agent.permissions,
    updatedAt: agent.updatedAt,
  };
}

export function redactRevisionSnapshot(snapshot: unknown): Record<string, unknown> {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return {};
  const record = snapshot as Record<string, unknown>;
  return {
    ...record,
    adapterConfig: redactEventPayload(
      typeof record.adapterConfig === "object" && record.adapterConfig !== null
        ? (record.adapterConfig as Record<string, unknown>)
        : {},
    ),
    runtimeConfig: redactEventPayload(
      typeof record.runtimeConfig === "object" && record.runtimeConfig !== null
        ? (record.runtimeConfig as Record<string, unknown>)
        : {},
    ),
    metadata:
      typeof record.metadata === "object" && record.metadata !== null
        ? redactEventPayload(record.metadata as Record<string, unknown>)
        : record.metadata ?? null,
  };
}

export function redactConfigRevision(
  revision: Record<string, unknown> & { beforeConfig: unknown; afterConfig: unknown },
) {
  return {
    ...revision,
    beforeConfig: redactRevisionSnapshot(revision.beforeConfig),
    afterConfig: redactRevisionSnapshot(revision.afterConfig),
  };
}

export function toLeanOrgNode(node: Record<string, unknown>): Record<string, unknown> {
  const reports = Array.isArray(node.reports)
    ? (node.reports as Array<Record<string, unknown>>).map((report) => toLeanOrgNode(report))
    : [];
  return {
    id: String(node.id),
    name: String(node.name),
    role: String(node.role),
    status: String(node.status),
    reports,
  };
}

export function installAgentIdParam(router: Router, ctx: AgentRouteContext) {
  router.param("id", async (req, _res, next, rawId) => {
    try {
      req.params.id = await normalizeAgentReference(ctx, req, String(rawId));
      next();
    } catch (err) {
      next(err);
    }
  });
}
