// company-skills.ts — Thin stub. All pre-factory helpers live in sub-modules.
import { promises as fs } from "node:fs";
import path from "node:path";
import { and, asc, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { companySkills } from "@paperclipai/db";
import { readPaperclipSkillSyncPreference, writePaperclipSkillSyncPreference } from "@paperclipai/adapter-utils/server-utils";
import type { PaperclipSkillEntry } from "@paperclipai/adapter-utils/server-utils";
import type {
  CompanySkill,
  CompanySkillCompatibility,
  CompanySkillCreateRequest,
  CompanySkillDetail,
  CompanySkillFileDetail,
  CompanySkillFileInventoryEntry,
  CompanySkillImportResult,
  CompanySkillListItem,
  CompanySkillProjectScanConflict,
  CompanySkillProjectScanRequest,
  CompanySkillProjectScanResult,
  CompanySkillProjectScanSkipped,
  CompanySkillSourceType,
  CompanySkillTrustLevel,
  CompanySkillUpdateStatus,
  CompanySkillUsageAgent,
} from "@paperclipai/shared";
import { asString, isPlainRecord, normalizeAgentUrlKey, normalizePortablePath, normalizeSkillKey, normalizeSkillSlug, parseFrontmatterMarkdown } from "@paperclipai/shared";
import { findServerAdapter } from "../adapters/index.js";
import { resolvePaperclipInstanceRoot } from "../home-paths.js";
import { notFound, unprocessable } from "../errors.js";
import { agentService } from "./agents.js";
import { projectService } from "./projects.js";
import { secretService } from "./secrets.js";

// Re-export sub-module APIs (preserves import paths for consumers & tests)
export { normalizeGitHubSkillDirectory, findMissingLocalSkillIds } from "./skill-inventory.js";
export { parseSkillImportSourceInput, readLocalSkillImportFromDirectory, discoverProjectWorkspaceSkillDirectories } from "./skill-import-sources.js";

// Import helpers from sub-modules
import {
  normalizePackageFileMap,
  hashSkillValue,
  uniqueSkillSlug,
  uniqueImportedSkillKey,
  buildSkillRuntimeName,
  readCanonicalSkillKey,
  deriveCanonicalSkillKey,
  classifyInventoryKind,
  deriveTrustLevel,
  toCompanySkill,
  serializeFileInventory,
  findMissingLocalSkillIds,
  inferLanguageFromPath,
  isMarkdownPath,
  normalizeGitHubSkillDirectory,
} from "./skill-inventory.js";
import {
  resolveBundledSkillsRoot,
  matchesRequestedSkill,
  deriveImportedSkillSlug,
  deriveImportedSkillSource,
  readInlineSkillImports,
  readLocalSkillImports,
  readUrlSkillImports,
  collectLocalSkillInventory,
  walkLocalFiles,
  parseSkillImportSourceInput,
  readLocalSkillImportFromDirectory,
  discoverProjectWorkspaceSkillDirectories,
  fetchText,
  resolveGitHubCommitSha,
  resolveRawGitHubUrl,
  statPath,
} from "./skill-import-sources.js";
import {
  getSkillMeta,
  resolveSkillReference,
  resolveRequestedSkillKeysOrThrow,
  resolveDesiredSkillKeys,
  normalizeSkillDirectory,
  normalizeSourceLocatorDirectory,
  resolveManagedSkillsRoot,
  resolveLocalSkillFilePath,
  deriveSkillSourceInfo,
  enrichSkill,
  toCompanySkillListItem,
} from "./skill-resolution.js";

// ---------------------------------------------------------------------------
// Type definitions used by the factory
// ---------------------------------------------------------------------------

type CompanySkillRow = typeof companySkills.$inferSelect;

import type { ImportedSkill } from "./skill-inventory.js";

type PackageSkillConflictStrategy = "replace" | "rename" | "skip";

export type ImportPackageSkillResult = {
  skill: CompanySkill;
  action: "created" | "updated" | "skipped";
  originalKey: string;
  originalSlug: string;
  requestedRefs: string[];
  reason: string | null;
};

import type { ParsedSkillImportSource } from "./skill-import-sources.js";

type SkillSourceMeta = {
  skillKey?: string;
  sourceKind?: string;
  owner?: string;
  repo?: string;
  ref?: string;
  trackingRef?: string;
  repoSkillDir?: string;
  projectId?: string;
  projectName?: string;
  workspaceId?: string;
  workspaceName?: string;
  workspaceCwd?: string;
};

export type LocalSkillInventoryMode = "full" | "project_root";

export type ProjectSkillScanTarget = {
  projectId: string;
  projectName: string;
  workspaceId: string;
  workspaceName: string;
  workspaceCwd: string;
};

type RuntimeSkillEntryOptions = {
  materializeMissing?: boolean;
};

// ---------------------------------------------------------------------------
// Constants used by the factory
// ---------------------------------------------------------------------------

const skillInventoryRefreshPromises = new Map<string, Promise<void>>();

const PROJECT_SCAN_DIRECTORY_ROOTS = [
  "skills",
  "skills/.curated",
  "skills/.experimental",
  "skills/.system",
  ".agents/skills",
  ".agent/skills",
  ".augment/skills",
  ".claude/skills",
  ".codebuddy/skills",
  ".commandcode/skills",
  ".continue/skills",
  ".cortex/skills",
  ".crush/skills",
  ".factory/skills",
  ".goose/skills",
  ".junie/skills",
  ".iflow/skills",
  ".kilocode/skills",
  ".kiro/skills",
  ".kode/skills",
  ".mcpjam/skills",
  ".vibe/skills",
  ".mux/skills",
  ".openhands/skills",
  ".pi/skills",
  ".qoder/skills",
  ".qwen/skills",
  ".roo/skills",
  ".trae/skills",
  ".windsurf/skills",
  ".zencoder/skills",
  ".neovate/skills",
  ".pochi/skills",
  ".adal/skills",
] as const;

const PROJECT_ROOT_SKILL_SUBDIRECTORIES = [
  "references",
  "scripts",
  "assets",
] as const;

// ---------------------------------------------------------------------------
// Factory — everything below is UNCHANGED from the original file
// ---------------------------------------------------------------------------

export function companySkillService(db: Db) {
  const agents = agentService(db);
  const projects = projectService(db);
  const secretsSvc = secretService(db);

  async function ensureBundledSkills(companyId: string) {
    for (const skillsRoot of resolveBundledSkillsRoot()) {
      const stats = await fs.stat(skillsRoot).catch(() => null);
      if (!stats?.isDirectory()) continue;
      const bundledSkills = await readLocalSkillImports(companyId, skillsRoot)
        .then((skills) => skills.map((skill) => ({
          ...skill,
          key: deriveCanonicalSkillKey(companyId, {
            ...skill,
            metadata: {
              ...(skill.metadata ?? {}),
              sourceKind: "paperclip_bundled",
            },
          }),
          metadata: {
            ...(skill.metadata ?? {}),
            sourceKind: "paperclip_bundled",
          },
        })))
        .catch(() => [] as ImportedSkill[]);
      if (bundledSkills.length === 0) continue;
      return upsertImportedSkills(companyId, bundledSkills);
    }
    return [];
  }

  async function pruneMissingLocalPathSkills(companyId: string) {
    const rows = await db
      .select()
      .from(companySkills)
      .where(eq(companySkills.companyId, companyId));
    const skills = rows.map((row) => toCompanySkill(row));
    const missingIds = new Set(await findMissingLocalSkillIds(skills));
    if (missingIds.size === 0) return;

    for (const skill of skills) {
      if (!missingIds.has(skill.id)) continue;
      await db
        .delete(companySkills)
        .where(eq(companySkills.id, skill.id));
      await fs.rm(resolveRuntimeSkillMaterializedPath(companyId, skill), { recursive: true, force: true });
    }
  }

  async function ensureSkillInventoryCurrent(companyId: string) {
    const existingRefresh = skillInventoryRefreshPromises.get(companyId);
    if (existingRefresh) {
      await existingRefresh;
      return;
    }

    const refreshPromise = (async () => {
      await ensureBundledSkills(companyId);
      await pruneMissingLocalPathSkills(companyId);
    })();

    skillInventoryRefreshPromises.set(companyId, refreshPromise);
    try {
      await refreshPromise;
    } finally {
      if (skillInventoryRefreshPromises.get(companyId) === refreshPromise) {
        skillInventoryRefreshPromises.delete(companyId);
      }
    }
  }

  async function list(companyId: string): Promise<CompanySkillListItem[]> {
    const rows = await listFull(companyId);
    const agentRows = await agents.list(companyId);
    return rows.map((skill) => {
      const attachedAgentCount = agentRows.filter((agent) => {
        const desiredSkills = resolveDesiredSkillKeys(rows, agent.adapterConfig as Record<string, unknown>);
        return desiredSkills.includes(skill.key);
      }).length;
      return toCompanySkillListItem(skill, attachedAgentCount);
    });
  }

  async function listFull(companyId: string): Promise<CompanySkill[]> {
    await ensureSkillInventoryCurrent(companyId);
    const rows = await db
      .select()
      .from(companySkills)
      .where(eq(companySkills.companyId, companyId))
      .orderBy(asc(companySkills.name), asc(companySkills.key));
    return rows.map((row) => toCompanySkill(row));
  }

  async function getById(id: string) {
    const row = await db
      .select()
      .from(companySkills)
      .where(eq(companySkills.id, id))
      .then((rows) => rows[0] ?? null);
    return row ? toCompanySkill(row) : null;
  }

  async function getByKey(companyId: string, key: string) {
    const row = await db
      .select()
      .from(companySkills)
      .where(and(eq(companySkills.companyId, companyId), eq(companySkills.key, key)))
      .then((rows) => rows[0] ?? null);
    return row ? toCompanySkill(row) : null;
  }

  async function usage(companyId: string, key: string): Promise<CompanySkillUsageAgent[]> {
    const skills = await listFull(companyId);
    const agentRows = await agents.list(companyId);
    const desiredAgents = agentRows.filter((agent) => {
      const desiredSkills = resolveDesiredSkillKeys(skills, agent.adapterConfig as Record<string, unknown>);
      return desiredSkills.includes(key);
    });

    return Promise.all(
      desiredAgents.map(async (agent) => {
        const adapter = findServerAdapter(agent.adapterType);
        let actualState: string | null = null;

        if (!adapter?.listSkills) {
          actualState = "unsupported";
        } else {
          try {
            const { config: runtimeConfig } = await secretsSvc.resolveAdapterConfigForRuntime(
              agent.companyId,
              agent.adapterConfig as Record<string, unknown>,
            );
            const runtimeSkillEntries = await listRuntimeSkillEntries(agent.companyId);
            const snapshot = await adapter.listSkills({
              agentId: agent.id,
              companyId: agent.companyId,
              adapterType: agent.adapterType,
              config: {
                ...runtimeConfig,
                paperclipRuntimeSkills: runtimeSkillEntries,
              },
            });
            actualState = snapshot.entries.find((entry) => entry.key === key)?.state
              ?? (snapshot.supported ? "missing" : "unsupported");
          } catch {
            actualState = "unknown";
          }
        }

        return {
          id: agent.id,
          name: agent.name,
          urlKey: agent.urlKey,
          adapterType: agent.adapterType,
          desired: true,
          actualState,
        };
      }),
    );
  }

  async function detail(companyId: string, id: string): Promise<CompanySkillDetail | null> {
    await ensureSkillInventoryCurrent(companyId);
    const skill = await getById(id);
    if (!skill || skill.companyId !== companyId) return null;
    const usedByAgents = await usage(companyId, skill.key);
    return enrichSkill(skill, usedByAgents.length, usedByAgents);
  }

  async function updateStatus(companyId: string, skillId: string): Promise<CompanySkillUpdateStatus | null> {
    await ensureSkillInventoryCurrent(companyId);
    const skill = await getById(skillId);
    if (!skill || skill.companyId !== companyId) return null;

    if (skill.sourceType !== "github" && skill.sourceType !== "skills_sh") {
      return {
        supported: false,
        reason: "Only GitHub-managed skills support update checks.",
        trackingRef: null,
        currentRef: skill.sourceRef ?? null,
        latestRef: null,
        hasUpdate: false,
      };
    }

    const metadata = getSkillMeta(skill);
    const owner = asString(metadata.owner);
    const repo = asString(metadata.repo);
    const trackingRef = asString(metadata.trackingRef) ?? asString(metadata.ref);
    if (!owner || !repo || !trackingRef) {
      return {
        supported: false,
        reason: "This GitHub skill does not have enough metadata to track updates.",
        trackingRef: trackingRef ?? null,
        currentRef: skill.sourceRef ?? null,
        latestRef: null,
        hasUpdate: false,
      };
    }

    const latestRef = await resolveGitHubCommitSha(owner, repo, trackingRef);
    return {
      supported: true,
      reason: null,
      trackingRef,
      currentRef: skill.sourceRef ?? null,
      latestRef,
      hasUpdate: latestRef !== (skill.sourceRef ?? null),
    };
  }

  async function readFile(companyId: string, skillId: string, relativePath: string): Promise<CompanySkillFileDetail | null> {
    await ensureSkillInventoryCurrent(companyId);
    const skill = await getById(skillId);
    if (!skill || skill.companyId !== companyId) return null;

    const normalizedPath = normalizePortablePath(relativePath || "SKILL.md");
    const fileEntry = skill.fileInventory.find((entry) => entry.path === normalizedPath);
    if (!fileEntry) {
      throw notFound("Skill file not found");
    }

    const source = deriveSkillSourceInfo(skill);
    let content = "";

    if (skill.sourceType === "local_path" || skill.sourceType === "catalog") {
      const absolutePath = resolveLocalSkillFilePath(skill, normalizedPath);
      if (absolutePath) {
        content = await fs.readFile(absolutePath, "utf8");
      } else if (normalizedPath === "SKILL.md") {
        content = skill.markdown;
      } else {
        throw notFound("Skill file not found");
      }
    } else if (skill.sourceType === "github" || skill.sourceType === "skills_sh") {
      const metadata = getSkillMeta(skill);
      const owner = asString(metadata.owner);
      const repo = asString(metadata.repo);
      const ref = skill.sourceRef ?? asString(metadata.ref) ?? "main";
      const repoSkillDir = normalizeGitHubSkillDirectory(asString(metadata.repoSkillDir), skill.slug);
      if (!owner || !repo) {
        throw unprocessable("Skill source metadata is incomplete.");
      }
      const repoPath = normalizePortablePath(path.posix.join(repoSkillDir, normalizedPath));
      content = await fetchText(resolveRawGitHubUrl(owner, repo, ref, repoPath));
    } else if (skill.sourceType === "url") {
      if (normalizedPath !== "SKILL.md") {
        throw notFound("This skill source only exposes SKILL.md");
      }
      content = skill.markdown;
    } else {
      throw unprocessable("Unsupported skill source.");
    }

    return {
      skillId: skill.id,
      path: normalizedPath,
      kind: fileEntry.kind,
      content,
      language: inferLanguageFromPath(normalizedPath),
      markdown: isMarkdownPath(normalizedPath),
      editable: source.editable,
    };
  }

  async function createLocalSkill(companyId: string, input: CompanySkillCreateRequest): Promise<CompanySkill> {
    const slug = normalizeSkillSlug(input.slug ?? input.name) ?? "skill";
    const managedRoot = resolveManagedSkillsRoot(companyId);
    const skillDir = path.resolve(managedRoot, slug);
    const skillFilePath = path.resolve(skillDir, "SKILL.md");

    await fs.mkdir(skillDir, { recursive: true });

    const markdown = (input.markdown?.trim().length
      ? input.markdown
      : [
        "---",
        `name: ${input.name}`,
        ...(input.description?.trim() ? [`description: ${input.description.trim()}`] : []),
        "---",
        "",
        `# ${input.name}`,
        "",
        input.description?.trim() ? input.description.trim() : "Describe what this skill does.",
        "",
      ].join("\n"));

    await fs.writeFile(skillFilePath, markdown, "utf8");

    const parsed = parseFrontmatterMarkdown(markdown);
    const imported = await upsertImportedSkills(companyId, [{
      key: `company/${companyId}/${slug}`,
      slug,
      name: asString(parsed.frontmatter.name) ?? input.name,
      description: asString(parsed.frontmatter.description) ?? input.description?.trim() ?? null,
      markdown,
      sourceType: "local_path",
      sourceLocator: skillDir,
      sourceRef: null,
      trustLevel: "markdown_only",
      compatibility: "compatible",
      fileInventory: [{ path: "SKILL.md", kind: "skill" }],
      metadata: { sourceKind: "managed_local" },
    }]);

    return imported[0]!;
  }

  async function updateFile(companyId: string, skillId: string, relativePath: string, content: string): Promise<CompanySkillFileDetail> {
    await ensureSkillInventoryCurrent(companyId);
    const skill = await getById(skillId);
    if (!skill || skill.companyId !== companyId) throw notFound("Skill not found");

    const source = deriveSkillSourceInfo(skill);
    if (!source.editable || skill.sourceType !== "local_path") {
      throw unprocessable(source.editableReason ?? "This skill cannot be edited.");
    }

    const normalizedPath = normalizePortablePath(relativePath);
    const absolutePath = resolveLocalSkillFilePath(skill, normalizedPath);
    if (!absolutePath) throw notFound("Skill file not found");

    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, content, "utf8");

    if (normalizedPath === "SKILL.md") {
      const parsed = parseFrontmatterMarkdown(content);
      await db
        .update(companySkills)
        .set({
          name: asString(parsed.frontmatter.name) ?? skill.name,
          description: asString(parsed.frontmatter.description) ?? skill.description,
          markdown: content,
          updatedAt: new Date(),
        })
        .where(eq(companySkills.id, skill.id));
    } else {
      await db
        .update(companySkills)
        .set({ updatedAt: new Date() })
        .where(eq(companySkills.id, skill.id));
    }

    const detail = await readFile(companyId, skillId, normalizedPath);
    if (!detail) throw notFound("Skill file not found");
    return detail;
  }

  async function installUpdate(companyId: string, skillId: string): Promise<CompanySkill | null> {
    await ensureSkillInventoryCurrent(companyId);
    const skill = await getById(skillId);
    if (!skill || skill.companyId !== companyId) return null;

    const status = await updateStatus(companyId, skillId);
    if (!status?.supported) {
      throw unprocessable(status?.reason ?? "This skill does not support updates.");
    }
    if (!skill.sourceLocator) {
      throw unprocessable("Skill source locator is missing.");
    }

    const result = await readUrlSkillImports(companyId, skill.sourceLocator, skill.slug);
    const matching = result.skills.find((entry) => entry.key === skill.key) ?? result.skills[0] ?? null;
    if (!matching) {
      throw unprocessable(`Skill ${skill.key} could not be re-imported from its source.`);
    }

    const imported = await upsertImportedSkills(companyId, [matching]);
    return imported[0] ?? null;
  }

  async function scanProjectWorkspaces(
    companyId: string,
    input: CompanySkillProjectScanRequest = {},
  ): Promise<CompanySkillProjectScanResult> {
    await ensureSkillInventoryCurrent(companyId);
    const projectRows = input.projectIds?.length
      ? await projects.listByIds(companyId, input.projectIds)
      : await projects.list(companyId);
    const workspaceFilter = new Set(input.workspaceIds ?? []);
    const skipped: CompanySkillProjectScanSkipped[] = [];
    const conflicts: CompanySkillProjectScanConflict[] = [];
    const warnings: string[] = [];
    const imported: CompanySkill[] = [];
    const updated: CompanySkill[] = [];
    const availableSkills = await listFull(companyId);
    const acceptedSkills = [...availableSkills];
    const acceptedByKey = new Map(acceptedSkills.map((skill) => [skill.key, skill]));
    const scanTargets: ProjectSkillScanTarget[] = [];
    const scannedProjectIds = new Set<string>();
    let discovered = 0;

    const trackWarning = (message: string) => {
      warnings.push(message);
      return message;
    };
    const upsertAcceptedSkill = (skill: CompanySkill) => {
      const nextIndex = acceptedSkills.findIndex((entry) => entry.id === skill.id || entry.key === skill.key);
      if (nextIndex >= 0) acceptedSkills[nextIndex] = skill;
      else acceptedSkills.push(skill);
      acceptedByKey.set(skill.key, skill);
    };

    for (const project of projectRows) {
      for (const workspace of project.workspaces) {
        if (workspaceFilter.size > 0 && !workspaceFilter.has(workspace.id)) continue;
        const workspaceCwd = asString(workspace.cwd);
        if (!workspaceCwd) {
          skipped.push({
            projectId: project.id,
            projectName: project.name,
            workspaceId: workspace.id,
            workspaceName: workspace.name,
            path: null,
            reason: trackWarning(`Skipped ${project.name} / ${workspace.name}: no local workspace path is configured.`),
          });
          continue;
        }

        const workspaceStat = await statPath(workspaceCwd);
        if (!workspaceStat?.isDirectory()) {
          skipped.push({
            projectId: project.id,
            projectName: project.name,
            workspaceId: workspace.id,
            workspaceName: workspace.name,
            path: workspaceCwd,
            reason: trackWarning(`Skipped ${project.name} / ${workspace.name}: local workspace path is not available at ${workspaceCwd}.`),
          });
          continue;
        }

        scanTargets.push({
          projectId: project.id,
          projectName: project.name,
          workspaceId: workspace.id,
          workspaceName: workspace.name,
          workspaceCwd,
        });
      }
    }

    for (const target of scanTargets) {
      scannedProjectIds.add(target.projectId);
      const directories = await discoverProjectWorkspaceSkillDirectories(target);

      for (const directory of directories) {
        discovered += 1;

        let nextSkill: ImportedSkill;
        try {
          nextSkill = await readLocalSkillImportFromDirectory(companyId, directory.skillDir, {
            inventoryMode: directory.inventoryMode,
            metadata: {
              sourceKind: "project_scan",
              projectId: target.projectId,
              projectName: target.projectName,
              workspaceId: target.workspaceId,
              workspaceName: target.workspaceName,
              workspaceCwd: target.workspaceCwd,
            },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          skipped.push({
            projectId: target.projectId,
            projectName: target.projectName,
            workspaceId: target.workspaceId,
            workspaceName: target.workspaceName,
            path: directory.skillDir,
            reason: trackWarning(`Skipped ${directory.skillDir}: ${message}`),
          });
          continue;
        }

        const normalizedSourceDir = normalizeSourceLocatorDirectory(nextSkill.sourceLocator);
        const existingByKey = acceptedByKey.get(nextSkill.key) ?? null;
        if (existingByKey) {
          const existingSourceDir = normalizeSkillDirectory(existingByKey);
          if (
            existingByKey.sourceType !== "local_path"
            || !existingSourceDir
            || !normalizedSourceDir
            || existingSourceDir !== normalizedSourceDir
          ) {
            conflicts.push({
              slug: nextSkill.slug,
              key: nextSkill.key,
              projectId: target.projectId,
              projectName: target.projectName,
              workspaceId: target.workspaceId,
              workspaceName: target.workspaceName,
              path: directory.skillDir,
              existingSkillId: existingByKey.id,
              existingSkillKey: existingByKey.key,
              existingSourceLocator: existingByKey.sourceLocator,
              reason: `Skill key ${nextSkill.key} already points at ${existingByKey.sourceLocator ?? "another source"}.`,
            });
            continue;
          }

          const persisted = (await upsertImportedSkills(companyId, [nextSkill]))[0];
          if (!persisted) continue;
          updated.push(persisted);
          upsertAcceptedSkill(persisted);
          continue;
        }

        const slugConflict = acceptedSkills.find((skill) => {
          if (skill.slug !== nextSkill.slug) return false;
          return normalizeSkillDirectory(skill) !== normalizedSourceDir;
        });
        if (slugConflict) {
          conflicts.push({
            slug: nextSkill.slug,
            key: nextSkill.key,
            projectId: target.projectId,
            projectName: target.projectName,
            workspaceId: target.workspaceId,
            workspaceName: target.workspaceName,
            path: directory.skillDir,
            existingSkillId: slugConflict.id,
            existingSkillKey: slugConflict.key,
            existingSourceLocator: slugConflict.sourceLocator,
            reason: `Slug ${nextSkill.slug} is already in use by ${slugConflict.sourceLocator ?? slugConflict.key}.`,
          });
          continue;
        }

        const persisted = (await upsertImportedSkills(companyId, [nextSkill]))[0];
        if (!persisted) continue;
        imported.push(persisted);
        upsertAcceptedSkill(persisted);
      }
    }

    return {
      scannedProjects: scannedProjectIds.size,
      scannedWorkspaces: scanTargets.length,
      discovered,
      imported,
      updated,
      skipped,
      conflicts,
      warnings,
    };
  }

  async function materializeCatalogSkillFiles(
    companyId: string,
    skill: ImportedSkill,
    normalizedFiles: Record<string, string>,
  ) {
    const packageDir = skill.packageDir ? normalizePortablePath(skill.packageDir) : null;
    if (!packageDir) return null;
    const catalogRoot = path.resolve(resolveManagedSkillsRoot(companyId), "__catalog__");
    const skillDir = path.resolve(catalogRoot, buildSkillRuntimeName(skill.key, skill.slug));
    await fs.rm(skillDir, { recursive: true, force: true });
    await fs.mkdir(skillDir, { recursive: true });

    for (const entry of skill.fileInventory) {
      const sourcePath = entry.path === "SKILL.md"
        ? `${packageDir}/SKILL.md`
        : `${packageDir}/${entry.path}`;
      const content = normalizedFiles[sourcePath];
      if (typeof content !== "string") continue;
      const targetPath = path.resolve(skillDir, entry.path);
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, content, "utf8");
    }

    return skillDir;
  }

  async function materializeRuntimeSkillFiles(companyId: string, skill: CompanySkill) {
    const runtimeRoot = path.resolve(resolveManagedSkillsRoot(companyId), "__runtime__");
    const skillDir = path.resolve(runtimeRoot, buildSkillRuntimeName(skill.key, skill.slug));
    await fs.rm(skillDir, { recursive: true, force: true });
    await fs.mkdir(skillDir, { recursive: true });

    for (const entry of skill.fileInventory) {
      const detail = await readFile(companyId, skill.id, entry.path).catch(() => null);
      if (!detail) continue;
      const targetPath = path.resolve(skillDir, entry.path);
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, detail.content, "utf8");
    }

    return skillDir;
  }

  function resolveRuntimeSkillMaterializedPath(companyId: string, skill: CompanySkill) {
    const runtimeRoot = path.resolve(resolveManagedSkillsRoot(companyId), "__runtime__");
    return path.resolve(runtimeRoot, buildSkillRuntimeName(skill.key, skill.slug));
  }

  async function listRuntimeSkillEntries(
    companyId: string,
    options: RuntimeSkillEntryOptions = {},
  ): Promise<PaperclipSkillEntry[]> {
    const skills = await listFull(companyId);

    const out: PaperclipSkillEntry[] = [];
    for (const skill of skills) {
      const sourceKind = asString(getSkillMeta(skill).sourceKind);
      let source = normalizeSkillDirectory(skill);
      if (!source) {
        source = options.materializeMissing === false
          ? resolveRuntimeSkillMaterializedPath(companyId, skill)
          : await materializeRuntimeSkillFiles(companyId, skill).catch(() => null);
      }
      if (!source) continue;

      const required = sourceKind === "paperclip_bundled";
      out.push({
        key: skill.key,
        runtimeName: buildSkillRuntimeName(skill.key, skill.slug),
        source,
        required,
        requiredReason: required
          ? "Bundled Paperclip skills are always available for local adapters."
          : null,
      });
    }

    out.sort((left, right) => left.key.localeCompare(right.key));
    return out;
  }

  async function importPackageFiles(
    companyId: string,
    files: Record<string, string>,
    options?: {
      onConflict?: PackageSkillConflictStrategy;
    },
  ): Promise<ImportPackageSkillResult[]> {
    await ensureSkillInventoryCurrent(companyId);
    const normalizedFiles = normalizePackageFileMap(files);
    const importedSkills = readInlineSkillImports(companyId, normalizedFiles);
    if (importedSkills.length === 0) return [];

    for (const skill of importedSkills) {
      if (skill.sourceType !== "catalog") continue;
      const materializedDir = await materializeCatalogSkillFiles(companyId, skill, normalizedFiles);
      if (materializedDir) {
        skill.sourceLocator = materializedDir;
      }
    }

    const conflictStrategy = options?.onConflict ?? "replace";
    const existingSkills = await listFull(companyId);
    const existingByKey = new Map(existingSkills.map((skill) => [skill.key, skill]));
    const existingBySlug = new Map(
      existingSkills.map((skill) => [normalizeSkillSlug(skill.slug) ?? skill.slug, skill]),
    );
    const usedSlugs = new Set(existingBySlug.keys());
    const usedKeys = new Set(existingByKey.keys());

    const toPersist: ImportedSkill[] = [];
    const prepared: Array<{
      skill: ImportedSkill;
      originalKey: string;
      originalSlug: string;
      existingBefore: CompanySkill | null;
      actionHint: "created" | "updated";
      reason: string | null;
    }> = [];
    const out: ImportPackageSkillResult[] = [];

    for (const importedSkill of importedSkills) {
      const originalKey = importedSkill.key;
      const originalSlug = importedSkill.slug;
      const normalizedSlug = normalizeSkillSlug(importedSkill.slug) ?? importedSkill.slug;
      const existingByIncomingKey = existingByKey.get(importedSkill.key) ?? null;
      const existingByIncomingSlug = existingBySlug.get(normalizedSlug) ?? null;
      const conflict = existingByIncomingKey ?? existingByIncomingSlug;

      if (!conflict || conflictStrategy === "replace") {
        toPersist.push(importedSkill);
        prepared.push({
          skill: importedSkill,
          originalKey,
          originalSlug,
          existingBefore: existingByIncomingKey,
          actionHint: existingByIncomingKey ? "updated" : "created",
          reason: existingByIncomingKey ? "Existing skill key matched; replace strategy." : null,
        });
        usedSlugs.add(normalizedSlug);
        usedKeys.add(importedSkill.key);
        continue;
      }

      if (conflictStrategy === "skip") {
        out.push({
          skill: conflict,
          action: "skipped",
          originalKey,
          originalSlug,
          requestedRefs: Array.from(new Set([originalKey, originalSlug])),
          reason: "Existing skill matched; skip strategy.",
        });
        continue;
      }

      const renamedSlug = uniqueSkillSlug(normalizedSlug || "skill", usedSlugs);
      const renamedKey = uniqueImportedSkillKey(companyId, renamedSlug, usedKeys);
      const renamedSkill: ImportedSkill = {
        ...importedSkill,
        slug: renamedSlug,
        key: renamedKey,
        metadata: {
          ...(importedSkill.metadata ?? {}),
          skillKey: renamedKey,
          importedFromSkillKey: originalKey,
          importedFromSkillSlug: originalSlug,
        },
      };
      toPersist.push(renamedSkill);
      prepared.push({
        skill: renamedSkill,
        originalKey,
        originalSlug,
        existingBefore: null,
        actionHint: "created",
        reason: `Existing skill matched; renamed to ${renamedSlug}.`,
      });
      usedSlugs.add(renamedSlug);
      usedKeys.add(renamedKey);
    }

    if (toPersist.length === 0) return out;

    const persisted = await upsertImportedSkills(companyId, toPersist);
    for (let index = 0; index < prepared.length; index += 1) {
      const persistedSkill = persisted[index];
      const preparedSkill = prepared[index];
      if (!persistedSkill || !preparedSkill) continue;
      out.push({
        skill: persistedSkill,
        action: preparedSkill.actionHint,
        originalKey: preparedSkill.originalKey,
        originalSlug: preparedSkill.originalSlug,
        requestedRefs: Array.from(new Set([preparedSkill.originalKey, preparedSkill.originalSlug])),
        reason: preparedSkill.reason,
      });
    }

    return out;
  }

  async function upsertImportedSkills(companyId: string, imported: ImportedSkill[]): Promise<CompanySkill[]> {
    const out: CompanySkill[] = [];
    for (const skill of imported) {
      const existing = await getByKey(companyId, skill.key);
      const existingMeta = existing ? getSkillMeta(existing) : {};
      const incomingMeta = skill.metadata && isPlainRecord(skill.metadata) ? skill.metadata : {};
      const incomingOwner = asString(incomingMeta.owner);
      const incomingRepo = asString(incomingMeta.repo);
      const incomingKind = asString(incomingMeta.sourceKind);
      if (
        existing
        && existingMeta.sourceKind === "paperclip_bundled"
        && incomingKind === "github"
        && incomingOwner === "paperclipai"
        && incomingRepo === "paperclip"
      ) {
        out.push(existing);
        continue;
      }

      const metadata = {
        ...(skill.metadata ?? {}),
        skillKey: skill.key,
      };
      const values = {
        companyId,
        key: skill.key,
        slug: skill.slug,
        name: skill.name,
        description: skill.description,
        markdown: skill.markdown,
        sourceType: skill.sourceType,
        sourceLocator: skill.sourceLocator,
        sourceRef: skill.sourceRef,
        trustLevel: skill.trustLevel,
        compatibility: skill.compatibility,
        fileInventory: serializeFileInventory(skill.fileInventory),
        metadata,
        updatedAt: new Date(),
      };
      const row = existing
        ? await db
          .update(companySkills)
          .set(values)
          .where(eq(companySkills.id, existing.id))
          .returning()
          .then((rows) => rows[0] ?? null)
        : await db
          .insert(companySkills)
          .values(values)
          .returning()
          .then((rows) => rows[0] ?? null);
      if (!row) throw notFound("Failed to persist company skill");
      out.push(toCompanySkill(row));
    }
    return out;
  }

  async function importFromSource(companyId: string, source: string): Promise<CompanySkillImportResult> {
    await ensureSkillInventoryCurrent(companyId);
    const parsed = parseSkillImportSourceInput(source);
    const local = !/^https?:\/\//i.test(parsed.resolvedSource);
    const { skills, warnings } = local
      ? {
        skills: (await readLocalSkillImports(companyId, parsed.resolvedSource))
          .filter((skill) => !parsed.requestedSkillSlug || skill.slug === parsed.requestedSkillSlug),
        warnings: parsed.warnings,
      }
      : await readUrlSkillImports(companyId, parsed.resolvedSource, parsed.requestedSkillSlug)
        .then((result) => ({
          skills: result.skills,
          warnings: [...parsed.warnings, ...result.warnings],
        }));
    const filteredSkills = parsed.requestedSkillSlug
      ? skills.filter((skill) => skill.slug === parsed.requestedSkillSlug)
      : skills;
    if (filteredSkills.length === 0) {
      throw unprocessable(
        parsed.requestedSkillSlug
          ? `Skill ${parsed.requestedSkillSlug} was not found in the provided source.`
          : "No skills were found in the provided source.",
      );
    }
    // Override sourceType/sourceLocator for skills imported via skills.sh
    if (parsed.originalSkillsShUrl) {
      for (const skill of filteredSkills) {
        skill.sourceType = "skills_sh";
        skill.sourceLocator = parsed.originalSkillsShUrl;
        if (skill.metadata) {
          (skill.metadata as Record<string, unknown>).sourceKind = "skills_sh";
        }
        skill.key = deriveCanonicalSkillKey(companyId, skill);
      }
    }
    const imported = await upsertImportedSkills(companyId, filteredSkills);
    return { imported, warnings };
  }

  async function deleteSkill(companyId: string, skillId: string): Promise<CompanySkill | null> {
    const row = await db
      .select()
      .from(companySkills)
      .where(and(eq(companySkills.id, skillId), eq(companySkills.companyId, companyId)))
      .then((rows) => rows[0] ?? null);
    if (!row) return null;

    const skill = toCompanySkill(row);

    // Remove from any agent desiredSkills that reference this skill
    const agentRows = await agents.list(companyId);
    const allSkills = await listFull(companyId);
    for (const agent of agentRows) {
      const config = agent.adapterConfig as Record<string, unknown>;
      const preference = readPaperclipSkillSyncPreference(config);
      const referencesSkill = preference.desiredSkills.some((ref) => {
        const resolved = resolveSkillReference(allSkills, ref);
        return resolved.skill?.id === skillId;
      });
      if (referencesSkill) {
        const filtered = preference.desiredSkills.filter((ref) => {
          const resolved = resolveSkillReference(allSkills, ref);
          return resolved.skill?.id !== skillId;
        });
        await agents.update(agent.id, {
          adapterConfig: writePaperclipSkillSyncPreference(config, filtered),
        });
      }
    }

    // Delete DB row
    await db
      .delete(companySkills)
      .where(eq(companySkills.id, skillId));

    // Clean up materialized runtime files
    await fs.rm(resolveRuntimeSkillMaterializedPath(companyId, skill), { recursive: true, force: true });

    return skill;
  }

  return {
    list,
    listFull,
    getById,
    getByKey,
    resolveRequestedSkillKeys: async (companyId: string, requestedReferences: string[]) => {
      const skills = await listFull(companyId);
      return resolveRequestedSkillKeysOrThrow(skills, requestedReferences);
    },
    detail,
    updateStatus,
    readFile,
    updateFile,
    createLocalSkill,
    deleteSkill,
    importFromSource,
    scanProjectWorkspaces,
    importPackageFiles,
    installUpdate,
    listRuntimeSkillEntries,
  };
}
