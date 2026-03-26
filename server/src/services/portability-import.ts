import path from "node:path";
import type { Db } from "@paperclipai/db";
import type {
  CompanyPortabilityAgentManifestEntry,
  CompanyPortabilityCollisionStrategy,
  CompanyPortabilityFileEntry,
  CompanyPortabilityImport,
  CompanyPortabilityImportResult,
  CompanyPortabilityInclude,
  CompanyPortabilityManifest,
  CompanyPortabilityPreview,
  CompanyPortabilityPreviewAgentPlan,
  CompanyPortabilityPreviewResult,
  CompanyPortabilitySkillManifestEntry,
  CompanySkill,
} from "@paperclipai/shared";
import {
  ISSUE_PRIORITIES,
  ISSUE_STATUSES,
  PROJECT_STATUSES,
  ROUTINE_CATCH_UP_POLICIES,
  ROUTINE_CONCURRENCY_POLICIES,
  ROUTINE_STATUSES,
  ROUTINE_TRIGGER_SIGNING_MODES,
  deriveProjectUrlKey,
  normalizeAgentUrlKey,
  asString,
  isPlainRecord,
  normalizePortablePath,
  parseFrontmatterMarkdown,
  normalizeSkillSlug,
  normalizeSkillKey,
} from "@paperclipai/shared";
import {
  writePaperclipSkillSyncPreference,
} from "@paperclipai/adapter-utils/server-utils";
import type { StorageService } from "../storage/types.js";
import { notFound, unprocessable } from "../errors.js";
import { routineService } from "./routines.js";
import {
  normalizeInclude,
  stripEmptyValues,
  readPortableTextFile,
  ensureMarkdownPath,
  applySelectedFilesToSource,
  isPortableBinaryFile,
  inferContentTypeFromPath,
  portableFileToBuffer,
  bufferToPortableBinaryFile,
  pickTextFiles,
  dedupeEnvInputs,
  uniqueNameBySlug,
  uniqueProjectName,
  resolvePortableRoutineDefinition,
  disableImportedTimerHeartbeat,
  importPortableProjectExecutionWorkspacePolicy,
  stripPortableProjectExecutionWorkspaceRefs,
  resolveImportMode,
  resolveSkillConflictStrategy,
  DEFAULT_COLLISION_STRATEGY,
  COMPANY_LOGO_CONTENT_TYPE_EXTENSIONS,
  buildOrgTreeFromManifest,
} from "./portability-helpers.js";
import { buildManifestFromPackageFiles } from "./portability-manifest.js";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

import type { ResolvedSource } from "./portability-manifest.js";

type ImportPlanInternal = {
  preview: CompanyPortabilityPreviewResult;
  source: ResolvedSource;
  include: CompanyPortabilityInclude;
  collisionStrategy: CompanyPortabilityCollisionStrategy;
  selectedAgents: CompanyPortabilityAgentManifestEntry[];
};

type ImportMode = "board_full" | "agent_safe";

type ImportBehaviorOptions = {
  mode?: ImportMode;
  sourceCompanyId?: string | null;
};

/* ------------------------------------------------------------------ */
/*  Service deps type                                                  */
/* ------------------------------------------------------------------ */

type ImportServices = {
  companies: {
    getById(id: string): Promise<any>;
    create(data: any): Promise<any>;
    update(id: string, data: any): Promise<any>;
  };
  agents: {
    list(companyId: string, opts?: any): Promise<any[]>;
    create(companyId: string, data: any): Promise<any>;
    update(id: string, data: any): Promise<any>;
  };
  assetRecords: {
    create(companyId: string, data: any): Promise<any>;
  };
  instructions: {
    materializeManagedBundle(agent: any, files: Record<string, string>, opts: any): Promise<{ adapterConfig: any }>;
  };
  access: {
    ensureMembership(companyId: string, principalType: string, principalId: string, role: string, status: string): Promise<any>;
    listActiveUserMemberships(companyId: string): Promise<any[]>;
    copyActiveUserMemberships(sourceCompanyId: string, targetCompanyId: string): Promise<any>;
    setPrincipalPermission(companyId: string, principalType: string, principalId: string, permission: string, value: boolean, actorUserId: string | null): Promise<any>;
  };
  projects: {
    list(companyId: string): Promise<any[]>;
    create(companyId: string, data: any): Promise<any>;
    update(id: string, data: any): Promise<any>;
    createWorkspace(projectId: string, data: any): Promise<any>;
  };
  issues: {
    create(companyId: string, data: any): Promise<any>;
  };
  companySkills: {
    listFull(companyId: string): Promise<CompanySkill[]>;
    importPackageFiles(companyId: string, files: Record<string, string>, opts: any): Promise<any[]>;
  };
  storage: StorageService | undefined;
  resolveSource(source: CompanyPortabilityPreview["source"]): Promise<ResolvedSource>;
};

/* ------------------------------------------------------------------ */
/*  Factory                                                            */
/* ------------------------------------------------------------------ */

