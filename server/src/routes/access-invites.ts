import { Router } from "express";
import type { Request } from "express";
import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { invites, joinRequests } from "@paperclipai/db";
import {
  acceptInviteSchema,
  createCompanyInviteSchema,
  createOpenClawInvitePromptSchema
} from "@paperclipai/shared";
import type { DeploymentExposure, DeploymentMode } from "@paperclipai/shared";
import {
  forbidden,
  conflict,
  notFound,
  unauthorized,
  badRequest
} from "../errors.js";
import { logger } from "../middleware/logger.js";
import { validate } from "../middleware/validate.js";
import {
  accessService,
  agentService,
  logActivity
} from "../services/index.js";
import { assertCompanyAccess } from "./authz.js";
import {
  hashToken,
  createInviteToken,
  createClaimSecret,
  companyInviteExpiresAt,
  requestBaseUrl,
  requestIp,
  isLocalImplicit,
  resolveActorEmail,
  inviteExpired,
  isPlainObject,
  toInviteSummaryResponse,
  toJoinRequestResponse,
  buildJoinDefaultsPayloadForAccept,
  mergeJoinDefaultsPayloadForReplay,
  canReplayOpenClawGatewayInviteAccept,
  normalizeAgentDefaultsForJoin,
  summarizeOpenClawGatewayDefaultsForLog,
  buildInviteOnboardingManifest,
  buildInviteOnboardingTextDocument,
  mergeInviteDefaults,
  isInviteTokenHashCollisionError,
  probeInviteResolutionTarget,
  INVITE_TOKEN_MAX_RETRIES
} from "./access-helpers.js";
import type { JoinDiagnostic } from "./access-helpers.js";

