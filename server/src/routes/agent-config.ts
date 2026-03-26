import { Router } from "express";
import {
  readPaperclipSkillSyncPreference,
} from "@paperclipai/adapter-utils/server-utils";
import {
  agentSkillSyncSchema,
  testAdapterEnvironmentSchema,
  updateAgentInstructionsBundleSchema,
  updateAgentInstructionsPathSchema,
  updateAgentPermissionsSchema,
  updateAgentSchema,
  upsertAgentInstructionsFileSchema,
} from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { logActivity } from "../services/index.js";
import { syncInstructionsBundleConfigFromFilePath } from "../services/index.js";
import { assertBoard, assertCompanyAccess, getActorInfo } from "./authz.js";
import { findServerAdapter, listAdapterModels } from "../adapters/index.js";
import { agentAccessService } from "../services/index.js";
import type { AgentRouteContext } from "./agent-helpers.js";
import {
  installAgentIdParam,
  assertCanReadConfigurations,
  assertCanUpdateAgent,
  assertCanManageInstructionsPath,
  assertCanReadAgent,
  actorCanReadConfigurationsForCompany,
  buildAgentDetail,
  buildRuntimeSkillConfig,
  buildUnsupportedSkillSnapshot,
  resolveDesiredSkillAssignment,
  redactAgentConfiguration,
  redactConfigRevision,
  redactForRestrictedAgentView,
  asRecord,
  asNonEmptyString,
  resolveInstructionsFilePath,
  summarizeAgentUpdateDetails,
  applyCreateDefaultsByAdapterType,
  assertAdapterConfigConstraints,
  preserveInstructionsBundleConfig,
  shouldMaterializeRuntimeSkillsForAdapter,
  DEFAULT_INSTRUCTIONS_PATH_KEYS,
  KNOWN_INSTRUCTIONS_PATH_KEYS,
  KNOWN_INSTRUCTIONS_BUNDLE_KEYS,
} from "./agent-helpers.js";
import { unprocessable } from "../errors.js";

