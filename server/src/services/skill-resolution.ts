import path from "node:path";
import type {
  CompanySkill,
  CompanySkillListItem,
  CompanySkillSourceBadge,
  CompanySkillUsageAgent,
} from "@paperclipai/shared";
import {
  asString,
  isPlainRecord,
  normalizePortablePath,
  normalizeSkillSlug,
  normalizeSkillKey,
} from "@paperclipai/shared";
import { readPaperclipSkillSyncPreference } from "@paperclipai/adapter-utils/server-utils";
import { resolvePaperclipInstanceRoot } from "../home-paths.js";
import { unprocessable } from "../errors.js";

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

export function getSkillMeta(skill: CompanySkill): SkillSourceMeta {
  return isPlainRecord(skill.metadata) ? skill.metadata as SkillSourceMeta : {};
}

export function resolveSkillReference(
  skills: CompanySkill[],
  reference: string,
): { skill: CompanySkill | null; ambiguous: boolean } {
  const trimmed = reference.trim();
  if (!trimmed) {
    return { skill: null, ambiguous: false };
  }

  const byId = skills.find((skill) => skill.id === trimmed);
  if (byId) {
    return { skill: byId, ambiguous: false };
  }

  const normalizedKey = normalizeSkillKey(trimmed);
  if (normalizedKey) {
    const byKey = skills.find((skill) => skill.key === normalizedKey);
    if (byKey) {
      return { skill: byKey, ambiguous: false };
    }
  }

  const normalizedSlug = normalizeSkillSlug(trimmed);
  if (!normalizedSlug) {
    return { skill: null, ambiguous: false };
  }

  const bySlug = skills.filter((skill) => skill.slug === normalizedSlug);
  if (bySlug.length === 1) {
    return { skill: bySlug[0] ?? null, ambiguous: false };
  }
  if (bySlug.length > 1) {
    return { skill: null, ambiguous: true };
  }

  return { skill: null, ambiguous: false };
}

export function resolveRequestedSkillKeysOrThrow(
  skills: CompanySkill[],
  requestedReferences: string[],
) {
  const missing = new Set<string>();
  const ambiguous = new Set<string>();
  const resolved = new Set<string>();

  for (const reference of requestedReferences) {
    const trimmed = reference.trim();
    if (!trimmed) continue;

    const match = resolveSkillReference(skills, trimmed);
    if (match.skill) {
      resolved.add(match.skill.key);
      continue;
    }

    if (match.ambiguous) {
      ambiguous.add(trimmed);
      continue;
    }

    missing.add(trimmed);
  }

  if (ambiguous.size > 0 || missing.size > 0) {
    const problems: string[] = [];
    if (ambiguous.size > 0) {
      problems.push(`ambiguous references: ${Array.from(ambiguous).sort().join(", ")}`);
    }
    if (missing.size > 0) {
      problems.push(`unknown references: ${Array.from(missing).sort().join(", ")}`);
    }
    throw unprocessable(`Invalid company skill selection (${problems.join("; ")}).`);
  }

  return Array.from(resolved);
}

export function resolveDesiredSkillKeys(
  skills: CompanySkill[],
  config: Record<string, unknown>,
) {
  const preference = readPaperclipSkillSyncPreference(config);
  return Array.from(new Set(
    preference.desiredSkills
      .map((reference) => resolveSkillReference(skills, reference).skill?.key ?? normalizeSkillKey(reference))
      .filter((value): value is string => Boolean(value)),
  ));
}

export function normalizeSkillDirectory(skill: CompanySkill) {
  if ((skill.sourceType !== "local_path" && skill.sourceType !== "catalog") || !skill.sourceLocator) return null;
  const resolved = path.resolve(skill.sourceLocator);
  if (path.basename(resolved).toLowerCase() === "skill.md") {
    return path.dirname(resolved);
  }
  return resolved;
}

export function normalizeSourceLocatorDirectory(sourceLocator: string | null) {
  if (!sourceLocator) return null;
  const resolved = path.resolve(sourceLocator);
  return path.basename(resolved).toLowerCase() === "skill.md" ? path.dirname(resolved) : resolved;
}

export function resolveManagedSkillsRoot(companyId: string) {
  return path.resolve(resolvePaperclipInstanceRoot(), "skills", companyId);
}

