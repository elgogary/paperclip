import path from "node:path";
import type { Db } from "@paperclipai/db";
import type {
  CompanyPortabilityExport,
  CompanyPortabilityExportPreviewResult,
  CompanyPortabilityExportResult,
  CompanyPortabilityFileEntry,
  CompanyPortabilityManifest,
  CompanySkill,
} from "@paperclipai/shared";
import {
  deriveProjectUrlKey,
  normalizeAgentUrlKey,
  asString,
  isPlainRecord,
  normalizePortablePath,
  normalizeSkillSlug,
  normalizeSkillKey,
} from "@paperclipai/shared";
import {
  readPaperclipSkillSyncPreference,
} from "@paperclipai/adapter-utils/server-utils";
import type { StorageService } from "../storage/types.js";
import { notFound } from "../errors.js";
import { generateReadme } from "./company-export-readme.js";
import { renderOrgChartPng } from "../routes/org-chart-svg.js";
import { projectService } from "./projects.js";
import { issueService } from "./issues.js";
import { routineService } from "./routines.js";
import {
  normalizeInclude,
  toSafeSlug,
  uniqueSlug,
  stripEmptyValues,
  classifyPortableFileKind,
  filterExportFiles,
  normalizePortableSidebarOrder,
  sortAgentsBySidebarOrder,
  extractPortableEnvInputs,
  dedupeEnvInputs,
  buildEnvInputMap,
  normalizePortableConfig,
  pruneDefaultLikeValue,
  streamToBuffer,
  bufferToPortableBinaryFile,
  resolveCompanyLogoExtension,
  isAbsoluteCommand,
  containsAbsolutePathFragment,
  containsSystemDependentPathValue,
  clonePortableRecord,
  derivePortableProjectWorkspaceKey,
  exportPortableProjectExecutionWorkspacePolicy,
  ADAPTER_DEFAULT_RULES_BY_TYPE,
  RUNTIME_DEFAULT_RULES,
  COMPANY_LOGO_CONTENT_TYPE_EXTENSIONS,
  COMPANY_LOGO_FILE_NAME,
  buildOrgTreeFromManifest,
  buildMarkdown,
} from "./portability-helpers.js";
import { buildYamlFile } from "./portability-yaml-render.js";
import {
  buildSkillExportDirMap,
  shouldReferenceSkillOnExport,
  buildReferencedSkillMarkdown,
  withSkillSourceMetadata,
} from "./portability-skills.js";
import { buildManifestFromPackageFiles } from "./portability-manifest.js";