export function agentConfigRoutes(ctx: AgentRouteContext) {
  const router = Router();
  installAgentIdParam(router, ctx);

  router.get("/companies/:companyId/adapters/:type/models", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const type = req.params.type as string;
    const models = await listAdapterModels(type);
    res.json(models);
  });

  router.post(
    "/companies/:companyId/adapters/:type/test-environment",
    validate(testAdapterEnvironmentSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const type = req.params.type as string;
      await assertCanReadConfigurations(ctx, req, companyId);

      const adapter = findServerAdapter(type);
      if (!adapter) {
        res.status(404).json({ error: `Unknown adapter type: ${type}` });
        return;
      }

      const inputAdapterConfig =
        (req.body?.adapterConfig ?? {}) as Record<string, unknown>;
      const normalizedAdapterConfig = await ctx.secretsSvc.normalizeAdapterConfigForPersistence(
        companyId,
        inputAdapterConfig,
        { strictMode: ctx.strictSecretsMode },
      );
      const { config: runtimeAdapterConfig } = await ctx.secretsSvc.resolveAdapterConfigForRuntime(
        companyId,
        normalizedAdapterConfig,
      );

      const result = await adapter.testEnvironment({
        companyId,
        adapterType: type,
        config: runtimeAdapterConfig,
      });

      res.json(result);
    },
  );

  router.get("/agents/:id/skills", async (req, res) => {
    const id = req.params.id as string;
    const agent = await ctx.svc.getById(id);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    await assertCanReadConfigurations(ctx, req, agent.companyId);

    const adapter = findServerAdapter(agent.adapterType);
    if (!adapter?.listSkills) {
      const preference = readPaperclipSkillSyncPreference(
        agent.adapterConfig as Record<string, unknown>,
      );
      const runtimeSkillEntries = await ctx.companySkills.listRuntimeSkillEntries(agent.companyId, {
        materializeMissing: false,
      });
      const requiredSkills = runtimeSkillEntries.filter((entry) => entry.required).map((entry) => entry.key);
      res.json(buildUnsupportedSkillSnapshot(agent.adapterType, Array.from(new Set([...requiredSkills, ...preference.desiredSkills]))));
      return;
    }

    const { config: runtimeConfig } = await ctx.secretsSvc.resolveAdapterConfigForRuntime(
      agent.companyId,
      agent.adapterConfig,
    );
    const runtimeSkillConfig = await buildRuntimeSkillConfig(
      ctx,
      agent.companyId,
      agent.adapterType,
      runtimeConfig,
    );
    const snapshot = await adapter.listSkills({
      agentId: agent.id,
      companyId: agent.companyId,
      adapterType: agent.adapterType,
      config: runtimeSkillConfig,
    });
    res.json(snapshot);
  });

  router.post(
    "/agents/:id/skills/sync",
    validate(agentSkillSyncSchema),
    async (req, res) => {
      const id = req.params.id as string;
      const agent = await ctx.svc.getById(id);
      if (!agent) {
        res.status(404).json({ error: "Agent not found" });
        return;
      }
      await assertCanUpdateAgent(ctx, req, agent);

      const requestedSkills = Array.from(
        new Set(
          (req.body.desiredSkills as string[])
            .map((value) => value.trim())
            .filter(Boolean),
        ),
      );
      const {
        adapterConfig: nextAdapterConfig,
        desiredSkills,
        runtimeSkillEntries,
      } = await resolveDesiredSkillAssignment(
        ctx,
        agent.companyId,
        agent.adapterType,
        agent.adapterConfig as Record<string, unknown>,
        requestedSkills,
      );
      if (!desiredSkills || !runtimeSkillEntries) {
        throw unprocessable("Skill sync requires desiredSkills.");
      }
      const actor = getActorInfo(req);
      const updated = await ctx.svc.update(agent.id, {
        adapterConfig: nextAdapterConfig,
      }, {
        recordRevision: {
          createdByAgentId: actor.agentId,
          createdByUserId: actor.actorType === "user" ? actor.actorId : null,
          source: "skill-sync",
        },
      });
      if (!updated) {
        res.status(404).json({ error: "Agent not found" });
        return;
      }

      const adapter = findServerAdapter(updated.adapterType);
      const { config: runtimeConfig } = await ctx.secretsSvc.resolveAdapterConfigForRuntime(
        updated.companyId,
        updated.adapterConfig,
      );
      const runtimeSkillConfig = {
        ...runtimeConfig,
        paperclipRuntimeSkills: runtimeSkillEntries,
      };
      const snapshot = adapter?.syncSkills
        ? await adapter.syncSkills({
            agentId: updated.id,
            companyId: updated.companyId,
            adapterType: updated.adapterType,
            config: runtimeSkillConfig,
          }, desiredSkills)
        : adapter?.listSkills
          ? await adapter.listSkills({
              agentId: updated.id,
              companyId: updated.companyId,
              adapterType: updated.adapterType,
              config: runtimeSkillConfig,
            })
          : buildUnsupportedSkillSnapshot(updated.adapterType, desiredSkills);

      await logActivity(ctx.db, {
        companyId: updated.companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        action: "agent.skills_synced",
        entityType: "agent",
        entityId: updated.id,
        agentId: actor.agentId,
        runId: actor.runId,
        details: {
          adapterType: updated.adapterType,
          desiredSkills,
          mode: snapshot.mode,
          supported: snapshot.supported,
          entryCount: snapshot.entries.length,
          warningCount: snapshot.warnings.length,
        },
      });

      res.json(snapshot);
    },
  );

  router.get("/companies/:companyId/agent-configurations", async (req, res) => {
    const companyId = req.params.companyId as string;
    await assertCanReadConfigurations(ctx, req, companyId);
    const rows = await ctx.svc.list(companyId);
    res.json(rows.map((row) => redactAgentConfiguration(row)));
  });

  router.get("/agents/:id/configuration", async (req, res) => {
    const id = req.params.id as string;
    const agent = await ctx.svc.getById(id);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    await assertCanReadConfigurations(ctx, req, agent.companyId);
    res.json(redactAgentConfiguration(agent));
  });

  router.get("/agents/:id/config-revisions", async (req, res) => {
    const id = req.params.id as string;
    const agent = await ctx.svc.getById(id);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    await assertCanReadConfigurations(ctx, req, agent.companyId);
    const revisions = await ctx.svc.listConfigRevisions(id);
    res.json(revisions.map((revision) => redactConfigRevision(revision)));
  });

  router.get("/agents/:id/config-revisions/:revisionId", async (req, res) => {
    const id = req.params.id as string;
    const revisionId = req.params.revisionId as string;
    const agent = await ctx.svc.getById(id);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    await assertCanReadConfigurations(ctx, req, agent.companyId);
    const revision = await ctx.svc.getConfigRevision(id, revisionId);
    if (!revision) {
      res.status(404).json({ error: "Revision not found" });
      return;
    }
    res.json(redactConfigRevision(revision));
  });

  router.post("/agents/:id/config-revisions/:revisionId/rollback", async (req, res) => {
    const id = req.params.id as string;
    const revisionId = req.params.revisionId as string;
    const existing = await ctx.svc.getById(id);
    if (!existing) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    await assertCanUpdateAgent(ctx, req, existing);

    const actor = getActorInfo(req);
    const updated = await ctx.svc.rollbackConfigRevision(id, revisionId, {
      agentId: actor.agentId,
      userId: actor.actorType === "user" ? actor.actorId : null,
    });
    if (!updated) {
      res.status(404).json({ error: "Revision not found" });
      return;
    }

    await logActivity(ctx.db, {
      companyId: updated.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "agent.config_rolled_back",
      entityType: "agent",
      entityId: updated.id,
      details: { revisionId },
    });

    res.json(updated);
  });

  router.patch("/agents/:id/permissions", validate(updateAgentPermissionsSchema), async (req, res) => {
    const id = req.params.id as string;
    const existing = await ctx.svc.getById(id);
    if (!existing) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    assertCompanyAccess(req, existing.companyId);

    if (req.actor.type === "agent") {
      const actorAgent = req.actor.agentId ? await ctx.svc.getById(req.actor.agentId) : null;
      if (!actorAgent || actorAgent.companyId !== existing.companyId) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      if (actorAgent.role !== "ceo") {
        res.status(403).json({ error: "Only CEO can manage permissions" });
        return;
      }
    }

    const agent = await ctx.svc.updatePermissions(id, req.body);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }

    const effectiveCanAssignTasks =
      agent.role === "ceo" || Boolean(agent.permissions?.canCreateAgents) || req.body.canAssignTasks;
    await ctx.access.ensureMembership(agent.companyId, "agent", agent.id, "member", "active");
    await ctx.access.setPrincipalPermission(
      agent.companyId,
      "agent",
      agent.id,
      "tasks:assign",
      effectiveCanAssignTasks,
      req.actor.type === "board" ? (req.actor.userId ?? null) : null,
    );

    const actor = getActorInfo(req);
    await logActivity(ctx.db, {
      companyId: agent.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "agent.permissions_updated",
      entityType: "agent",
      entityId: agent.id,
      details: {
        canCreateAgents: agent.permissions?.canCreateAgents ?? false,
        canAssignTasks: effectiveCanAssignTasks,
      },
    });

    res.json(await buildAgentDetail(ctx, agent));
  });

  router.patch("/agents/:id/instructions-path", validate(updateAgentInstructionsPathSchema), async (req, res) => {
    const id = req.params.id as string;
    const existing = await ctx.svc.getById(id);
    if (!existing) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }

    await assertCanManageInstructionsPath(ctx, req, existing);

    const existingAdapterConfig = asRecord(existing.adapterConfig) ?? {};
    const explicitKey = asNonEmptyString(req.body.adapterConfigKey);
    const defaultKey = DEFAULT_INSTRUCTIONS_PATH_KEYS[existing.adapterType] ?? null;
    const adapterConfigKey = explicitKey ?? defaultKey;
    if (!adapterConfigKey) {
      res.status(422).json({
        error: `No default instructions path key for adapter type '${existing.adapterType}'. Provide adapterConfigKey.`,
      });
      return;
    }

    const nextAdapterConfig: Record<string, unknown> = { ...existingAdapterConfig };
    if (req.body.path === null) {
      delete nextAdapterConfig[adapterConfigKey];
    } else {
      nextAdapterConfig[adapterConfigKey] = resolveInstructionsFilePath(req.body.path, existingAdapterConfig);
    }

    const syncedAdapterConfig = syncInstructionsBundleConfigFromFilePath(existing, nextAdapterConfig);
    const normalizedAdapterConfig = await ctx.secretsSvc.normalizeAdapterConfigForPersistence(
      existing.companyId,
      syncedAdapterConfig,
      { strictMode: ctx.strictSecretsMode },
    );
    const actor = getActorInfo(req);
    const agent = await ctx.svc.update(
      id,
      { adapterConfig: normalizedAdapterConfig },
      {
        recordRevision: {
          createdByAgentId: actor.agentId,
          createdByUserId: actor.actorType === "user" ? actor.actorId : null,
          source: "instructions_path_patch",
        },
      },
    );
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }

    const updatedAdapterConfig = asRecord(agent.adapterConfig) ?? {};
    const pathValue = asNonEmptyString(updatedAdapterConfig[adapterConfigKey]);

    await logActivity(ctx.db, {
      companyId: agent.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "agent.instructions_path_updated",
      entityType: "agent",
      entityId: agent.id,
      details: {
        adapterConfigKey,
        path: pathValue,
        cleared: req.body.path === null,
      },
    });

    res.json({
      agentId: agent.id,
      adapterType: agent.adapterType,
      adapterConfigKey,
      path: pathValue,
    });
  });

  router.get("/agents/:id/instructions-bundle", async (req, res) => {
    const id = req.params.id as string;
    const existing = await ctx.svc.getById(id);
    if (!existing) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    await assertCanReadAgent(req, ctx, existing);
    res.json(await ctx.instructions.getBundle(existing));
  });

  router.patch("/agents/:id/instructions-bundle", validate(updateAgentInstructionsBundleSchema), async (req, res) => {
    const id = req.params.id as string;
    const existing = await ctx.svc.getById(id);
    if (!existing) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    await assertCanManageInstructionsPath(ctx, req, existing);

    const actor = getActorInfo(req);
    const { bundle, adapterConfig } = await ctx.instructions.updateBundle(existing, req.body);
    const normalizedAdapterConfig = await ctx.secretsSvc.normalizeAdapterConfigForPersistence(
      existing.companyId,
      adapterConfig,
      { strictMode: ctx.strictSecretsMode },
    );
    await ctx.svc.update(
      id,
      { adapterConfig: normalizedAdapterConfig },
      {
        recordRevision: {
          createdByAgentId: actor.agentId,
          createdByUserId: actor.actorType === "user" ? actor.actorId : null,
          source: "instructions_bundle_patch",
        },
      },
    );

    await logActivity(ctx.db, {
      companyId: existing.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "agent.instructions_bundle_updated",
      entityType: "agent",
      entityId: existing.id,
      details: {
        mode: bundle.mode,
        rootPath: bundle.rootPath,
        entryFile: bundle.entryFile,
        clearLegacyPromptTemplate: req.body.clearLegacyPromptTemplate === true,
      },
    });

    res.json(bundle);
  });

  router.get("/agents/:id/instructions-bundle/file", async (req, res) => {
    const id = req.params.id as string;
    const existing = await ctx.svc.getById(id);
    if (!existing) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    await assertCanReadAgent(req, ctx, existing);

    const relativePath = typeof req.query.path === "string" ? req.query.path : "";
    if (!relativePath.trim()) {
      res.status(422).json({ error: "Query parameter 'path' is required" });
      return;
    }

    res.json(await ctx.instructions.readFile(existing, relativePath));
  });

  router.put("/agents/:id/instructions-bundle/file", validate(upsertAgentInstructionsFileSchema), async (req, res) => {
    const id = req.params.id as string;
    const existing = await ctx.svc.getById(id);
    if (!existing) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    await assertCanManageInstructionsPath(ctx, req, existing);

    const actor = getActorInfo(req);
    const result = await ctx.instructions.writeFile(existing, req.body.path, req.body.content, {
      clearLegacyPromptTemplate: req.body.clearLegacyPromptTemplate,
    });
    const normalizedAdapterConfig = await ctx.secretsSvc.normalizeAdapterConfigForPersistence(
      existing.companyId,
      result.adapterConfig,
      { strictMode: ctx.strictSecretsMode },
    );
    await ctx.svc.update(
      id,
      { adapterConfig: normalizedAdapterConfig },
      {
        recordRevision: {
          createdByAgentId: actor.agentId,
          createdByUserId: actor.actorType === "user" ? actor.actorId : null,
          source: "instructions_bundle_file_put",
        },
      },
    );

    await logActivity(ctx.db, {
      companyId: existing.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "agent.instructions_file_updated",
      entityType: "agent",
      entityId: existing.id,
      details: {
        path: result.file.path,
        size: result.file.size,
        clearLegacyPromptTemplate: req.body.clearLegacyPromptTemplate === true,
      },
    });

    res.json(result.file);
  });

  router.delete("/agents/:id/instructions-bundle/file", async (req, res) => {
    const id = req.params.id as string;
    const existing = await ctx.svc.getById(id);
    if (!existing) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    await assertCanManageInstructionsPath(ctx, req, existing);

    const relativePath = typeof req.query.path === "string" ? req.query.path : "";
    if (!relativePath.trim()) {
      res.status(422).json({ error: "Query parameter 'path' is required" });
      return;
    }

    const actor = getActorInfo(req);
    const result = await ctx.instructions.deleteFile(existing, relativePath);
    await logActivity(ctx.db, {
      companyId: existing.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "agent.instructions_file_deleted",
      entityType: "agent",
      entityId: existing.id,
      details: {
        path: relativePath,
      },
    });

    res.json(result.bundle);
  });

  router.patch("/agents/:id", validate(updateAgentSchema), async (req, res) => {
    const id = req.params.id as string;
    const existing = await ctx.svc.getById(id);
    if (!existing) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    await assertCanUpdateAgent(ctx, req, existing);

    if (Object.prototype.hasOwnProperty.call(req.body, "permissions")) {
      res.status(422).json({ error: "Use /api/agents/:id/permissions for permission changes" });
      return;
    }

    const patchData = { ...(req.body as Record<string, unknown>) };
    const replaceAdapterConfig = patchData.replaceAdapterConfig === true;
    delete patchData.replaceAdapterConfig;
    if (Object.prototype.hasOwnProperty.call(patchData, "adapterConfig")) {
      const adapterConfig = asRecord(patchData.adapterConfig);
      if (!adapterConfig) {
        res.status(422).json({ error: "adapterConfig must be an object" });
        return;
      }
      const changingInstructionsPath = Object.keys(adapterConfig).some((key) =>
        KNOWN_INSTRUCTIONS_PATH_KEYS.has(key),
      );
      if (changingInstructionsPath) {
        await assertCanManageInstructionsPath(ctx, req, existing);
      }
      patchData.adapterConfig = adapterConfig;
    }

    const requestedAdapterType =
      typeof patchData.adapterType === "string" ? patchData.adapterType : existing.adapterType;
    const touchesAdapterConfiguration =
      Object.prototype.hasOwnProperty.call(patchData, "adapterType") ||
      Object.prototype.hasOwnProperty.call(patchData, "adapterConfig");
    if (touchesAdapterConfiguration) {
      const existingAdapterConfig = asRecord(existing.adapterConfig) ?? {};
      const changingAdapterType =
        typeof patchData.adapterType === "string" && patchData.adapterType !== existing.adapterType;
      const requestedAdapterConfig = Object.prototype.hasOwnProperty.call(patchData, "adapterConfig")
        ? (asRecord(patchData.adapterConfig) ?? {})
        : null;
      if (
        requestedAdapterConfig
        && replaceAdapterConfig
        && KNOWN_INSTRUCTIONS_BUNDLE_KEYS.some((key) =>
          existingAdapterConfig[key] !== undefined && requestedAdapterConfig[key] === undefined,
        )
      ) {
        await assertCanManageInstructionsPath(ctx, req, existing);
      }
      let rawEffectiveAdapterConfig = requestedAdapterConfig ?? existingAdapterConfig;
      if (requestedAdapterConfig && !changingAdapterType && !replaceAdapterConfig) {
        rawEffectiveAdapterConfig = { ...existingAdapterConfig, ...requestedAdapterConfig };
      }
      if (changingAdapterType) {
        rawEffectiveAdapterConfig = preserveInstructionsBundleConfig(
          existingAdapterConfig,
          rawEffectiveAdapterConfig,
        );
      }
      const effectiveAdapterConfig = applyCreateDefaultsByAdapterType(
        requestedAdapterType,
        rawEffectiveAdapterConfig,
      );
      const normalizedEffectiveAdapterConfig = await ctx.secretsSvc.normalizeAdapterConfigForPersistence(
        existing.companyId,
        effectiveAdapterConfig,
        { strictMode: ctx.strictSecretsMode },
      );
      patchData.adapterConfig = syncInstructionsBundleConfigFromFilePath(existing, normalizedEffectiveAdapterConfig);
    }
    if (touchesAdapterConfiguration && requestedAdapterType === "opencode_local") {
      const effectiveAdapterConfig = asRecord(patchData.adapterConfig) ?? {};
      await assertAdapterConfigConstraints(
        ctx,
        existing.companyId,
        requestedAdapterType,
        effectiveAdapterConfig,
      );
    }

    const actor = getActorInfo(req);
    const agent = await ctx.svc.update(id, patchData, {
      recordRevision: {
        createdByAgentId: actor.agentId,
        createdByUserId: actor.actorType === "user" ? actor.actorId : null,
        source: "patch",
      },
    });
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }

    await logActivity(ctx.db, {
      companyId: agent.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "agent.updated",
      entityType: "agent",
      entityId: agent.id,
      details: summarizeAgentUpdateDetails(patchData),
    });

    res.json(agent);
  });

  return router;
}
