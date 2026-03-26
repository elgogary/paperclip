// company-portability.ts — Thin factory stub for company import/export.
// Logic lives in portability-*.ts sibling modules.
import path from "node:path";
import type { Db } from "@paperclipai/db";
import {
  normalizePortablePath,
  parseFrontmatterMarkdown,
} from "@paperclipai/shared";
import { unprocessable } from "../errors.js";
import type { StorageService } from "../storage/types.js";
import { accessService } from "./access.js";
import { agentService } from "./agents.js";
import { agentInstructionsService } from "./agent-instructions.js";
import { assetService } from "./assets.js";
import { companySkillService } from "./company-skills.js";
import { companyService } from "./companies.js";
import { issueService } from "./issues.js";
import { projectService } from "./projects.js";

// Import sub-modules
import { createExportOps } from "./portability-export.js";
import { createImportOps } from "./portability-import.js";

// Import helpers used by resolveSource
import {
  normalizeFileMap,
  bufferToPortableBinaryFile,
  inferContentTypeFromPath,
} from "./portability-helpers.js";
import { readIncludeEntries, buildManifestFromPackageFiles, type ResolvedSource } from "./portability-manifest.js";

// Re-export test-facing API surface (preserves import paths)
export { parseGitHubSourceUrl } from "./portability-skills.js";

// GitHub fetch helpers used by resolveSource
async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url}: ${res.status} ${res.statusText}`);
  return res.text();
}

async function fetchOptionalText(url: string): Promise<string | null> {
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`fetch ${url}: ${res.status} ${res.statusText}`);
  return res.text();
}

async function fetchBinary(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url}: ${res.status} ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
}

async function fetchJson<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: "application/vnd.github.v3+json" },
  });
  if (!res.ok) throw new Error(`fetch ${url}: ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

function resolveRawGitHubUrl(owner: string, repo: string, ref: string, filePath: string): string {
  const normalizedFilePath = filePath.replace(/^\/+/, "");
  return `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${normalizedFilePath}`;
}

import { parseGitHubSourceUrl as _parseGitHubSourceUrl } from "./portability-skills.js";

import type {
  CompanyPortabilityFileEntry,
  CompanyPortabilityPreview,
} from "@paperclipai/shared";

export function companyPortabilityService(db: Db, storage?: StorageService) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const $: Record<string, any> = {};

  // ── Factory-level services ──────────────────────────────────────────────
  $.companies = companyService(db);
  $.agents = agentService(db);
  $.assetRecords = assetService(db);
  $.instructions = agentInstructionsService();
  $.access = accessService(db);
  $.projects = projectService(db);
  $.issues = issueService(db);
  $.companySkills = companySkillService(db);
  $.storage = storage;

  // ── resolveSource — bridge between import source and manifest ───────────
  async function resolveSource(source: CompanyPortabilityPreview["source"]): Promise<ResolvedSource> {
    if (source.type === "inline") {
      return buildManifestFromPackageFiles(
        normalizeFileMap(source.files, source.rootPath),
      );
    }

    const parsed = _parseGitHubSourceUrl(source.url);
    let ref = parsed.ref;
    const warnings: string[] = [];
    const companyRelativePath = parsed.companyPath === "COMPANY.md"
      ? [parsed.basePath, "COMPANY.md"].filter(Boolean).join("/")
      : parsed.companyPath;
    let companyMarkdown: string | null = null;
    try {
      companyMarkdown = await fetchOptionalText(
        resolveRawGitHubUrl(parsed.owner, parsed.repo, ref, companyRelativePath),
      );
    } catch (err) {
      if (ref === "main") {
        ref = "master";
        warnings.push("GitHub ref main not found; falling back to master.");
        companyMarkdown = await fetchOptionalText(
          resolveRawGitHubUrl(parsed.owner, parsed.repo, ref, companyRelativePath),
        );
      } else {
        throw err;
      }
    }
    if (!companyMarkdown) {
      throw unprocessable("GitHub company package is missing COMPANY.md");
    }

    const companyPath = parsed.companyPath === "COMPANY.md"
      ? "COMPANY.md"
      : normalizePortablePath(path.posix.relative(parsed.basePath || ".", parsed.companyPath));
    const files: Record<string, CompanyPortabilityFileEntry> = {
      [companyPath]: companyMarkdown,
    };
    const tree = await fetchJson<{ tree?: Array<{ path: string; type: string }> }>(
      `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/git/trees/${ref}?recursive=1`,
    ).catch(() => ({ tree: [] }));
    const basePrefix = parsed.basePath ? `${parsed.basePath.replace(/^\/+|\/+$/g, "")}/` : "";
    const candidatePaths = (tree.tree ?? [])
      .filter((entry) => entry.type === "blob")
      .map((entry) => entry.path)
      .filter((entry): entry is string => typeof entry === "string")
      .filter((entry) => {
        if (basePrefix && !entry.startsWith(basePrefix)) return false;
        const relative = basePrefix ? entry.slice(basePrefix.length) : entry;
        return (
          relative.endsWith(".md") ||
          relative.startsWith("skills/") ||
          relative === ".paperclip.yaml" ||
          relative === ".paperclip.yml"
        );
      });
    for (const repoPath of candidatePaths) {
      const relativePath = basePrefix ? repoPath.slice(basePrefix.length) : repoPath;
      if (files[relativePath] !== undefined) continue;
      files[normalizePortablePath(relativePath)] = await fetchText(
        resolveRawGitHubUrl(parsed.owner, parsed.repo, ref, repoPath),
      );
    }
    const companyDoc = parseFrontmatterMarkdown(companyMarkdown);
    const includeEntries = readIncludeEntries(companyDoc.frontmatter);
    for (const includeEntry of includeEntries) {
      const repoPath = [parsed.basePath, includeEntry.path].filter(Boolean).join("/");
      const relativePath = normalizePortablePath(includeEntry.path);
      if (files[relativePath] !== undefined) continue;
      if (!(repoPath.endsWith(".md") || repoPath.endsWith(".yaml") || repoPath.endsWith(".yml"))) continue;
      files[relativePath] = await fetchText(
        resolveRawGitHubUrl(parsed.owner, parsed.repo, ref, repoPath),
      );
    }

    const resolved = await buildManifestFromPackageFiles(files);
    const companyLogoPath = resolved.manifest.company?.logoPath;
    if (companyLogoPath && !resolved.files[companyLogoPath]) {
      const repoPath = [parsed.basePath, companyLogoPath].filter(Boolean).join("/");
      try {
        const binary = await fetchBinary(
          resolveRawGitHubUrl(parsed.owner, parsed.repo, ref, repoPath),
        );
        resolved.files[companyLogoPath] = bufferToPortableBinaryFile(binary, inferContentTypeFromPath(companyLogoPath));
      } catch (err) {
        warnings.push(`Failed to fetch company logo ${companyLogoPath} from GitHub: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    resolved.warnings.unshift(...warnings);
    return resolved;
  }

  // Make resolveSource available to import module via $
  $.resolveSource = resolveSource;

  // ── Initialize sub-modules ──────────────────────────────────────────────
  const exportOps = createExportOps(db, $);
  const importOps = createImportOps(db, $);

  return {
    exportBundle: exportOps.exportBundle,
    previewExport: exportOps.previewExport,
    previewImport: importOps.previewImport,
    importBundle: importOps.importBundle,
  };
}