/* ------------------------------------------------------------------ */
/*  Standalone helpers used ONLY by export                            */
/* ------------------------------------------------------------------ */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function readGitOutput(cwd: string, args: string[]) {
  const { stdout } = await execFileAsync("git", ["-C", cwd, ...args], { cwd });
  const trimmed = stdout.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function inferPortableWorkspaceGitMetadata(workspace: NonNullable<ProjectLike["workspaces"]>[number]) {
  const cwd = asString(workspace.cwd);
  if (!cwd) {
    return {
      repoUrl: null,
      repoRef: null,
      defaultRef: null,
    };
  }

  let repoUrl: string | null = null;
  try {
    repoUrl = await readGitOutput(cwd, ["remote", "get-url", "origin"]);
  } catch {
    try {
      const firstRemote = await readGitOutput(cwd, ["remote"]);
      const remoteName = firstRemote?.split("\n").map((entry) => entry.trim()).find(Boolean) ?? null;
      if (remoteName) {
        repoUrl = await readGitOutput(cwd, ["remote", "get-url", remoteName]);
      }
    } catch {
      repoUrl = null;
    }
  }

  let repoRef: string | null = null;
  try {
    repoRef = await readGitOutput(cwd, ["branch", "--show-current"]);
  } catch {
    repoRef = null;
  }

  let defaultRef: string | null = null;
  try {
    const remoteHead = await readGitOutput(cwd, ["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"]);
    defaultRef = remoteHead?.startsWith("origin/") ? remoteHead.slice("origin/".length) : remoteHead;
  } catch {
    defaultRef = null;
  }

  return {
    repoUrl,
    repoRef,
    defaultRef,
  };
}

type ProjectLike = {
  id: string;
  name: string;
  description: string | null;
  leadAgentId: string | null;
  targetDate: string | null;
  color: string | null;
  status: string;
  executionWorkspacePolicy: Record<string, unknown> | null;
  workspaces?: Array<{
    id: string;
    name: string;
    sourceType: string;
    cwd: string | null;
    repoUrl: string | null;
    repoRef: string | null;
    defaultRef: string | null;
    visibility: string;
    setupCommand: string | null;
    cleanupCommand: string | null;
    metadata?: Record<string, unknown> | null;
    isPrimary: boolean;
  }>;
  metadata?: Record<string, unknown> | null;
};

import type {
  CompanyPortabilityProjectWorkspaceManifestEntry,
} from "@paperclipai/shared";

async function buildPortableProjectWorkspaces(
  projectSlug: string,
  workspaces: ProjectLike["workspaces"] | undefined,
  warnings: string[],
) {
  const exportedWorkspaces: Record<string, Record<string, unknown>> = {};
  const manifestWorkspaces: CompanyPortabilityProjectWorkspaceManifestEntry[] = [];
  const workspaceKeyById = new Map<string, string>();
  const workspaceKeyBySignature = new Map<string, string>();
  const manifestWorkspaceByKey = new Map<string, CompanyPortabilityProjectWorkspaceManifestEntry>();
  const usedKeys = new Set<string>();

  for (const workspace of workspaces ?? []) {
    const inferredGitMetadata =
      !asString(workspace.repoUrl) || !asString(workspace.repoRef) || !asString(workspace.defaultRef)
        ? await inferPortableWorkspaceGitMetadata(workspace)
        : { repoUrl: null, repoRef: null, defaultRef: null };
    const repoUrl = asString(workspace.repoUrl) ?? inferredGitMetadata.repoUrl;
    if (!repoUrl) {
      warnings.push(`Project ${projectSlug} workspace ${workspace.name} was omitted from export because it does not have a portable repoUrl.`);
      continue;
    }
    const repoRef = asString(workspace.repoRef) ?? inferredGitMetadata.repoRef;
    const defaultRef = asString(workspace.defaultRef) ?? inferredGitMetadata.defaultRef ?? repoRef;
    const workspaceSignature = JSON.stringify({
      name: workspace.name,
      repoUrl,
      repoRef,
      defaultRef,
    });
    const existingWorkspaceKey = workspaceKeyBySignature.get(workspaceSignature);
    if (existingWorkspaceKey) {
      workspaceKeyById.set(workspace.id, existingWorkspaceKey);
      const existingManifestWorkspace = manifestWorkspaceByKey.get(existingWorkspaceKey);
      if (existingManifestWorkspace && workspace.isPrimary) {
        existingManifestWorkspace.isPrimary = true;
        const existingExtensionWorkspace = exportedWorkspaces[existingWorkspaceKey];
        if (isPlainRecord(existingExtensionWorkspace)) existingExtensionWorkspace.isPrimary = true;
      }
      continue;
    }

    const workspaceKey = derivePortableProjectWorkspaceKey(workspace, usedKeys);
    workspaceKeyById.set(workspace.id, workspaceKey);
    workspaceKeyBySignature.set(workspaceSignature, workspaceKey);

    let setupCommand = asString(workspace.setupCommand);
    if (setupCommand && containsAbsolutePathFragment(setupCommand)) {
      warnings.push(`Project ${projectSlug} workspace ${workspaceKey} setupCommand was omitted from export because it is system-dependent.`);
      setupCommand = null;
    }

    let cleanupCommand = asString(workspace.cleanupCommand);
    if (cleanupCommand && containsAbsolutePathFragment(cleanupCommand)) {
      warnings.push(`Project ${projectSlug} workspace ${workspaceKey} cleanupCommand was omitted from export because it is system-dependent.`);
      cleanupCommand = null;
    }

    const metadata = isPlainRecord(workspace.metadata) && !containsSystemDependentPathValue(workspace.metadata)
      ? workspace.metadata
      : null;
    if (isPlainRecord(workspace.metadata) && metadata == null) {
      warnings.push(`Project ${projectSlug} workspace ${workspaceKey} metadata was omitted from export because it contains system-dependent paths.`);
    }

    const portableWorkspace = stripEmptyValues({
      name: workspace.name,
      sourceType: workspace.sourceType,
      repoUrl,
      repoRef,
      defaultRef,
      visibility: asString(workspace.visibility),
      setupCommand,
      cleanupCommand,
      metadata,
      isPrimary: workspace.isPrimary ? true : undefined,
    });
    if (!isPlainRecord(portableWorkspace)) continue;

    exportedWorkspaces[workspaceKey] = portableWorkspace;
    const manifestWorkspace = {
      key: workspaceKey,
      name: workspace.name,
      sourceType: asString(workspace.sourceType),
      repoUrl,
      repoRef,
      defaultRef,
      visibility: asString(workspace.visibility),
      setupCommand,
      cleanupCommand,
      metadata,
      isPrimary: workspace.isPrimary,
    };
    manifestWorkspaces.push(manifestWorkspace);
    manifestWorkspaceByKey.set(workspaceKey, manifestWorkspace);
  }

  return {
    extension: Object.keys(exportedWorkspaces).length > 0 ? exportedWorkspaces : undefined,
    manifest: manifestWorkspaces,
    workspaceKeyById,
  };
}

/* ------------------------------------------------------------------ */
/*  Service deps type                                                  */
/* ------------------------------------------------------------------ */

type ExportServices = {
  companies: { getById(id: string): Promise<any> };
  agents: { list(companyId: string, opts?: any): Promise<any[]> };
  assetRecords: { getById(id: string): Promise<any> };
  instructions: { exportFiles(agent: any): Promise<{ files: Record<string, string>; entryFile: string; warnings: string[] }> };
  access: Record<string, any>;
  projects: { list(companyId: string): Promise<any[]> };
  issues: { list(companyId: string, opts?: any): Promise<any[]>; getById(id: string): Promise<any>; getByIdentifier(identifier: string): Promise<any> };
  companySkills: { listFull(companyId: string): Promise<CompanySkill[]>; readFile(companyId: string, skillId: string, path: string): Promise<{ content: string }> };
  storage: StorageService | undefined;
};

/* ------------------------------------------------------------------ */
/*  Factory                                                            */
/* ------------------------------------------------------------------ */

export function createExportOps(db: Db, $: ExportServices) {

  async function exportBundle(
    companyId: string,
    input: CompanyPortabilityExport,
  ): Promise<CompanyPortabilityExportResult> {
    const include = normalizeInclude({
      ...input.include,
      agents: input.agents && input.agents.length > 0 ? true : input.include?.agents,
      projects: input.projects && input.projects.length > 0 ? true : input.include?.projects,
      issues:
        (input.issues && input.issues.length > 0) || (input.projectIssues && input.projectIssues.length > 0)
          ? true
          : input.include?.issues,
      skills: input.skills && input.skills.length > 0 ? true : input.include?.skills,
    });
    const company = await $.companies.getById(companyId);
    if (!company) throw notFound("Company not found");

    const files: Record<string, CompanyPortabilityFileEntry> = {};
    const warnings: string[] = [];
    const envInputs: CompanyPortabilityManifest["envInputs"] = [];
    const requestedSidebarOrder = normalizePortableSidebarOrder(input.sidebarOrder);
    const rootPath = normalizeAgentUrlKey(company.name) ?? "company-package";
    let companyLogoPath: string | null = null;

    const allAgentRows = include.agents ? await $.agents.list(companyId, { includeTerminated: true }) : [];
    const liveAgentRows = allAgentRows.filter((agent: any) => agent.status !== "terminated");
    const companySkillRows = include.skills || include.agents ? await $.companySkills.listFull(companyId) : [];
    if (include.agents) {
      const skipped = allAgentRows.length - liveAgentRows.length;
      if (skipped > 0) {
        warnings.push(`Skipped ${skipped} terminated agent${skipped === 1 ? "" : "s"} from export.`);
      }
    }

    const agentByReference = new Map<string, typeof liveAgentRows[number]>();
    for (const agent of liveAgentRows) {
      agentByReference.set(agent.id, agent);
      agentByReference.set(agent.name, agent);
      const normalizedName = normalizeAgentUrlKey(agent.name);
      if (normalizedName) {
        agentByReference.set(normalizedName, agent);
      }
    }

    const selectedAgents = new Map<string, typeof liveAgentRows[number]>();
    for (const selector of input.agents ?? []) {
      const trimmed = selector.trim();
      if (!trimmed) continue;
      const normalized = normalizeAgentUrlKey(trimmed) ?? trimmed;
      const match = agentByReference.get(trimmed) ?? agentByReference.get(normalized);
      if (!match) {
        warnings.push(`Agent selector "${selector}" was not found and was skipped.`);
        continue;
      }
      selectedAgents.set(match.id, match);
    }

    if (include.agents && selectedAgents.size === 0) {
      for (const agent of liveAgentRows) {
        selectedAgents.set(agent.id, agent);
      }
    }

    const agentRows = Array.from(selectedAgents.values())
      .sort((left, right) => left.name.localeCompare(right.name));

    const usedSlugs = new Set<string>();
    const idToSlug = new Map<string, string>();
    for (const agent of agentRows) {
      const baseSlug = toSafeSlug(agent.name, "agent");
      const slug = uniqueSlug(baseSlug, usedSlugs);
      idToSlug.set(agent.id, slug);
    }

    const projectsSvc = projectService(db);
    const issuesSvc = issueService(db);
    const routinesSvc = routineService(db);
    const allProjectsRaw = include.projects || include.issues ? await projectsSvc.list(companyId) : [];
    const allProjects = allProjectsRaw.filter((project: any) => !project.archivedAt);
    const allRoutines = include.issues ? await routinesSvc.list(companyId) : [];
    const projectById = new Map(allProjects.map((project: any) => [project.id, project]));
    const projectByReference = new Map<string, typeof allProjects[number]>();
    for (const project of allProjects) {
      projectByReference.set(project.id, project);
      projectByReference.set(project.urlKey, project);
    }

    const selectedProjects = new Map<string, typeof allProjects[number]>();
    const normalizeProjectSelector = (selector: string) => selector.trim().toLowerCase();
    for (const selector of input.projects ?? []) {
      const match = projectByReference.get(selector) ?? projectByReference.get(normalizeProjectSelector(selector));
      if (!match) {
        warnings.push(`Project selector "${selector}" was not found and was skipped.`);
        continue;
      }
      selectedProjects.set(match.id, match);
    }

    const selectedIssues = new Map<string, Awaited<ReturnType<typeof issuesSvc.getById>>>();
    const selectedRoutines = new Map<string, typeof allRoutines[number]>();
    const routineById = new Map(allRoutines.map((routine: any) => [routine.id, routine]));
    const resolveIssueBySelector = async (selector: string) => {
      const trimmed = selector.trim();
      if (!trimmed) return null;
      return trimmed.includes("-")
        ? issuesSvc.getByIdentifier(trimmed)
        : issuesSvc.getById(trimmed);
    };
    for (const selector of input.issues ?? []) {
      const issue = await resolveIssueBySelector(selector);
      if (!issue || issue.companyId !== companyId) {
        const routine = routineById.get(selector.trim());
        if (routine) {
          selectedRoutines.set(routine.id, routine);
          if (routine.projectId) {
            const parentProject = projectById.get(routine.projectId);
            if (parentProject) selectedProjects.set(parentProject.id, parentProject);
          }
          continue;
        }
        warnings.push(`Issue selector "${selector}" was not found and was skipped.`);
        continue;
      }
      selectedIssues.set(issue.id, issue);
      if (issue.projectId) {
        const parentProject = projectById.get(issue.projectId);
        if (parentProject) selectedProjects.set(parentProject.id, parentProject);
      }
    }

    for (const selector of input.projectIssues ?? []) {
      const match = projectByReference.get(selector) ?? projectByReference.get(normalizeProjectSelector(selector));
      if (!match) {
        warnings.push(`Project-issues selector "${selector}" was not found and was skipped.`);
        continue;
      }
      selectedProjects.set(match.id, match);
      const projectIssues = await issuesSvc.list(companyId, { projectId: match.id });
      for (const issue of projectIssues) {
        selectedIssues.set(issue.id, issue);
      }
      for (const routine of allRoutines.filter((entry: any) => entry.projectId === match.id)) {
        selectedRoutines.set(routine.id, routine);
      }
    }

    if (include.projects && selectedProjects.size === 0) {
      for (const project of allProjects) {
        selectedProjects.set(project.id, project);
      }
    }

    if (include.issues && selectedIssues.size === 0) {
      const allIssues = await issuesSvc.list(companyId);
      for (const issue of allIssues) {
        selectedIssues.set(issue.id, issue);
        if (issue.projectId) {
          const parentProject = projectById.get(issue.projectId);
          if (parentProject) selectedProjects.set(parentProject.id, parentProject);
        }
      }
      if (selectedRoutines.size === 0) {
        for (const routine of allRoutines) {
          selectedRoutines.set(routine.id, routine);
          if (routine.projectId) {
            const parentProject = projectById.get(routine.projectId);
            if (parentProject) selectedProjects.set(parentProject.id, parentProject);
          }
        }
      }
    }

    const selectedProjectRows = Array.from(selectedProjects.values())
      .sort((left, right) => left.name.localeCompare(right.name));
    const selectedIssueRows = Array.from(selectedIssues.values())
      .filter((issue): issue is NonNullable<typeof issue> => issue != null)
      .sort((left, right) => (left.identifier ?? left.title).localeCompare(right.identifier ?? right.title));
    const selectedRoutineSummaries = Array.from(selectedRoutines.values())
      .sort((left, right) => left.title.localeCompare(right.title));
    const selectedRoutineRows = (
      await Promise.all(selectedRoutineSummaries.map((routine: any) => routinesSvc.getDetail(routine.id)))
    ).filter((routine: any): routine is NonNullable<typeof routine> => routine !== null);

    const taskSlugByIssueId = new Map<string, string>();
    const taskSlugByRoutineId = new Map<string, string>();
    const usedTaskSlugs = new Set<string>();
    for (const issue of selectedIssueRows) {
      const baseSlug = normalizeAgentUrlKey(issue.identifier ?? issue.title) ?? "task";
      taskSlugByIssueId.set(issue.id, uniqueSlug(baseSlug, usedTaskSlugs));
    }
    for (const routine of selectedRoutineRows) {
      const baseSlug = normalizeAgentUrlKey(routine.title) ?? "task";
      taskSlugByRoutineId.set(routine.id, uniqueSlug(baseSlug, usedTaskSlugs));
    }

    const projectSlugById = new Map<string, string>();
    const projectWorkspaceKeyByProjectId = new Map<string, Map<string, string>>();
    const usedProjectSlugs = new Set<string>();
    for (const project of selectedProjectRows) {
      const baseSlug = deriveProjectUrlKey(project.name, project.name);
      projectSlugById.set(project.id, uniqueSlug(baseSlug, usedProjectSlugs));
    }
    const sidebarOrder = requestedSidebarOrder ?? stripEmptyValues({
      agents: sortAgentsBySidebarOrder(Array.from(selectedAgents.values()))
        .map((agent: any) => idToSlug.get(agent.id))
        .filter((slug): slug is string => Boolean(slug)),
      projects: selectedProjectRows
        .map((project: any) => projectSlugById.get(project.id))
        .filter((slug): slug is string => Boolean(slug)),
    });

    const companyPath = "COMPANY.md";
    files[companyPath] = buildMarkdown(
      {
        name: company.name,
        description: company.description ?? null,
        schema: "agentcompanies/v1",
        slug: rootPath,
      },
      "",
    );

    if (include.company && company.logoAssetId) {
      if (!$.storage) {
        warnings.push("Skipped company logo from export because storage is unavailable.");
      } else {
        const logoAsset = await $.assetRecords.getById(company.logoAssetId);
        if (!logoAsset) {
          warnings.push(`Skipped company logo ${company.logoAssetId} because the asset record was not found.`);
        } else {
          try {
            const object = await $.storage.getObject(company.id, logoAsset.objectKey);
            const body = await streamToBuffer(object.stream);
            companyLogoPath = `images/${COMPANY_LOGO_FILE_NAME}${resolveCompanyLogoExtension(logoAsset.contentType, logoAsset.originalFilename)}`;
            files[companyLogoPath] = bufferToPortableBinaryFile(body, logoAsset.contentType);
          } catch (err) {
            warnings.push(`Failed to export company logo ${company.logoAssetId}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }
    }

    const paperclipAgentsOut: Record<string, Record<string, unknown>> = {};
    const paperclipProjectsOut: Record<string, Record<string, unknown>> = {};
    const paperclipTasksOut: Record<string, Record<string, unknown>> = {};
    const unportableTaskWorkspaceRefs = new Map<string, { workspaceId: string; taskSlugs: string[] }>();
    const paperclipRoutinesOut: Record<string, Record<string, unknown>> = {};

    const skillByReference = new Map<string, typeof companySkillRows[number]>();
    for (const skill of companySkillRows) {
      skillByReference.set(skill.id, skill);
      skillByReference.set(skill.key, skill);
      skillByReference.set(skill.slug, skill);
      skillByReference.set(skill.name, skill);
    }
    const selectedSkills = new Map<string, typeof companySkillRows[number]>();
    for (const selector of input.skills ?? []) {
      const trimmed = selector.trim();
      if (!trimmed) continue;
      const normalized = normalizeSkillKey(trimmed) ?? normalizeSkillSlug(trimmed) ?? trimmed;
      const match = skillByReference.get(trimmed) ?? skillByReference.get(normalized);
      if (!match) {
        warnings.push(`Skill selector "${selector}" was not found and was skipped.`);
        continue;
      }
      selectedSkills.set(match.id, match);
    }
    if (selectedSkills.size === 0) {
      for (const skill of companySkillRows) {
        selectedSkills.set(skill.id, skill);
      }
    }
    const selectedSkillRows = Array.from(selectedSkills.values())
      .sort((left, right) => left.key.localeCompare(right.key));

    const skillExportDirs = buildSkillExportDirMap(selectedSkillRows, company.issuePrefix);
    for (const skill of selectedSkillRows) {
      const packageDir = skillExportDirs.get(skill.key) ?? `skills/${normalizeSkillSlug(skill.slug) ?? "skill"}`;
      if (shouldReferenceSkillOnExport(skill, Boolean(input.expandReferencedSkills))) {
        files[`${packageDir}/SKILL.md`] = await buildReferencedSkillMarkdown(skill);
        continue;
      }

      for (const inventoryEntry of skill.fileInventory) {
        const fileDetail = await $.companySkills.readFile(companyId, skill.id, inventoryEntry.path).catch(() => null);
        if (!fileDetail) continue;
        const filePath = `${packageDir}/${inventoryEntry.path}`;
        files[filePath] = inventoryEntry.path === "SKILL.md"
          ? await withSkillSourceMetadata(skill, fileDetail.content)
          : fileDetail.content;
      }
    }

    if (include.agents) {
      for (const agent of agentRows) {
        const slug = idToSlug.get(agent.id)!;
        const exportedInstructions = await $.instructions.exportFiles(agent);
        warnings.push(...exportedInstructions.warnings);

        const envInputsStart = envInputs.length;
        const exportedEnvInputs = extractPortableEnvInputs(
          slug,
          (agent.adapterConfig as Record<string, unknown>).env,
          warnings,
        );
        envInputs.push(...exportedEnvInputs);
        const adapterDefaultRules = ADAPTER_DEFAULT_RULES_BY_TYPE[agent.adapterType] ?? [];
        const portableAdapterConfig = pruneDefaultLikeValue(
          normalizePortableConfig(agent.adapterConfig),
          {
            dropFalseBooleans: true,
            defaultRules: adapterDefaultRules,
          },
        ) as Record<string, unknown>;
        const portableRuntimeConfig = pruneDefaultLikeValue(
          normalizePortableConfig(agent.runtimeConfig),
          {
            dropFalseBooleans: true,
            defaultRules: RUNTIME_DEFAULT_RULES,
          },
        ) as Record<string, unknown>;
        const portablePermissions = pruneDefaultLikeValue(agent.permissions ?? {}, { dropFalseBooleans: true }) as Record<string, unknown>;
        const agentEnvInputs = dedupeEnvInputs(
          envInputs
            .slice(envInputsStart)
            .filter((inputValue) => inputValue.agentSlug === slug),
        );
        const reportsToSlug = agent.reportsTo ? (idToSlug.get(agent.reportsTo) ?? null) : null;
        const desiredSkills = readPaperclipSkillSyncPreference(
          (agent.adapterConfig as Record<string, unknown>) ?? {},
        ).desiredSkills;

        const commandValue = asString(portableAdapterConfig.command);
        if (commandValue && isAbsoluteCommand(commandValue)) {
          warnings.push(`Agent ${slug} command ${commandValue} was omitted from export because it is system-dependent.`);
          delete portableAdapterConfig.command;
        }
        for (const [relativePath, content] of Object.entries(exportedInstructions.files)) {
          const targetPath = `agents/${slug}/${relativePath}`;
          if (relativePath === exportedInstructions.entryFile) {
            files[targetPath] = buildMarkdown(
              stripEmptyValues({
                name: agent.name,
                title: agent.title ?? null,
                reportsTo: reportsToSlug,
                skills: desiredSkills.length > 0 ? desiredSkills : undefined,
              }) as Record<string, unknown>,
              content,
            );
          } else {
            files[targetPath] = content;
          }
        }

        const extension = stripEmptyValues({
          role: agent.role !== "agent" ? agent.role : undefined,
          icon: agent.icon ?? null,
          capabilities: agent.capabilities ?? null,
          adapter: {
            type: agent.adapterType,
            config: portableAdapterConfig,
          },
          runtime: portableRuntimeConfig,
          permissions: portablePermissions,
          budgetMonthlyCents: (agent.budgetMonthlyCents ?? 0) > 0 ? agent.budgetMonthlyCents : undefined,
          metadata: (agent.metadata as Record<string, unknown> | null) ?? null,
        });
        if (isPlainRecord(extension) && agentEnvInputs.length > 0) {
          extension.inputs = {
            env: buildEnvInputMap(agentEnvInputs),
          };
        }
        paperclipAgentsOut[slug] = isPlainRecord(extension) ? extension : {};
      }
    }

    for (const project of selectedProjectRows) {
      const slug = projectSlugById.get(project.id)!;
      const projectPath = `projects/${slug}/PROJECT.md`;
      const portableWorkspaces = await buildPortableProjectWorkspaces(slug, project.workspaces, warnings);
      projectWorkspaceKeyByProjectId.set(project.id, portableWorkspaces.workspaceKeyById);
      files[projectPath] = buildMarkdown(
        {
          name: project.name,
          description: project.description ?? null,
          owner: project.leadAgentId ? (idToSlug.get(project.leadAgentId) ?? null) : null,
        },
        project.description ?? "",
      );
      const extension = stripEmptyValues({
        leadAgentSlug: project.leadAgentId ? (idToSlug.get(project.leadAgentId) ?? null) : null,
        targetDate: project.targetDate ?? null,
        color: project.color ?? null,
        status: project.status,
        executionWorkspacePolicy: exportPortableProjectExecutionWorkspacePolicy(
          slug,
          project.executionWorkspacePolicy,
          portableWorkspaces.workspaceKeyById,
          warnings,
        ) ?? undefined,
        workspaces: portableWorkspaces.extension,
      });
      paperclipProjectsOut[slug] = isPlainRecord(extension) ? extension : {};
    }

    for (const issue of selectedIssueRows) {
      const taskSlug = taskSlugByIssueId.get(issue.id)!;
      const projectSlug = issue.projectId ? (projectSlugById.get(issue.projectId) ?? null) : null;
      // All tasks go in top-level tasks/ folder, never nested under projects/
      const taskPath = `tasks/${taskSlug}/TASK.md`;
      const assigneeSlug = issue.assigneeAgentId ? (idToSlug.get(issue.assigneeAgentId) ?? null) : null;
      const projectWorkspaceKey = issue.projectId && issue.projectWorkspaceId
        ? projectWorkspaceKeyByProjectId.get(issue.projectId)?.get(issue.projectWorkspaceId) ?? null
        : null;
      if (issue.projectWorkspaceId && !projectWorkspaceKey) {
        const aggregateKey = `${issue.projectId ?? "no-project"}:${issue.projectWorkspaceId}`;
        const existing = unportableTaskWorkspaceRefs.get(aggregateKey);
        if (existing) {
          existing.taskSlugs.push(taskSlug);
        } else {
          unportableTaskWorkspaceRefs.set(aggregateKey, {
            workspaceId: issue.projectWorkspaceId,
            taskSlugs: [taskSlug],
          });
        }
      }
      files[taskPath] = buildMarkdown(
        {
          name: issue.title,
          project: projectSlug,
          assignee: assigneeSlug,
        },
        issue.description ?? "",
      );
      const extension = stripEmptyValues({
        identifier: issue.identifier,
        status: issue.status,
        priority: issue.priority,
        labelIds: issue.labelIds ?? undefined,
        billingCode: issue.billingCode ?? null,
        projectWorkspaceKey: projectWorkspaceKey ?? undefined,
        executionWorkspaceSettings: issue.executionWorkspaceSettings ?? undefined,
        assigneeAdapterOverrides: issue.assigneeAdapterOverrides ?? undefined,
      });
      paperclipTasksOut[taskSlug] = isPlainRecord(extension) ? extension : {};
    }

    for (const { workspaceId, taskSlugs } of unportableTaskWorkspaceRefs.values()) {
      const preview = taskSlugs.slice(0, 4).join(", ");
      const remainder = taskSlugs.length > 4 ? ` and ${taskSlugs.length - 4} more` : "";
      warnings.push(`Tasks ${preview}${remainder} reference workspace ${workspaceId}, but that workspace could not be exported portably.`);
    }

    for (const routine of selectedRoutineRows) {
      const taskSlug = taskSlugByRoutineId.get(routine.id)!;
      const projectSlug = projectSlugById.get(routine.projectId) ?? null;
      const taskPath = `tasks/${taskSlug}/TASK.md`;
      const assigneeSlug = idToSlug.get(routine.assigneeAgentId) ?? null;
      files[taskPath] = buildMarkdown(
        {
          name: routine.title,
          project: projectSlug,
          assignee: assigneeSlug,
          recurring: true,
        },
        routine.description ?? "",
      );
      const extension = stripEmptyValues({
        status: routine.status !== "active" ? routine.status : undefined,
        priority: routine.priority !== "medium" ? routine.priority : undefined,
        concurrencyPolicy: routine.concurrencyPolicy !== "coalesce_if_active" ? routine.concurrencyPolicy : undefined,
        catchUpPolicy: routine.catchUpPolicy !== "skip_missed" ? routine.catchUpPolicy : undefined,
        triggers: routine.triggers.map((trigger: any) => stripEmptyValues({
          kind: trigger.kind,
          label: trigger.label ?? null,
          enabled: trigger.enabled ? undefined : false,
          cronExpression: trigger.kind === "schedule" ? trigger.cronExpression ?? null : undefined,
          timezone: trigger.kind === "schedule" ? trigger.timezone ?? null : undefined,
          signingMode: trigger.kind === "webhook" && trigger.signingMode !== "bearer" ? trigger.signingMode ?? null : undefined,
          replayWindowSec: trigger.kind === "webhook" && trigger.replayWindowSec !== 300
            ? trigger.replayWindowSec ?? null
            : undefined,
        })),
      });
      paperclipRoutinesOut[taskSlug] = isPlainRecord(extension) ? extension : {};
    }

    const paperclipExtensionPath = ".paperclip.yaml";
    const paperclipAgents = Object.fromEntries(
      Object.entries(paperclipAgentsOut).filter(([, value]) => isPlainRecord(value) && Object.keys(value).length > 0),
    );
    const paperclipProjects = Object.fromEntries(
      Object.entries(paperclipProjectsOut).filter(([, value]) => isPlainRecord(value) && Object.keys(value).length > 0),
    );
    const paperclipTasks = Object.fromEntries(
      Object.entries(paperclipTasksOut).filter(([, value]) => isPlainRecord(value) && Object.keys(value).length > 0),
    );
    const paperclipRoutines = Object.fromEntries(
      Object.entries(paperclipRoutinesOut).filter(([, value]) => isPlainRecord(value) && Object.keys(value).length > 0),
    );
    files[paperclipExtensionPath] = buildYamlFile(
      {
        schema: "paperclip/v1",
        company: stripEmptyValues({
          brandColor: company.brandColor ?? null,
          logoPath: companyLogoPath,
          requireBoardApprovalForNewAgents: company.requireBoardApprovalForNewAgents ? undefined : false,
        }),
        sidebar: stripEmptyValues(sidebarOrder),
        agents: Object.keys(paperclipAgents).length > 0 ? paperclipAgents : undefined,
        projects: Object.keys(paperclipProjects).length > 0 ? paperclipProjects : undefined,
        tasks: Object.keys(paperclipTasks).length > 0 ? paperclipTasks : undefined,
        routines: Object.keys(paperclipRoutines).length > 0 ? paperclipRoutines : undefined,
      },
      { preserveEmptyStrings: true },
    );

    let finalFiles = filterExportFiles(files, input.selectedFiles, paperclipExtensionPath);
    let resolved = buildManifestFromPackageFiles(finalFiles, {
      sourceLabel: {
        companyId: company.id,
        companyName: company.name,
      },
    });
    resolved.manifest.includes = {
      company: resolved.manifest.company !== null,
      agents: resolved.manifest.agents.length > 0,
      projects: resolved.manifest.projects.length > 0,
      issues: resolved.manifest.issues.length > 0,
      skills: resolved.manifest.skills.length > 0,
    };
    resolved.manifest.envInputs = dedupeEnvInputs(envInputs);
    resolved.warnings.unshift(...warnings);

    // Generate org chart PNG from manifest agents
    if (resolved.manifest.agents.length > 0) {
      try {
        const orgNodes = buildOrgTreeFromManifest(resolved.manifest.agents);
        const pngBuffer = await renderOrgChartPng(orgNodes);
        finalFiles["images/org-chart.png"] = bufferToPortableBinaryFile(pngBuffer, "image/png");
      } catch {
        // Non-fatal: export still works without the org chart image
      }
    }

    if (!input.selectedFiles || input.selectedFiles.some((entry) => normalizePortablePath(entry) === "README.md")) {
      finalFiles["README.md"] = generateReadme(resolved.manifest, {
        companyName: company.name,
        companyDescription: company.description ?? null,
      });
    }

    resolved = buildManifestFromPackageFiles(finalFiles, {
      sourceLabel: {
        companyId: company.id,
        companyName: company.name,
      },
    });
    resolved.manifest.includes = {
      company: resolved.manifest.company !== null,
      agents: resolved.manifest.agents.length > 0,
      projects: resolved.manifest.projects.length > 0,
      issues: resolved.manifest.issues.length > 0,
      skills: resolved.manifest.skills.length > 0,
    };
    resolved.manifest.envInputs = dedupeEnvInputs(envInputs);
    resolved.warnings.unshift(...warnings);

    return {
      rootPath,
      manifest: resolved.manifest,
      files: finalFiles,
      warnings: resolved.warnings,
      paperclipExtensionPath,
    };
  }

  async function previewExport(
    companyId: string,
    input: CompanyPortabilityExport,
  ): Promise<CompanyPortabilityExportPreviewResult> {
    const previewInput: CompanyPortabilityExport = {
      ...input,
      include: {
        ...input.include,
        issues:
          input.include?.issues
          ?? Boolean((input.issues && input.issues.length > 0) || (input.projectIssues && input.projectIssues.length > 0))
          ?? false,
      },
    };
    if (previewInput.include && previewInput.include.issues === undefined) {
      previewInput.include.issues = false;
    }
    const exported = await exportBundle(companyId, previewInput);
    return {
      ...exported,
      fileInventory: Object.keys(exported.files)
        .sort((left, right) => left.localeCompare(right))
        .map((filePath) => ({
          path: filePath,
          kind: classifyPortableFileKind(filePath),
        })),
      counts: {
        files: Object.keys(exported.files).length,
        agents: exported.manifest.agents.length,
        skills: exported.manifest.skills.length,
        projects: exported.manifest.projects.length,
        issues: exported.manifest.issues.length,
      },
    };
  }

  return { exportBundle, previewExport };
}