export function accessInvitesRoutes(
  db: Db,
  opts: {
    deploymentMode: DeploymentMode;
    deploymentExposure: DeploymentExposure;
    bindHost: string;
    allowedHostnames: string[];
  }
) {
  const router = Router();
  const access = accessService(db);
  const agents = agentService(db);

  async function assertCompanyPermission(
    req: Request,
    companyId: string,
    permissionKey: any
  ) {
    assertCompanyAccess(req, companyId);
    if (req.actor.type === "agent") {
      if (!req.actor.agentId) throw forbidden();
      const allowed = await access.hasPermission(
        companyId,
        "agent",
        req.actor.agentId,
        permissionKey
      );
      if (!allowed) throw forbidden("Permission denied");
      return;
    }
    if (req.actor.type !== "board") throw unauthorized();
    if (isLocalImplicit(req)) return;
    const allowed = await access.canUser(
      companyId,
      req.actor.userId,
      permissionKey
    );
    if (!allowed) throw forbidden("Permission denied");
  }

  async function assertCanGenerateOpenClawInvitePrompt(
    req: Request,
    companyId: string
  ) {
    assertCompanyAccess(req, companyId);
    if (req.actor.type === "agent") {
      if (!req.actor.agentId) throw forbidden("Agent authentication required");
      const actorAgent = await agents.getById(req.actor.agentId);
      if (!actorAgent || actorAgent.companyId !== companyId) {
        throw forbidden("Agent key cannot access another company");
      }
      if (actorAgent.role !== "ceo") {
        throw forbidden("Only CEO agents can generate OpenClaw invite prompts");
      }
      return;
    }
    if (req.actor.type !== "board") throw unauthorized();
    if (isLocalImplicit(req)) return;
    const allowed = await access.canUser(companyId, req.actor.userId, "users:invite");
    if (!allowed) throw forbidden("Permission denied");
  }

  async function createCompanyInviteForCompany(input: {
    req: Request;
    companyId: string;
    allowedJoinTypes: "human" | "agent" | "both";
    defaultsPayload?: Record<string, unknown> | null;
    agentMessage?: string | null;
  }) {
    const normalizedAgentMessage =
      typeof input.agentMessage === "string"
        ? input.agentMessage.trim() || null
        : null;
    const insertValues = {
      companyId: input.companyId,
      inviteType: "company_join" as const,
      allowedJoinTypes: input.allowedJoinTypes,
      defaultsPayload: mergeInviteDefaults(
        input.defaultsPayload ?? null,
        normalizedAgentMessage
      ),
      expiresAt: companyInviteExpiresAt(),
      invitedByUserId: input.req.actor.userId ?? null
    };

    let token: string | null = null;
    let created: typeof invites.$inferSelect | null = null;
    for (let attempt = 0; attempt < INVITE_TOKEN_MAX_RETRIES; attempt += 1) {
      const candidateToken = createInviteToken();
      try {
        const row = await db
          .insert(invites)
          .values({
            ...insertValues,
            tokenHash: hashToken(candidateToken)
          })
          .returning()
          .then((rows) => rows[0]);
        token = candidateToken;
        created = row;
        break;
      } catch (error) {
        if (!isInviteTokenHashCollisionError(error)) {
          throw error;
        }
      }
    }
    if (!token || !created) {
      throw conflict("Failed to generate a unique invite token. Please retry.");
    }

    return { token, created, normalizedAgentMessage };
  }

  // -----------------------------------------------------------------------
  // Create invites
  // -----------------------------------------------------------------------

  router.post(
    "/companies/:companyId/invites",
    validate(createCompanyInviteSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      await assertCompanyPermission(req, companyId, "users:invite");
      const { token, created, normalizedAgentMessage } =
        await createCompanyInviteForCompany({
          req,
          companyId,
          allowedJoinTypes: req.body.allowedJoinTypes,
          defaultsPayload: req.body.defaultsPayload ?? null,
          agentMessage: req.body.agentMessage ?? null
        });

      await logActivity(db, {
        companyId,
        actorType: req.actor.type === "agent" ? "agent" : "user",
        actorId:
          req.actor.type === "agent"
            ? req.actor.agentId ?? "unknown-agent"
            : req.actor.userId ?? "board",
        action: "invite.created",
        entityType: "invite",
        entityId: created.id,
        details: {
          inviteType: created.inviteType,
          allowedJoinTypes: created.allowedJoinTypes,
          expiresAt: created.expiresAt.toISOString(),
          hasAgentMessage: Boolean(normalizedAgentMessage)
        }
      });

      const inviteSummary = toInviteSummaryResponse(req, token, created);
      res.status(201).json({
        ...created,
        token,
        inviteUrl: `/invite/${token}`,
        onboardingTextPath: inviteSummary.onboardingTextPath,
        onboardingTextUrl: inviteSummary.onboardingTextUrl,
        inviteMessage: inviteSummary.inviteMessage
      });
    }
  );

  router.post(
    "/companies/:companyId/openclaw/invite-prompt",
    validate(createOpenClawInvitePromptSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      await assertCanGenerateOpenClawInvitePrompt(req, companyId);
      const { token, created, normalizedAgentMessage } =
        await createCompanyInviteForCompany({
          req,
          companyId,
          allowedJoinTypes: "agent",
          defaultsPayload: null,
          agentMessage: req.body.agentMessage ?? null
        });

      await logActivity(db, {
        companyId,
        actorType: req.actor.type === "agent" ? "agent" : "user",
        actorId:
          req.actor.type === "agent"
            ? req.actor.agentId ?? "unknown-agent"
            : req.actor.userId ?? "board",
        action: "invite.openclaw_prompt_created",
        entityType: "invite",
        entityId: created.id,
        details: {
          inviteType: created.inviteType,
          allowedJoinTypes: created.allowedJoinTypes,
          expiresAt: created.expiresAt.toISOString(),
          hasAgentMessage: Boolean(normalizedAgentMessage)
        }
      });

      const inviteSummary = toInviteSummaryResponse(req, token, created);
      res.status(201).json({
        ...created,
        token,
        inviteUrl: `/invite/${token}`,
        onboardingTextPath: inviteSummary.onboardingTextPath,
        onboardingTextUrl: inviteSummary.onboardingTextUrl,
        inviteMessage: inviteSummary.inviteMessage
      });
    }
  );

  // -----------------------------------------------------------------------
  // Invite lookup / onboarding / test-resolution
  // -----------------------------------------------------------------------

  router.get("/invites/:token", async (req, res) => {
    const token = (req.params.token as string).trim();
    if (!token) throw notFound("Invite not found");
    const invite = await db
      .select()
      .from(invites)
      .where(eq(invites.tokenHash, hashToken(token)))
      .then((rows) => rows[0] ?? null);
    if (
      !invite ||
      invite.revokedAt ||
      invite.acceptedAt ||
      inviteExpired(invite)
    ) {
      throw notFound("Invite not found");
    }

    res.json(toInviteSummaryResponse(req, token, invite));
  });

  router.get("/invites/:token/onboarding", async (req, res) => {
    const token = (req.params.token as string).trim();
    if (!token) throw notFound("Invite not found");
    const invite = await db
      .select()
      .from(invites)
      .where(eq(invites.tokenHash, hashToken(token)))
      .then((rows) => rows[0] ?? null);
    if (!invite || invite.revokedAt || inviteExpired(invite)) {
      throw notFound("Invite not found");
    }

    res.json(buildInviteOnboardingManifest(req, token, invite, opts));
  });

  router.get("/invites/:token/onboarding.txt", async (req, res) => {
    const token = (req.params.token as string).trim();
    if (!token) throw notFound("Invite not found");
    const invite = await db
      .select()
      .from(invites)
      .where(eq(invites.tokenHash, hashToken(token)))
      .then((rows) => rows[0] ?? null);
    if (!invite || invite.revokedAt || inviteExpired(invite)) {
      throw notFound("Invite not found");
    }

    res
      .type("text/plain; charset=utf-8")
      .send(buildInviteOnboardingTextDocument(req, token, invite, opts));
  });

  router.get("/invites/:token/test-resolution", async (req, res) => {
    const token = (req.params.token as string).trim();
    if (!token) throw notFound("Invite not found");
    const invite = await db
      .select()
      .from(invites)
      .where(eq(invites.tokenHash, hashToken(token)))
      .then((rows) => rows[0] ?? null);
    if (!invite || invite.revokedAt || inviteExpired(invite)) {
      throw notFound("Invite not found");
    }

    const rawUrl =
      typeof req.query.url === "string" ? req.query.url.trim() : "";
    if (!rawUrl) throw badRequest("url query parameter is required");
    let target: URL;
    try {
      target = new URL(rawUrl);
    } catch {
      throw badRequest("url must be an absolute http(s) URL");
    }
    if (target.protocol !== "http:" && target.protocol !== "https:") {
      throw badRequest("url must use http or https");
    }

    const parsedTimeoutMs =
      typeof req.query.timeoutMs === "string"
        ? Number(req.query.timeoutMs)
        : NaN;
    const timeoutMs = Number.isFinite(parsedTimeoutMs)
      ? Math.max(1000, Math.min(15000, Math.floor(parsedTimeoutMs)))
      : 5000;
    const probe = await probeInviteResolutionTarget(target, timeoutMs);
    res.json({
      inviteId: invite.id,
      testResolutionPath: `/api/invites/${token}/test-resolution`,
      requestedUrl: target.toString(),
      timeoutMs,
      ...probe
    });
  });

  // -----------------------------------------------------------------------
  // Accept invite
  // -----------------------------------------------------------------------

  router.post(
    "/invites/:token/accept",
    validate(acceptInviteSchema),
    async (req, res) => {
      const token = (req.params.token as string).trim();
      if (!token) throw notFound("Invite not found");

      const invite = await db
        .select()
        .from(invites)
        .where(eq(invites.tokenHash, hashToken(token)))
        .then((rows) => rows[0] ?? null);
      if (!invite || invite.revokedAt || inviteExpired(invite)) {
        throw notFound("Invite not found");
      }
      const inviteAlreadyAccepted = Boolean(invite.acceptedAt);
      const existingJoinRequestForInvite = inviteAlreadyAccepted
        ? await db
            .select()
            .from(joinRequests)
            .where(eq(joinRequests.inviteId, invite.id))
            .then((rows) => rows[0] ?? null)
        : null;

      if (invite.inviteType === "bootstrap_ceo") {
        if (inviteAlreadyAccepted) throw notFound("Invite not found");
        if (req.body.requestType !== "human") {
          throw badRequest("Bootstrap invite requires human request type");
        }
        if (
          req.actor.type !== "board" ||
          (!req.actor.userId && !isLocalImplicit(req))
        ) {
          throw unauthorized(
            "Authenticated user required for bootstrap acceptance"
          );
        }
        const userId = req.actor.userId ?? "local-board";
        const existingAdmin = await access.isInstanceAdmin(userId);
        if (!existingAdmin) {
          await access.promoteInstanceAdmin(userId);
        }
        const updatedInvite = await db
          .update(invites)
          .set({ acceptedAt: new Date(), updatedAt: new Date() })
          .where(eq(invites.id, invite.id))
          .returning()
          .then((rows) => rows[0] ?? invite);
        res.status(202).json({
          inviteId: updatedInvite.id,
          inviteType: updatedInvite.inviteType,
          bootstrapAccepted: true,
          userId
        });
        return;
      }

      const requestType = req.body.requestType as "human" | "agent";
      const companyId = invite.companyId;
      if (!companyId) throw conflict("Invite is missing company scope");
      if (
        invite.allowedJoinTypes !== "both" &&
        invite.allowedJoinTypes !== requestType
      ) {
        throw badRequest(`Invite does not allow ${requestType} joins`);
      }

      if (requestType === "human" && req.actor.type !== "board") {
        throw unauthorized(
          "Human invite acceptance requires authenticated user"
        );
      }
      if (
        requestType === "human" &&
        !req.actor.userId &&
        !isLocalImplicit(req)
      ) {
        throw unauthorized("Authenticated user is required");
      }
      if (requestType === "agent" && !req.body.agentName) {
        if (
          !inviteAlreadyAccepted ||
          !existingJoinRequestForInvite?.agentName
        ) {
          throw badRequest("agentName is required for agent join requests");
        }
      }

      const adapterType = req.body.adapterType ?? null;
      if (
        inviteAlreadyAccepted &&
        !canReplayOpenClawGatewayInviteAccept({
          requestType,
          adapterType,
          existingJoinRequest: existingJoinRequestForInvite
        })
      ) {
        throw notFound("Invite not found");
      }
      const replayJoinRequestId = inviteAlreadyAccepted
        ? existingJoinRequestForInvite?.id ?? null
        : null;
      if (inviteAlreadyAccepted && !replayJoinRequestId) {
        throw conflict("Join request not found");
      }

      const replayMergedDefaults = inviteAlreadyAccepted
        ? mergeJoinDefaultsPayloadForReplay(
            existingJoinRequestForInvite?.agentDefaultsPayload ?? null,
            req.body.agentDefaultsPayload ?? null
          )
        : req.body.agentDefaultsPayload ?? null;

      const gatewayDefaultsPayload =
        requestType === "agent"
          ? buildJoinDefaultsPayloadForAccept({
              adapterType,
              defaultsPayload: replayMergedDefaults,
              paperclipApiUrl: req.body.paperclipApiUrl ?? null,
              inboundOpenClawAuthHeader: req.header("x-openclaw-auth") ?? null,
              inboundOpenClawTokenHeader: req.header("x-openclaw-token") ?? null
            })
          : null;

      const joinDefaults =
        requestType === "agent"
          ? normalizeAgentDefaultsForJoin({
              adapterType,
              defaultsPayload: gatewayDefaultsPayload,
              deploymentMode: opts.deploymentMode,
              deploymentExposure: opts.deploymentExposure,
              bindHost: opts.bindHost,
              allowedHostnames: opts.allowedHostnames
            })
          : {
              normalized: null as Record<string, unknown> | null,
              diagnostics: [] as JoinDiagnostic[],
              fatalErrors: [] as string[]
            };

      if (requestType === "agent" && joinDefaults.fatalErrors.length > 0) {
        throw badRequest(joinDefaults.fatalErrors.join("; "));
      }

      if (requestType === "agent" && adapterType === "openclaw_gateway") {
        logger.info(
          {
            inviteId: invite.id,
            joinRequestDiagnostics: joinDefaults.diagnostics.map((diag) => ({
              code: diag.code,
              level: diag.level
            })),
            normalizedAgentDefaults: summarizeOpenClawGatewayDefaultsForLog(
              joinDefaults.normalized
            )
          },
          "invite accept normalized OpenClaw gateway defaults"
        );
      }

      const claimSecret =
        requestType === "agent" && !inviteAlreadyAccepted
          ? createClaimSecret()
          : null;
      const claimSecretHash = claimSecret ? hashToken(claimSecret) : null;
      const claimSecretExpiresAt = claimSecret
        ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        : null;

      const actorEmail =
        requestType === "human" ? await resolveActorEmail(db, req) : null;
      const created = !inviteAlreadyAccepted
        ? await db.transaction(async (tx) => {
            await tx
              .update(invites)
              .set({ acceptedAt: new Date(), updatedAt: new Date() })
              .where(
                and(
                  eq(invites.id, invite.id),
                  isNull(invites.acceptedAt),
                  isNull(invites.revokedAt)
                )
              );

            const row = await tx
              .insert(joinRequests)
              .values({
                inviteId: invite.id,
                companyId,
                requestType,
                status: "pending_approval",
                requestIp: requestIp(req),
                requestingUserId:
                  requestType === "human"
                    ? req.actor.userId ?? "local-board"
                    : null,
                requestEmailSnapshot:
                  requestType === "human" ? actorEmail : null,
                agentName: requestType === "agent" ? req.body.agentName : null,
                adapterType: requestType === "agent" ? adapterType : null,
                capabilities:
                  requestType === "agent"
                    ? req.body.capabilities ?? null
                    : null,
                agentDefaultsPayload:
                  requestType === "agent" ? joinDefaults.normalized : null,
                claimSecretHash,
                claimSecretExpiresAt
              })
              .returning()
              .then((rows) => rows[0]);
            return row;
          })
        : await db
            .update(joinRequests)
            .set({
              requestIp: requestIp(req),
              agentName:
                requestType === "agent"
                  ? req.body.agentName ??
                    existingJoinRequestForInvite?.agentName ??
                    null
                  : null,
              capabilities:
                requestType === "agent"
                  ? req.body.capabilities ??
                    existingJoinRequestForInvite?.capabilities ??
                    null
                  : null,
              adapterType: requestType === "agent" ? adapterType : null,
              agentDefaultsPayload:
                requestType === "agent" ? joinDefaults.normalized : null,
              updatedAt: new Date()
            })
            .where(eq(joinRequests.id, replayJoinRequestId as string))
            .returning()
            .then((rows) => rows[0]);

      if (!created) {
        throw conflict("Join request not found");
      }

      if (
        inviteAlreadyAccepted &&
        requestType === "agent" &&
        adapterType === "openclaw_gateway" &&
        created.status === "approved" &&
        created.createdAgentId
      ) {
        const existingAgent = await agents.getById(created.createdAgentId);
        if (!existingAgent) {
          throw conflict("Approved join request agent not found");
        }
        const existingAdapterConfig = isPlainObject(existingAgent.adapterConfig)
          ? (existingAgent.adapterConfig as Record<string, unknown>)
          : {};
        const nextAdapterConfig = {
          ...existingAdapterConfig,
          ...(joinDefaults.normalized ?? {})
        };
        const updatedAgent = await agents.update(created.createdAgentId, {
          adapterType,
          adapterConfig: nextAdapterConfig
        });
        if (!updatedAgent) {
          throw conflict("Approved join request agent not found");
        }
        await logActivity(db, {
          companyId,
          actorType: req.actor.type === "agent" ? "agent" : "user",
          actorId:
            req.actor.type === "agent"
              ? req.actor.agentId ?? "invite-agent"
              : req.actor.userId ?? "board",
          action: "agent.updated_from_join_replay",
          entityType: "agent",
          entityId: updatedAgent.id,
          details: { inviteId: invite.id, joinRequestId: created.id }
        });
      }

      if (requestType === "agent" && adapterType === "openclaw_gateway") {
        const expectedDefaults = summarizeOpenClawGatewayDefaultsForLog(
          joinDefaults.normalized
        );
        const persistedDefaults = summarizeOpenClawGatewayDefaultsForLog(
          created.agentDefaultsPayload
        );
        const missingPersistedFields: string[] = [];

        if (expectedDefaults.url && !persistedDefaults.url)
          missingPersistedFields.push("url");
        if (
          expectedDefaults.paperclipApiUrl &&
          !persistedDefaults.paperclipApiUrl
        ) {
          missingPersistedFields.push("paperclipApiUrl");
        }
        if (expectedDefaults.gatewayToken && !persistedDefaults.gatewayToken) {
          missingPersistedFields.push("headers.x-openclaw-token");
        }
        if (
          expectedDefaults.devicePrivateKeyPem &&
          !persistedDefaults.devicePrivateKeyPem
        ) {
          missingPersistedFields.push("devicePrivateKeyPem");
        }
        if (
          expectedDefaults.headerKeys.length > 0 &&
          persistedDefaults.headerKeys.length === 0
        ) {
          missingPersistedFields.push("headers");
        }

        logger.info(
          {
            inviteId: invite.id,
            joinRequestId: created.id,
            joinRequestStatus: created.status,
            expectedDefaults,
            persistedDefaults,
            diagnostics: joinDefaults.diagnostics.map((diag) => ({
              code: diag.code,
              level: diag.level,
              message: diag.message,
              hint: diag.hint ?? null
            }))
          },
          "invite accept persisted OpenClaw gateway join request"
        );

        if (missingPersistedFields.length > 0) {
          logger.warn(
            {
              inviteId: invite.id,
              joinRequestId: created.id,
              missingPersistedFields
            },
            "invite accept detected missing persisted OpenClaw gateway defaults"
          );
        }
      }

      await logActivity(db, {
        companyId,
        actorType: req.actor.type === "agent" ? "agent" : "user",
        actorId:
          req.actor.type === "agent"
            ? req.actor.agentId ?? "invite-agent"
            : req.actor.userId ??
              (requestType === "agent" ? "invite-anon" : "board"),
        action: inviteAlreadyAccepted
          ? "join.request_replayed"
          : "join.requested",
        entityType: "join_request",
        entityId: created.id,
        details: {
          requestType,
          requestIp: created.requestIp,
          inviteReplay: inviteAlreadyAccepted
        }
      });

      const response = toJoinRequestResponse(created);
      if (claimSecret) {
        const onboardingManifest = buildInviteOnboardingManifest(
          req,
          token,
          invite,
          opts
        );
        res.status(202).json({
          ...response,
          claimSecret,
          claimApiKeyPath: `/api/join-requests/${created.id}/claim-api-key`,
          onboarding: onboardingManifest.onboarding,
          diagnostics: joinDefaults.diagnostics
        });
        return;
      }
      res.status(202).json({
        ...response,
        ...(joinDefaults.diagnostics.length > 0
          ? { diagnostics: joinDefaults.diagnostics }
          : {})
      });
    }
  );

  // -----------------------------------------------------------------------
  // Revoke invite
  // -----------------------------------------------------------------------

  router.post("/invites/:inviteId/revoke", async (req, res) => {
    const id = req.params.inviteId as string;
    const invite = await db
      .select()
      .from(invites)
      .where(eq(invites.id, id))
      .then((rows) => rows[0] ?? null);
    if (!invite) throw notFound("Invite not found");
    if (invite.inviteType === "bootstrap_ceo") {
      if (req.actor.type !== "board") throw unauthorized();
      if (!isLocalImplicit(req)) {
        const allowed = await access.isInstanceAdmin(req.actor.userId);
        if (!allowed) throw forbidden("Instance admin required");
      }
    } else {
      if (!invite.companyId) throw conflict("Invite is missing company scope");
      await assertCompanyPermission(req, invite.companyId, "users:invite");
    }
    if (invite.acceptedAt) throw conflict("Invite already consumed");
    if (invite.revokedAt) return res.json(invite);

    const revoked = await db
      .update(invites)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(eq(invites.id, id))
      .returning()
      .then((rows) => rows[0]);

    if (invite.companyId) {
      await logActivity(db, {
        companyId: invite.companyId,
        actorType: req.actor.type === "agent" ? "agent" : "user",
        actorId:
          req.actor.type === "agent"
            ? req.actor.agentId ?? "unknown-agent"
            : req.actor.userId ?? "board",
        action: "invite.revoked",
        entityType: "invite",
        entityId: id
      });
    }

    res.json(revoked);
  });

  return router;
}