export function createImportOps(db: Db, $: ImportServices) {

  async function buildPreview(
    input: CompanyPortabilityPreview,
    options?: ImportBehaviorOptions,
  ): Promise<ImportPlanInternal> {
    const mode = resolveImportMode(options);
    const requestedInclude = normalizeInclude(input.include);
    const source = applySelectedFilesToSource(await $.resolveSource(input.source), input.selectedFiles);
    const manifest = source.manifest;
    const include: CompanyPortabilityInclude = {
      company: requestedInclude.company && manifest.company !== null,
      agents: requestedInclude.agents && manifest.agents.length > 0,
      projects: requestedInclude.projects && manifest.projects.length > 0,
      issues: requestedInclude.issues && manifest.issues.length > 0,
      skills: requestedInclude.skills && manifest.skills.length > 0,
    };
    const collisionStrategy = input.collisionStrategy ?? DEFAULT_COLLISION_STRATEGY;
    if (mode === "agent_safe" && collisionStrategy === "replace") {
      throw unprocessable("Safe import routes do not allow replace collision strategy.");
    }
    const warnings = [...source.warnings];
    const errors: string[] = [];

    if (include.company && !manifest.company) {
      errors.push("Manifest does not include company metadata.");
    }

    const selectedSlugs = include.agents
      ? (
          input.agents && input.agents !== "all"
            ? Array.from(new Set(input.agents))
            : manifest.agents.map((agent) => agent.slug)
        )
      : [];

    const selectedAgents = include.agents
      ? manifest.agents.filter((agent) => selectedSlugs.includes(agent.slug))
      : [];
    const selectedMissing = selectedSlugs.filter((slug) => !manifest.agents.some((agent) => agent.slug === slug));
    for (const missing of selectedMissing) {
      errors.push(`Selected agent slug not found in manifest: ${missing}`);
    }

    if (include.agents && selectedAgents.length === 0) {
      warnings.push("No agents selected for import.");
    }

    const availableSkillKeys = new Set(source.manifest.skills.map((skill) => skill.key));
    const availableSkillSlugs = new Map<string, CompanyPortabilitySkillManifestEntry[]>();
    for (const skill of source.manifest.skills) {
      const existing = availableSkillSlugs.get(skill.slug) ?? [];
      existing.push(skill);
      availableSkillSlugs.set(skill.slug, existing);
    }

    for (const agent of selectedAgents) {
      const filePath = ensureMarkdownPath(agent.path);
      const markdown = readPortableTextFile(source.files, filePath);
      if (typeof markdown !== "string") {
        errors.push(`Missing markdown file for agent ${agent.slug}: ${filePath}`);
        continue;
      }
      const parsed = parseFrontmatterMarkdown(markdown);
      if (parsed.frontmatter.kind && parsed.frontmatter.kind !== "agent") {
        warnings.push(`Agent markdown ${filePath} does not declare kind: agent in frontmatter.`);
      }
      for (const skillRef of agent.skills) {
        const slugMatches = availableSkillSlugs.get(skillRef) ?? [];
        if (!availableSkillKeys.has(skillRef) && slugMatches.length !== 1) {
          warnings.push(`Agent ${agent.slug} references skill ${skillRef}, but that skill is not present in the package.`);
        }
      }
    }

    if (include.projects) {
      for (const project of manifest.projects) {
        const markdown = readPortableTextFile(source.files, ensureMarkdownPath(project.path));
        if (typeof markdown !== "string") {
          errors.push(`Missing markdown file for project ${project.slug}: ${project.path}`);
          continue;
        }
        const parsed = parseFrontmatterMarkdown(markdown);
        if (parsed.frontmatter.kind && parsed.frontmatter.kind !== "project") {
          warnings.push(`Project markdown ${project.path} does not declare kind: project in frontmatter.`);
        }
      }
    }

    if (include.issues) {
      const projectBySlug = new Map(manifest.projects.map((project) => [project.slug, project]));
      for (const issue of manifest.issues) {
        const markdown = readPortableTextFile(source.files, ensureMarkdownPath(issue.path));
        if (typeof markdown !== "string") {
          errors.push(`Missing markdown file for task ${issue.slug}: ${issue.path}`);
          continue;
        }
        const parsed = parseFrontmatterMarkdown(markdown);
        if (parsed.frontmatter.kind && parsed.frontmatter.kind !== "task") {
          warnings.push(`Task markdown ${issue.path} does not declare kind: task in frontmatter.`);
        }
        if (issue.projectWorkspaceKey) {
          const project = issue.projectSlug ? projectBySlug.get(issue.projectSlug) ?? null : null;
          if (!project) {
            warnings.push(`Task ${issue.slug} references workspace key ${issue.projectWorkspaceKey}, but its project is not present in the package.`);
          } else if (!project.workspaces.some((workspace) => workspace.key === issue.projectWorkspaceKey)) {
            warnings.push(`Task ${issue.slug} references missing project workspace key ${issue.projectWorkspaceKey}.`);
          }
        }
        if (issue.recurring) {
          if (!issue.projectSlug) {
            errors.push(`Recurring task ${issue.slug} must declare a project to import as a routine.`);
          }
          if (!issue.assigneeAgentSlug) {
            errors.push(`Recurring task ${issue.slug} must declare an assignee to import as a routine.`);
          }
          const resolvedRoutine = resolvePortableRoutineDefinition(issue, parsed.frontmatter.schedule);
          warnings.push(...resolvedRoutine.warnings);
          errors.push(...resolvedRoutine.errors);
        }
      }
    }

    for (const envInput of manifest.envInputs) {
      if (envInput.portability === "system_dependent") {
        warnings.push(`Environment input ${envInput.key}${envInput.agentSlug ? ` for ${envInput.agentSlug}` : ""} is system-dependent and may need manual adjustment after import.`);
      }
    }

    let targetCompanyId: string | null = null;
    let targetCompanyName: string | null = null;

    if (input.target.mode === "existing_company") {
      const targetCompany = await $.companies.getById(input.target.companyId);
      if (!targetCompany) throw notFound("Target company not found");
      targetCompanyId = targetCompany.id;
      targetCompanyName = targetCompany.name;
    }

    const agentPlans: CompanyPortabilityPreviewAgentPlan[] = [];
    const existingSlugToAgent = new Map<string, { id: string; name: string }>();
    const existingSlugs = new Set<string>();
    const projectPlans: CompanyPortabilityPreviewResult["plan"]["projectPlans"] = [];
    const issuePlans: CompanyPortabilityPreviewResult["plan"]["issuePlans"] = [];
    const existingProjectSlugToProject = new Map<string, { id: string; name: string }>();
    const existingProjectSlugs = new Set<string>();

    if (input.target.mode === "existing_company") {
      const existingAgents = await $.agents.list(input.target.companyId);
      for (const existing of existingAgents) {
        const slug = normalizeAgentUrlKey(existing.name) ?? existing.id;
        if (!existingSlugToAgent.has(slug)) existingSlugToAgent.set(slug, existing);
        existingSlugs.add(slug);
      }
      const existingProjects = await $.projects.list(input.target.companyId);
      for (const existing of existingProjects) {
        if (!existingProjectSlugToProject.has(existing.urlKey)) {
          existingProjectSlugToProject.set(existing.urlKey, { id: existing.id, name: existing.name });
        }
        existingProjectSlugs.add(existing.urlKey);
      }

      const existingSkills = await $.companySkills.listFull(input.target.companyId);
      const existingSkillKeys = new Set(existingSkills.map((skill) => skill.key));
      const existingSkillSlugs = new Set(existingSkills.map((skill) => normalizeSkillSlug(skill.slug) ?? skill.slug));
      for (const skill of manifest.skills) {
        const skillSlug = normalizeSkillSlug(skill.slug) ?? skill.slug;
        if (existingSkillKeys.has(skill.key) || existingSkillSlugs.has(skillSlug)) {
          if (mode === "agent_safe") {
            warnings.push(`Existing skill "${skill.slug}" matched during safe import and will ${collisionStrategy === "skip" ? "be skipped" : "be renamed"} instead of overwritten.`);
          } else if (collisionStrategy === "replace") {
            warnings.push(`Existing skill "${skill.slug}" (${skill.key}) will be overwritten by import.`);
          }
        }
      }
    }

    for (const manifestAgent of selectedAgents) {
      const existing = existingSlugToAgent.get(manifestAgent.slug) ?? null;
      if (!existing) {
        agentPlans.push({
          slug: manifestAgent.slug,
          action: "create",
          plannedName: manifestAgent.name,
          existingAgentId: null,
          reason: null,
        });
        continue;
      }

      if (mode === "board_full" && collisionStrategy === "replace") {
        agentPlans.push({
          slug: manifestAgent.slug,
          action: "update",
          plannedName: existing.name,
          existingAgentId: existing.id,
          reason: "Existing slug matched; replace strategy.",
        });
        continue;
      }

      if (collisionStrategy === "skip") {
        agentPlans.push({
          slug: manifestAgent.slug,
          action: "skip",
          plannedName: existing.name,
          existingAgentId: existing.id,
          reason: "Existing slug matched; skip strategy.",
        });
        continue;
      }

      const renamed = uniqueNameBySlug(manifestAgent.name, existingSlugs);
      existingSlugs.add(normalizeAgentUrlKey(renamed) ?? manifestAgent.slug);
      agentPlans.push({
        slug: manifestAgent.slug,
        action: "create",
        plannedName: renamed,
        existingAgentId: existing.id,
        reason: "Existing slug matched; rename strategy.",
      });
    }

    if (include.projects) {
      for (const manifestProject of manifest.projects) {
        const existing = existingProjectSlugToProject.get(manifestProject.slug) ?? null;
        if (!existing) {
          projectPlans.push({
            slug: manifestProject.slug,
            action: "create",
            plannedName: manifestProject.name,
            existingProjectId: null,
            reason: null,
          });
          continue;
        }
        if (mode === "board_full" && collisionStrategy === "replace") {
          projectPlans.push({
            slug: manifestProject.slug,
            action: "update",
            plannedName: existing.name,
            existingProjectId: existing.id,
            reason: "Existing slug matched; replace strategy.",
          });
          continue;
        }
        if (collisionStrategy === "skip") {
          projectPlans.push({
            slug: manifestProject.slug,
            action: "skip",
            plannedName: existing.name,
            existingProjectId: existing.id,
            reason: "Existing slug matched; skip strategy.",
          });
          continue;
        }
        const renamed = uniqueProjectName(manifestProject.name, existingProjectSlugs);
        existingProjectSlugs.add(deriveProjectUrlKey(renamed, renamed));
        projectPlans.push({
          slug: manifestProject.slug,
          action: "create",
          plannedName: renamed,
          existingProjectId: existing.id,
          reason: "Existing slug matched; rename strategy.",
        });
      }
    }

    // Apply user-specified name overrides (keyed by slug)
    if (input.nameOverrides) {
      for (const ap of agentPlans) {
        const override = input.nameOverrides[ap.slug];
        if (override) {
          ap.plannedName = override;
        }
      }
      for (const pp of projectPlans) {
        const override = input.nameOverrides[pp.slug];
        if (override) {
          pp.plannedName = override;
        }
      }
      for (const ip of issuePlans) {
        const override = input.nameOverrides[ip.slug];
        if (override) {
          ip.plannedTitle = override;
        }
      }
    }

    // Warn about agents that will be overwritten/updated
    for (const ap of agentPlans) {
      if (ap.action === "update") {
        warnings.push(`Existing agent "${ap.plannedName}" (${ap.slug}) will be overwritten by import.`);
      }
    }

    // Warn about projects that will be overwritten/updated
    for (const pp of projectPlans) {
      if (pp.action === "update") {
        warnings.push(`Existing project "${pp.plannedName}" (${pp.slug}) will be overwritten by import.`);
      }
    }

    if (include.issues) {
      for (const manifestIssue of manifest.issues) {
        issuePlans.push({
          slug: manifestIssue.slug,
          action: "create",
          plannedTitle: manifestIssue.title,
          reason: manifestIssue.recurring ? "Recurring task will be imported as a routine." : null,
        });
      }
    }

    const preview: CompanyPortabilityPreviewResult = {
      include,
      targetCompanyId,
      targetCompanyName,
      collisionStrategy,
      selectedAgentSlugs: selectedAgents.map((agent) => agent.slug),
      plan: {
        companyAction: input.target.mode === "new_company"
          ? "create"
          : include.company && mode === "board_full"
            ? "update"
            : "none",
        agentPlans,
        projectPlans,
        issuePlans,
      },
      manifest,
      files: source.files,
      envInputs: manifest.envInputs ?? [],
      warnings,
      errors,
    };

    return {
      preview,
      source,
      include,
      collisionStrategy,
      selectedAgents,
    };
  }

  async function previewImport(
    input: CompanyPortabilityPreview,
    options?: ImportBehaviorOptions,
  ): Promise<CompanyPortabilityPreviewResult> {
    const plan = await buildPreview(input, options);
    return plan.preview;
  }

  async function importBundle(
    input: CompanyPortabilityImport,
    actorUserId: string | null | undefined,
    options?: ImportBehaviorOptions,
  ): Promise<CompanyPortabilityImportResult> {
    const mode = resolveImportMode(options);
    const plan = await buildPreview(input, options);
    if (plan.preview.errors.length > 0) {
      throw unprocessable(`Import preview has errors: ${plan.preview.errors.join("; ")}`);
    }
    if (
      mode === "agent_safe"
      && (
        plan.preview.plan.companyAction === "update"
        || plan.preview.plan.agentPlans.some((entry) => entry.action === "update")
        || plan.preview.plan.projectPlans.some((entry) => entry.action === "update")
      )
    ) {
      throw unprocessable("Safe import routes only allow create or skip actions.");
    }

    const sourceManifest = plan.source.manifest;
    const warnings = [...plan.preview.warnings];
    const include = plan.include;

    let targetCompany: { id: string; name: string } | null = null;
    let companyAction: "created" | "updated" | "unchanged" = "unchanged";

    if (input.target.mode === "new_company") {
      if (mode === "agent_safe" && !options?.sourceCompanyId) {
        throw unprocessable("Safe new-company imports require a source company context.");
      }
      if (mode === "agent_safe" && options?.sourceCompanyId) {
        const sourceMemberships = await $.access.listActiveUserMemberships(options.sourceCompanyId);
        if (sourceMemberships.length === 0) {
          throw unprocessable("Safe new-company import requires at least one active user membership on the source company.");
        }
      }
      const companyName =
        asString(input.target.newCompanyName) ??
        sourceManifest.company?.name ??
        sourceManifest.source?.companyName ??
        "Imported Company";
      const created = await $.companies.create({
        name: companyName,
        description: include.company ? (sourceManifest.company?.description ?? null) : null,
        brandColor: include.company ? (sourceManifest.company?.brandColor ?? null) : null,
        requireBoardApprovalForNewAgents: include.company
          ? (sourceManifest.company?.requireBoardApprovalForNewAgents ?? true)
          : true,
      });
      if (mode === "agent_safe" && options?.sourceCompanyId) {
        await $.access.copyActiveUserMemberships(options.sourceCompanyId, created.id);
      } else {
        await $.access.ensureMembership(created.id, "user", actorUserId ?? "board", "owner", "active");
      }
      targetCompany = created;
      companyAction = "created";
    } else {
      targetCompany = await $.companies.getById(input.target.companyId);
      if (!targetCompany) throw notFound("Target company not found");
      if (include.company && sourceManifest.company && mode === "board_full") {
        const updated = await $.companies.update(targetCompany.id, {
          name: sourceManifest.company.name,
          description: sourceManifest.company.description,
          brandColor: sourceManifest.company.brandColor,
          requireBoardApprovalForNewAgents: sourceManifest.company.requireBoardApprovalForNewAgents,
        });
        targetCompany = updated ?? targetCompany;
        companyAction = "updated";
      }
    }

    if (!targetCompany) throw notFound("Target company not found");

    if (include.company) {
      const logoPath = sourceManifest.company?.logoPath ?? null;
      if (!logoPath) {
        const cleared = await $.companies.update(targetCompany.id, { logoAssetId: null });
        targetCompany = cleared ?? targetCompany;
      } else {
        const logoFile = plan.source.files[logoPath];
        if (!logoFile) {
          warnings.push(`Skipped company logo import because ${logoPath} is missing from the package.`);
        } else if (!$.storage) {
          warnings.push("Skipped company logo import because storage is unavailable.");
        } else {
          const contentType = isPortableBinaryFile(logoFile)
            ? (logoFile.contentType ?? inferContentTypeFromPath(logoPath))
            : inferContentTypeFromPath(logoPath);
          if (!contentType || !COMPANY_LOGO_CONTENT_TYPE_EXTENSIONS[contentType]) {
            warnings.push(`Skipped company logo import for ${logoPath} because the file type is unsupported.`);
          } else {
            try {
              const body = portableFileToBuffer(logoFile, logoPath);
              const stored = await $.storage.putFile({
                companyId: targetCompany.id,
                namespace: "assets/companies",
                originalFilename: path.posix.basename(logoPath),
                contentType,
                body,
              });
              const createdAsset = await $.assetRecords.create(targetCompany.id, {
                provider: stored.provider,
                objectKey: stored.objectKey,
                contentType: stored.contentType,
                byteSize: stored.byteSize,
                sha256: stored.sha256,
                originalFilename: stored.originalFilename,
                createdByAgentId: null,
                createdByUserId: actorUserId ?? null,
              });
              const updated = await $.companies.update(targetCompany.id, {
                logoAssetId: createdAsset.id,
              });
              targetCompany = updated ?? targetCompany;
            } catch (err) {
              warnings.push(`Failed to import company logo ${logoPath}: ${err instanceof Error ? err.message : String(err)}`);
            }
          }
        }
      }
    }

    const resultAgents: CompanyPortabilityImportResult["agents"] = [];
    const resultProjects: CompanyPortabilityImportResult["projects"] = [];
    const importedSlugToAgentId = new Map<string, string>();
    const existingSlugToAgentId = new Map<string, string>();
    const existingAgents = await $.agents.list(targetCompany.id);
    for (const existing of existingAgents) {
      existingSlugToAgentId.set(normalizeAgentUrlKey(existing.name) ?? existing.id, existing.id);
    }
    const importedSlugToProjectId = new Map<string, string>();
    const importedProjectWorkspaceIdByProjectSlug = new Map<string, Map<string, string>>();
    const existingProjectSlugToId = new Map<string, string>();
    const existingProjects = await $.projects.list(targetCompany.id);
    for (const existing of existingProjects) {
      existingProjectSlugToId.set(existing.urlKey, existing.id);
    }

    const importedSkills = include.skills || include.agents
      ? await $.companySkills.importPackageFiles(targetCompany.id, pickTextFiles(plan.source.files), {
          onConflict: resolveSkillConflictStrategy(mode, plan.collisionStrategy),
        })
      : [];
    const desiredSkillRefMap = new Map<string, string>();
    for (const importedSkill of importedSkills) {
      desiredSkillRefMap.set(importedSkill.originalKey, importedSkill.skill.key);
      desiredSkillRefMap.set(importedSkill.originalSlug, importedSkill.skill.key);
      if (importedSkill.action === "skipped") {
        warnings.push(`Skipped skill ${importedSkill.originalSlug}; existing skill ${importedSkill.skill.slug} was kept.`);
      } else if (importedSkill.originalKey !== importedSkill.skill.key) {
        warnings.push(`Imported skill ${importedSkill.originalSlug} as ${importedSkill.skill.slug} to avoid overwriting an existing skill.`);
      }
    }

    if (include.agents) {
      for (const planAgent of plan.preview.plan.agentPlans) {
        const manifestAgent = plan.selectedAgents.find((agent) => agent.slug === planAgent.slug);
        if (!manifestAgent) continue;
        if (planAgent.action === "skip") {
          resultAgents.push({
            slug: planAgent.slug,
            id: planAgent.existingAgentId,
            action: "skipped",
            name: planAgent.plannedName,
            reason: planAgent.reason,
          });
          continue;
        }

        const bundlePrefix = `agents/${manifestAgent.slug}/`;
        const bundleFiles = Object.fromEntries(
          Object.entries(plan.source.files)
            .filter(([filePath]) => filePath.startsWith(bundlePrefix))
            .flatMap(([filePath, content]) => typeof content === "string"
              ? [[normalizePortablePath(filePath.slice(bundlePrefix.length)), content] as const]
              : []),
        );
        const markdownRaw = bundleFiles["AGENTS.md"] ?? readPortableTextFile(plan.source.files, manifestAgent.path);
        const entryRelativePath = normalizePortablePath(manifestAgent.path).startsWith(bundlePrefix)
          ? normalizePortablePath(manifestAgent.path).slice(bundlePrefix.length)
          : "AGENTS.md";
        if (typeof markdownRaw === "string") {
          const importedInstructionsBody = parseFrontmatterMarkdown(markdownRaw).body;
          bundleFiles[entryRelativePath] = importedInstructionsBody;
          if (entryRelativePath !== "AGENTS.md") {
            bundleFiles["AGENTS.md"] = importedInstructionsBody;
          }
        }
        const fallbackPromptTemplate = asString((manifestAgent.adapterConfig as Record<string, unknown>).promptTemplate) || "";
        if (!markdownRaw && fallbackPromptTemplate) {
          bundleFiles["AGENTS.md"] = fallbackPromptTemplate;
        }
        if (!markdownRaw && !fallbackPromptTemplate) {
          warnings.push(`Missing AGENTS markdown for ${manifestAgent.slug}; imported with an empty managed bundle.`);
        }

        // Apply adapter overrides from request if present
        const adapterOverride = input.adapterOverrides?.[planAgent.slug];
        const effectiveAdapterType = adapterOverride?.adapterType ?? manifestAgent.adapterType;
        const baseAdapterConfig = adapterOverride?.adapterConfig
          ? { ...adapterOverride.adapterConfig }
          : { ...manifestAgent.adapterConfig } as Record<string, unknown>;

        const desiredSkills = (manifestAgent.skills ?? []).map((skillRef) => desiredSkillRefMap.get(skillRef) ?? skillRef);
        const adapterConfigWithSkills = writePaperclipSkillSyncPreference(
          baseAdapterConfig,
          desiredSkills,
        );
        delete adapterConfigWithSkills.promptTemplate;
        delete adapterConfigWithSkills.bootstrapPromptTemplate;
        delete adapterConfigWithSkills.instructionsFilePath;
        delete adapterConfigWithSkills.instructionsBundleMode;
        delete adapterConfigWithSkills.instructionsRootPath;
        delete adapterConfigWithSkills.instructionsEntryFile;
        const patch = {
          name: planAgent.plannedName,
          role: manifestAgent.role,
          title: manifestAgent.title,
          icon: manifestAgent.icon,
          capabilities: manifestAgent.capabilities,
          reportsTo: null,
          adapterType: effectiveAdapterType,
          adapterConfig: adapterConfigWithSkills,
          runtimeConfig: disableImportedTimerHeartbeat(manifestAgent.runtimeConfig),
          budgetMonthlyCents: manifestAgent.budgetMonthlyCents,
          permissions: manifestAgent.permissions,
          metadata: manifestAgent.metadata,
        };

        if (planAgent.action === "update" && planAgent.existingAgentId) {
          let updated = await $.agents.update(planAgent.existingAgentId, patch);
          if (!updated) {
            warnings.push(`Skipped update for missing agent ${planAgent.existingAgentId}.`);
            resultAgents.push({
              slug: planAgent.slug,
              id: null,
              action: "skipped",
              name: planAgent.plannedName,
              reason: "Existing target agent not found.",
            });
            continue;
          }
          try {
            const materialized = await $.instructions.materializeManagedBundle(updated, bundleFiles, {
              clearLegacyPromptTemplate: true,
              replaceExisting: true,
            });
            updated = await $.agents.update(updated.id, { adapterConfig: materialized.adapterConfig }) ?? updated;
          } catch (err) {
            warnings.push(`Failed to materialize instructions bundle for ${manifestAgent.slug}: ${err instanceof Error ? err.message : String(err)}`);
          }
          importedSlugToAgentId.set(planAgent.slug, updated.id);
          existingSlugToAgentId.set(normalizeAgentUrlKey(updated.name) ?? updated.id, updated.id);
          resultAgents.push({
            slug: planAgent.slug,
            id: updated.id,
            action: "updated",
            name: updated.name,
            reason: planAgent.reason,
          });
          continue;
        }

        let created = await $.agents.create(targetCompany.id, patch);
        await $.access.ensureMembership(targetCompany.id, "agent", created.id, "member", "active");
        await $.access.setPrincipalPermission(
          targetCompany.id,
          "agent",
          created.id,
          "tasks:assign",
          true,
          actorUserId ?? null,
        );
        try {
          const materialized = await $.instructions.materializeManagedBundle(created, bundleFiles, {
            clearLegacyPromptTemplate: true,
            replaceExisting: true,
          });
          created = await $.agents.update(created.id, { adapterConfig: materialized.adapterConfig }) ?? created;
        } catch (err) {
          warnings.push(`Failed to materialize instructions bundle for ${manifestAgent.slug}: ${err instanceof Error ? err.message : String(err)}`);
        }
        importedSlugToAgentId.set(planAgent.slug, created.id);
        existingSlugToAgentId.set(normalizeAgentUrlKey(created.name) ?? created.id, created.id);
        resultAgents.push({
          slug: planAgent.slug,
          id: created.id,
          action: "created",
          name: created.name,
          reason: planAgent.reason,
        });
      }

      // Apply reporting links once all imported agent ids are available.
      for (const manifestAgent of plan.selectedAgents) {
        const agentId = importedSlugToAgentId.get(manifestAgent.slug);
        if (!agentId) continue;
        const managerSlug = manifestAgent.reportsToSlug;
        if (!managerSlug) continue;
        const managerId = importedSlugToAgentId.get(managerSlug) ?? existingSlugToAgentId.get(managerSlug) ?? null;
        if (!managerId || managerId === agentId) continue;
        try {
          await $.agents.update(agentId, { reportsTo: managerId });
        } catch {
          warnings.push(`Could not assign manager ${managerSlug} for imported agent ${manifestAgent.slug}.`);
        }
      }
    }

    if (include.projects) {
      for (const planProject of plan.preview.plan.projectPlans) {
        const manifestProject = sourceManifest.projects.find((project) => project.slug === planProject.slug);
        if (!manifestProject) continue;
        if (planProject.action === "skip") {
          resultProjects.push({
            slug: planProject.slug,
            id: planProject.existingProjectId,
            action: "skipped",
            name: planProject.plannedName,
            reason: planProject.reason,
          });
          continue;
        }

        const projectLeadAgentId = manifestProject.leadAgentSlug
          ? importedSlugToAgentId.get(manifestProject.leadAgentSlug)
            ?? existingSlugToAgentId.get(manifestProject.leadAgentSlug)
            ?? null
          : null;
        const projectWorkspaceIdByKey = new Map<string, string>();
        const projectPatch = {
          name: planProject.plannedName,
          description: manifestProject.description,
          leadAgentId: projectLeadAgentId,
          targetDate: manifestProject.targetDate,
          color: manifestProject.color,
          status: manifestProject.status && PROJECT_STATUSES.includes(manifestProject.status as any)
            ? manifestProject.status as typeof PROJECT_STATUSES[number]
            : "backlog",
          executionWorkspacePolicy: stripPortableProjectExecutionWorkspaceRefs(manifestProject.executionWorkspacePolicy),
        };

        let projectId: string | null = null;
        if (planProject.action === "update" && planProject.existingProjectId) {
          const updated = await $.projects.update(planProject.existingProjectId, projectPatch);
          if (!updated) {
            warnings.push(`Skipped update for missing project ${planProject.existingProjectId}.`);
            resultProjects.push({
              slug: planProject.slug,
              id: null,
              action: "skipped",
              name: planProject.plannedName,
              reason: "Existing target project not found.",
            });
            continue;
          }
          projectId = updated.id;
          importedSlugToProjectId.set(planProject.slug, updated.id);
          existingProjectSlugToId.set(updated.urlKey, updated.id);
          resultProjects.push({
            slug: planProject.slug,
            id: updated.id,
            action: "updated",
            name: updated.name,
            reason: planProject.reason,
          });
        } else {
          const created = await $.projects.create(targetCompany.id, projectPatch);
          projectId = created.id;
          importedSlugToProjectId.set(planProject.slug, created.id);
          existingProjectSlugToId.set(created.urlKey, created.id);
          resultProjects.push({
            slug: planProject.slug,
            id: created.id,
            action: "created",
            name: created.name,
            reason: planProject.reason,
          });
        }

        if (!projectId) continue;

        for (const workspace of manifestProject.workspaces) {
          const createdWorkspace = await $.projects.createWorkspace(projectId, {
            name: workspace.name,
            sourceType: workspace.sourceType ?? undefined,
            repoUrl: workspace.repoUrl ?? undefined,
            repoRef: workspace.repoRef ?? undefined,
            defaultRef: workspace.defaultRef ?? undefined,
            visibility: workspace.visibility ?? undefined,
            setupCommand: workspace.setupCommand ?? undefined,
            cleanupCommand: workspace.cleanupCommand ?? undefined,
            metadata: workspace.metadata ?? undefined,
            isPrimary: workspace.isPrimary,
          });
          if (!createdWorkspace) {
            warnings.push(`Project ${planProject.slug} workspace ${workspace.key} could not be created during import.`);
            continue;
          }
          projectWorkspaceIdByKey.set(workspace.key, createdWorkspace.id);
        }
        importedProjectWorkspaceIdByProjectSlug.set(planProject.slug, projectWorkspaceIdByKey);

        const hydratedProjectExecutionWorkspacePolicy = importPortableProjectExecutionWorkspacePolicy(
          planProject.slug,
          manifestProject.executionWorkspacePolicy,
          projectWorkspaceIdByKey,
          warnings,
        );
        if (hydratedProjectExecutionWorkspacePolicy) {
          await $.projects.update(projectId, {
            executionWorkspacePolicy: hydratedProjectExecutionWorkspacePolicy,
          });
        }
      }
    }

    if (include.issues) {
      const routines = routineService(db);
      for (const manifestIssue of sourceManifest.issues) {
        const markdownRaw = readPortableTextFile(plan.source.files, manifestIssue.path);
        const parsed = markdownRaw ? parseFrontmatterMarkdown(markdownRaw) : null;
        const description = parsed?.body || manifestIssue.description || null;
        const assigneeAgentId = manifestIssue.assigneeAgentSlug
          ? importedSlugToAgentId.get(manifestIssue.assigneeAgentSlug)
            ?? existingSlugToAgentId.get(manifestIssue.assigneeAgentSlug)
            ?? null
          : null;
        const projectId = manifestIssue.projectSlug
          ? importedSlugToProjectId.get(manifestIssue.projectSlug)
            ?? existingProjectSlugToId.get(manifestIssue.projectSlug)
            ?? null
          : null;
        const projectWorkspaceId = manifestIssue.projectSlug && manifestIssue.projectWorkspaceKey
          ? importedProjectWorkspaceIdByProjectSlug.get(manifestIssue.projectSlug)?.get(manifestIssue.projectWorkspaceKey) ?? null
          : null;
        if (manifestIssue.projectWorkspaceKey && !projectWorkspaceId) {
          warnings.push(`Task ${manifestIssue.slug} references workspace key ${manifestIssue.projectWorkspaceKey}, but that workspace was not imported.`);
        }
        if (manifestIssue.recurring) {
          if (!projectId || !assigneeAgentId) {
            throw unprocessable(`Recurring task ${manifestIssue.slug} is missing the project or assignee required to create a routine.`);
          }
          const resolvedRoutine = resolvePortableRoutineDefinition(manifestIssue, parsed?.frontmatter.schedule);
          if (resolvedRoutine.errors.length > 0) {
            throw unprocessable(`Recurring task ${manifestIssue.slug} could not be imported as a routine: ${resolvedRoutine.errors.join("; ")}`);
          }
          warnings.push(...resolvedRoutine.warnings);
          const routineDefinition = resolvedRoutine.routine ?? {
            concurrencyPolicy: null,
            catchUpPolicy: null,
            triggers: [],
          };
          const createdRoutine = await routines.create(targetCompany.id, {
            projectId,
            goalId: null,
            parentIssueId: null,
            title: manifestIssue.title,
            description,
            assigneeAgentId,
            priority: manifestIssue.priority && ISSUE_PRIORITIES.includes(manifestIssue.priority as any)
              ? manifestIssue.priority as typeof ISSUE_PRIORITIES[number]
              : "medium",
            status: manifestIssue.status && ROUTINE_STATUSES.includes(manifestIssue.status as any)
              ? manifestIssue.status as typeof ROUTINE_STATUSES[number]
              : "active",
            concurrencyPolicy:
              routineDefinition.concurrencyPolicy && ROUTINE_CONCURRENCY_POLICIES.includes(routineDefinition.concurrencyPolicy as any)
                ? routineDefinition.concurrencyPolicy as typeof ROUTINE_CONCURRENCY_POLICIES[number]
                : "coalesce_if_active",
            catchUpPolicy:
              routineDefinition.catchUpPolicy && ROUTINE_CATCH_UP_POLICIES.includes(routineDefinition.catchUpPolicy as any)
                ? routineDefinition.catchUpPolicy as typeof ROUTINE_CATCH_UP_POLICIES[number]
                : "skip_missed",
          }, {
            agentId: null,
            userId: actorUserId ?? null,
          });
          for (const trigger of routineDefinition.triggers) {
            if (trigger.kind === "schedule") {
              await routines.createTrigger(createdRoutine.id, {
                kind: "schedule",
                label: trigger.label,
                enabled: trigger.enabled,
                cronExpression: trigger.cronExpression!,
                timezone: trigger.timezone!,
              }, {
                agentId: null,
                userId: actorUserId ?? null,
              });
              continue;
            }
            if (trigger.kind === "webhook") {
              await routines.createTrigger(createdRoutine.id, {
                kind: "webhook",
                label: trigger.label,
                enabled: trigger.enabled,
                signingMode:
                  trigger.signingMode && ROUTINE_TRIGGER_SIGNING_MODES.includes(trigger.signingMode as any)
                    ? trigger.signingMode as typeof ROUTINE_TRIGGER_SIGNING_MODES[number]
                    : "bearer",
                replayWindowSec: trigger.replayWindowSec ?? 300,
              }, {
                agentId: null,
                userId: actorUserId ?? null,
              });
              continue;
            }
            await routines.createTrigger(createdRoutine.id, {
              kind: "api",
              label: trigger.label,
              enabled: trigger.enabled,
            }, {
              agentId: null,
              userId: actorUserId ?? null,
            });
          }
          continue;
        }
        await $.issues.create(targetCompany.id, {
          projectId,
          projectWorkspaceId,
          title: manifestIssue.title,
          description,
          assigneeAgentId,
          status: manifestIssue.status && ISSUE_STATUSES.includes(manifestIssue.status as any)
            ? manifestIssue.status as typeof ISSUE_STATUSES[number]
            : "backlog",
          priority: manifestIssue.priority && ISSUE_PRIORITIES.includes(manifestIssue.priority as any)
            ? manifestIssue.priority as typeof ISSUE_PRIORITIES[number]
            : "medium",
          billingCode: manifestIssue.billingCode,
          assigneeAdapterOverrides: manifestIssue.assigneeAdapterOverrides,
          executionWorkspaceSettings: manifestIssue.executionWorkspaceSettings,
          labelIds: [],
        });
      }
    }

    return {
      company: {
        id: targetCompany.id,
        name: targetCompany.name,
        action: companyAction,
      },
      agents: resultAgents,
      projects: resultProjects,
      envInputs: sourceManifest.envInputs ?? [],
      warnings,
    };
  }

  return { buildPreview, previewImport, importBundle };
}