export function resolveLocalSkillFilePath(skill: CompanySkill, relativePath: string) {
  const normalized = normalizePortablePath(relativePath);
  const skillDir = normalizeSkillDirectory(skill);
  if (skillDir) {
    return path.resolve(skillDir, normalized);
  }

  if (!skill.sourceLocator) return null;
  const fallbackRoot = path.resolve(skill.sourceLocator);
  const directPath = path.resolve(fallbackRoot, normalized);
  return directPath;
}

export function deriveSkillSourceInfo(skill: CompanySkill): {
  editable: boolean;
  editableReason: string | null;
  sourceLabel: string | null;
  sourceBadge: CompanySkillSourceBadge;
  sourcePath: string | null;
} {
  const metadata = getSkillMeta(skill);
  const localSkillDir = normalizeSkillDirectory(skill);
  if (metadata.sourceKind === "paperclip_bundled") {
    return {
      editable: false,
      editableReason: "Bundled Paperclip skills are read-only.",
      sourceLabel: "Paperclip bundled",
      sourceBadge: "paperclip",
      sourcePath: null,
    };
  }

  if (skill.sourceType === "skills_sh") {
    const owner = asString(metadata.owner) ?? null;
    const repo = asString(metadata.repo) ?? null;
    return {
      editable: false,
      editableReason: "Skills.sh-managed skills are read-only.",
      sourceLabel: skill.sourceLocator ?? (owner && repo ? `${owner}/${repo}` : null),
      sourceBadge: "skills_sh",
      sourcePath: null,
    };
  }

  if (skill.sourceType === "github") {
    const owner = asString(metadata.owner) ?? null;
    const repo = asString(metadata.repo) ?? null;
    return {
      editable: false,
      editableReason: "Remote GitHub skills are read-only. Fork or import locally to edit them.",
      sourceLabel: owner && repo ? `${owner}/${repo}` : skill.sourceLocator,
      sourceBadge: "github",
      sourcePath: null,
    };
  }

  if (skill.sourceType === "url") {
    return {
      editable: false,
      editableReason: "URL-based skills are read-only. Save them locally to edit them.",
      sourceLabel: skill.sourceLocator,
      sourceBadge: "url",
      sourcePath: null,
    };
  }

  if (skill.sourceType === "local_path") {
    const managedRoot = resolveManagedSkillsRoot(skill.companyId);
    const projectName = asString(metadata.projectName);
    const workspaceName = asString(metadata.workspaceName);
    const isProjectScan = metadata.sourceKind === "project_scan";
    if (localSkillDir && localSkillDir.startsWith(managedRoot)) {
      return {
        editable: true,
        editableReason: null,
        sourceLabel: "Paperclip workspace",
        sourceBadge: "paperclip",
        sourcePath: managedRoot,
      };
    }

    return {
      editable: true,
      editableReason: null,
      sourceLabel: isProjectScan
        ? [projectName, workspaceName].filter((value): value is string => Boolean(value)).join(" / ")
          || skill.sourceLocator
        : skill.sourceLocator,
      sourceBadge: "local",
      sourcePath: null,
    };
  }

  return {
    editable: false,
    editableReason: "This skill source is read-only.",
    sourceLabel: skill.sourceLocator,
    sourceBadge: "catalog",
    sourcePath: null,
  };
}

export function enrichSkill(skill: CompanySkill, attachedAgentCount: number, usedByAgents: CompanySkillUsageAgent[] = []) {
  const source = deriveSkillSourceInfo(skill);
  return {
    ...skill,
    attachedAgentCount,
    usedByAgents,
    ...source,
  };
}

export function toCompanySkillListItem(skill: CompanySkill, attachedAgentCount: number): CompanySkillListItem {
  const source = deriveSkillSourceInfo(skill);
  return {
    id: skill.id,
    companyId: skill.companyId,
    key: skill.key,
    slug: skill.slug,
    name: skill.name,
    description: skill.description,
    sourceType: skill.sourceType,
    sourceLocator: skill.sourceLocator,
    sourceRef: skill.sourceRef,
    trustLevel: skill.trustLevel,
    compatibility: skill.compatibility,
    fileInventory: skill.fileInventory,
    createdAt: skill.createdAt,
    updatedAt: skill.updatedAt,
    attachedAgentCount,
    editable: source.editable,
    editableReason: source.editableReason,
    sourceLabel: source.sourceLabel,
    sourceBadge: source.sourceBadge,
    sourcePath: source.sourcePath,
  };
}
