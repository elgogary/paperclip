import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  CompanySkillCompatibility,
  CompanySkillFileInventoryEntry,
  CompanySkillSourceType,
  CompanySkillTrustLevel,
} from "@paperclipai/shared";
import {
  asString,
  isPlainRecord,
  normalizePortablePath,
  normalizeSkillSlug,
  normalizeSkillKey,
  normalizeAgentUrlKey,
  parseFrontmatterMarkdown,
} from "@paperclipai/shared";
import { unprocessable } from "../errors.js";
import {
  normalizeGitHubSkillDirectory,
} from "./company-skills.js";

/**
 * Re-import internal helpers from company-skills that the extracted functions depend on.
 * These are NOT part of the extraction list but are called by the extracted functions.
 * They must be exported from company-skills.ts for this to work.
 */
import {
  normalizePackageFileMap,
  classifyInventoryKind,
  deriveTrustLevel,
  readCanonicalSkillKey,
  deriveCanonicalSkillKey,
  PROJECT_SCAN_DIRECTORY_ROOTS,
  PROJECT_ROOT_SKILL_SUBDIRECTORIES,
} from "./company-skills.js";

import type {
  LocalSkillInventoryMode,
  ProjectSkillScanTarget,
} from "./company-skills.js";

import type { ImportedSkill } from "./skill-inventory.js";

export type ParsedSkillImportSource = {
  resolvedSource: string;
  requestedSkillSlug: string | null;
  originalSkillsShUrl: string | null;
  warnings: string[];
};

export async function fetchText(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw unprocessable(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.text();
}

export async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      accept: "application/vnd.github+json",
    },
  });
  if (!response.ok) {
    throw unprocessable(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function resolveGitHubDefaultBranch(owner: string, repo: string) {
  const response = await fetchJson<{ default_branch?: string }>(
    `https://api.github.com/repos/${owner}/${repo}`,
  );
  return asString(response.default_branch) ?? "main";
}

export async function resolveGitHubCommitSha(owner: string, repo: string, ref: string) {
  const response = await fetchJson<{ sha?: string }>(
    `https://api.github.com/repos/${owner}/${repo}/commits/${encodeURIComponent(ref)}`,
  );
  const sha = asString(response.sha);
  if (!sha) {
    throw unprocessable(`Failed to resolve GitHub ref ${ref}`);
  }
  return sha;
}

export function parseGitHubSourceUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  if (url.hostname !== "github.com") {
    throw unprocessable("GitHub source must use github.com URL");
  }
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw unprocessable("Invalid GitHub URL");
  }
  const owner = parts[0]!;
  const repo = parts[1]!.replace(/\.git$/i, "");
  let ref = "main";
  let basePath = "";
  let filePath: string | null = null;
  let explicitRef = false;
  if (parts[2] === "tree") {
    ref = parts[3] ?? "main";
    basePath = parts.slice(4).join("/");
    explicitRef = true;
  } else if (parts[2] === "blob") {
    ref = parts[3] ?? "main";
    filePath = parts.slice(4).join("/");
    basePath = filePath ? path.posix.dirname(filePath) : "";
    explicitRef = true;
  }
  return { owner, repo, ref, basePath, filePath, explicitRef };
}

export async function resolveGitHubPinnedRef(parsed: ReturnType<typeof parseGitHubSourceUrl>) {
  if (/^[0-9a-f]{40}$/i.test(parsed.ref.trim())) {
    return {
      pinnedRef: parsed.ref,
      trackingRef: parsed.explicitRef ? parsed.ref : null,
    };
  }

  const trackingRef = parsed.explicitRef
    ? parsed.ref
    : await resolveGitHubDefaultBranch(parsed.owner, parsed.repo);
  const pinnedRef = await resolveGitHubCommitSha(parsed.owner, parsed.repo, trackingRef);
  return { pinnedRef, trackingRef };
}

export function resolveRawGitHubUrl(owner: string, repo: string, ref: string, filePath: string) {
  return `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${filePath.replace(/^\/+/, "")}`;
}

export function extractCommandTokens(raw: string) {
  const matches = raw.match(/"[^"]*"|'[^']*'|\S+/g) ?? [];
  return matches.map((token) => token.replace(/^['"]|['"]$/g, ""));
}

export function parseSkillImportSourceInput(rawInput: string): ParsedSkillImportSource {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    throw unprocessable("Skill source is required.");
  }

  const warnings: string[] = [];
  let source = trimmed;
  let requestedSkillSlug: string | null = null;

  if (/^npx\s+skills\s+add\s+/i.test(trimmed)) {
    const tokens = extractCommandTokens(trimmed);
    const addIndex = tokens.findIndex(
      (token, index) =>
        token === "add"
        && index > 0
        && tokens[index - 1]?.toLowerCase() === "skills",
    );
    if (addIndex >= 0) {
      source = tokens[addIndex + 1] ?? "";
      for (let index = addIndex + 2; index < tokens.length; index += 1) {
        const token = tokens[index]!;
        if (token === "--skill") {
          requestedSkillSlug = normalizeSkillSlug(tokens[index + 1] ?? null);
          index += 1;
          continue;
        }
        if (token.startsWith("--skill=")) {
          requestedSkillSlug = normalizeSkillSlug(token.slice("--skill=".length));
        }
      }
    }
  }

  const normalizedSource = source.trim();
  if (!normalizedSource) {
    throw unprocessable("Skill source is required.");
  }

  // Key-style imports (org/repo/skill) originate from the skills.sh registry
  if (!/^https?:\/\//i.test(normalizedSource) && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(normalizedSource)) {
    const [owner, repo, skillSlugRaw] = normalizedSource.split("/");
    return {
      resolvedSource: `https://github.com/${owner}/${repo}`,
      requestedSkillSlug: normalizeSkillSlug(skillSlugRaw),
      originalSkillsShUrl: `https://skills.sh/${owner}/${repo}/${skillSlugRaw}`,
      warnings,
    };
  }

  if (!/^https?:\/\//i.test(normalizedSource) && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(normalizedSource)) {
    return {
      resolvedSource: `https://github.com/${normalizedSource}`,
      requestedSkillSlug,
      originalSkillsShUrl: null,
      warnings,
    };
  }

  // Detect skills.sh URLs and resolve to GitHub: https://skills.sh/org/repo/skill → org/repo/skill key
  const skillsShMatch = normalizedSource.match(/^https?:\/\/(?:www\.)?skills\.sh\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:\/([A-Za-z0-9_.-]+))?(?:[?#].*)?$/i);
  if (skillsShMatch) {
    const [, owner, repo, skillSlugRaw] = skillsShMatch;
    return {
      resolvedSource: `https://github.com/${owner}/${repo}`,
      requestedSkillSlug: skillSlugRaw ? normalizeSkillSlug(skillSlugRaw) : requestedSkillSlug,
      originalSkillsShUrl: normalizedSource,
      warnings,
    };
  }

  return {
    resolvedSource: normalizedSource,
    requestedSkillSlug,
    originalSkillsShUrl: null,
    warnings,
  };
}

export function resolveBundledSkillsRoot() {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  return [
    path.resolve(moduleDir, "../../skills"),
    path.resolve(process.cwd(), "skills"),
    path.resolve(moduleDir, "../../../skills"),
  ];
}

export function matchesRequestedSkill(relativeSkillPath: string, requestedSkillSlug: string | null) {
  if (!requestedSkillSlug) return true;
  const skillDir = path.posix.dirname(relativeSkillPath);
  return normalizeSkillSlug(path.posix.basename(skillDir)) === requestedSkillSlug;
}

export function deriveImportedSkillSlug(frontmatter: Record<string, unknown>, fallback: string) {
  return normalizeSkillSlug(asString(frontmatter.slug))
    ?? normalizeSkillSlug(asString(frontmatter.name))
    ?? normalizeAgentUrlKey(fallback)
    ?? "skill";
}

export function deriveImportedSkillSource(
  frontmatter: Record<string, unknown>,
  fallbackSlug: string,
): Pick<ImportedSkill, "sourceType" | "sourceLocator" | "sourceRef" | "metadata"> {
  const metadata = isPlainRecord(frontmatter.metadata) ? frontmatter.metadata : null;
  const canonicalKey = readCanonicalSkillKey(frontmatter, metadata);
  const rawSources = metadata && Array.isArray(metadata.sources) ? metadata.sources : [];
  const sourceEntry = rawSources.find((entry) => isPlainRecord(entry)) as Record<string, unknown> | undefined;
  const kind = asString(sourceEntry?.kind);

  if (kind === "github-dir" || kind === "github-file") {
    const repo = asString(sourceEntry?.repo);
    const repoPath = asString(sourceEntry?.path);
    const commit = asString(sourceEntry?.commit);
    const trackingRef = asString(sourceEntry?.trackingRef);
    const url = asString(sourceEntry?.url)
      ?? (repo
        ? `https://github.com/${repo}${repoPath ? `/tree/${trackingRef ?? commit ?? "main"}/${repoPath}` : ""}`
        : null);
    const [owner, repoName] = (repo ?? "").split("/");
    if (repo && owner && repoName) {
      return {
        sourceType: "github",
        sourceLocator: url,
        sourceRef: commit,
        metadata: {
          ...(canonicalKey ? { skillKey: canonicalKey } : {}),
          sourceKind: "github",
          owner,
          repo: repoName,
          ref: commit,
          trackingRef,
          repoSkillDir: repoPath ?? `skills/${fallbackSlug}`,
        },
      };
    }
  }

  if (kind === "url") {
    const url = asString(sourceEntry?.url) ?? asString(sourceEntry?.rawUrl);
    if (url) {
      return {
        sourceType: "url",
        sourceLocator: url,
        sourceRef: null,
        metadata: {
          ...(canonicalKey ? { skillKey: canonicalKey } : {}),
          sourceKind: "url",
        },
      };
    }
  }

  return {
    sourceType: "catalog",
    sourceLocator: null,
    sourceRef: null,
    metadata: {
      ...(canonicalKey ? { skillKey: canonicalKey } : {}),
      sourceKind: "catalog",
    },
  };
}

export function readInlineSkillImports(companyId: string, files: Record<string, string>): ImportedSkill[] {
  const normalizedFiles = normalizePackageFileMap(files);
  const skillPaths = Object.keys(normalizedFiles).filter(
    (entry) => path.posix.basename(entry).toLowerCase() === "skill.md",
  );
  const imports: ImportedSkill[] = [];

  for (const skillPath of skillPaths) {
    const dir = path.posix.dirname(skillPath);
    const skillDir = dir === "." ? "" : dir;
    const slugFallback = path.posix.basename(skillDir || path.posix.dirname(skillPath));
    const markdown = normalizedFiles[skillPath]!;
    const parsed = parseFrontmatterMarkdown(markdown);
    const slug = deriveImportedSkillSlug(parsed.frontmatter, slugFallback);
    const source = deriveImportedSkillSource(parsed.frontmatter, slug);
    const inventory = Object.keys(normalizedFiles)
      .filter((entry) => entry === skillPath || (skillDir ? entry.startsWith(`${skillDir}/`) : false))
      .map((entry) => {
        const relative = entry === skillPath ? "SKILL.md" : entry.slice(skillDir.length + 1);
        return {
          path: normalizePortablePath(relative),
          kind: classifyInventoryKind(relative),
        };
      })
      .sort((left, right) => left.path.localeCompare(right.path));

    imports.push({
      key: "",
      slug,
      name: asString(parsed.frontmatter.name) ?? slug,
      description: asString(parsed.frontmatter.description),
      markdown,
      packageDir: skillDir,
      sourceType: source.sourceType,
      sourceLocator: source.sourceLocator,
      sourceRef: source.sourceRef,
      trustLevel: deriveTrustLevel(inventory),
      compatibility: "compatible",
      fileInventory: inventory,
      metadata: source.metadata,
    });
    imports[imports.length - 1]!.key = deriveCanonicalSkillKey(companyId, imports[imports.length - 1]!);
  }

  return imports;
}

export async function walkLocalFiles(root: string, current: string, out: string[]) {
  const entries = await fs.readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const absolutePath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      await walkLocalFiles(root, absolutePath, out);
      continue;
    }
    if (!entry.isFile()) continue;
    out.push(normalizePortablePath(path.relative(root, absolutePath)));
  }
}

export async function statPath(targetPath: string) {
  return fs.stat(targetPath).catch(() => null);
}

export async function collectLocalSkillInventory(
  skillDir: string,
  mode: LocalSkillInventoryMode = "full",
): Promise<CompanySkillFileInventoryEntry[]> {
  const skillFilePath = path.join(skillDir, "SKILL.md");
  const skillFileStat = await statPath(skillFilePath);
  if (!skillFileStat?.isFile()) {
    throw unprocessable(`No SKILL.md file was found in ${skillDir}.`);
  }

  const allFiles = new Set<string>(["SKILL.md"]);
  if (mode === "full") {
    const discoveredFiles: string[] = [];
    await walkLocalFiles(skillDir, skillDir, discoveredFiles);
    for (const relativePath of discoveredFiles) {
      allFiles.add(relativePath);
    }
  } else {
    for (const relativeDir of PROJECT_ROOT_SKILL_SUBDIRECTORIES) {
      const absoluteDir = path.join(skillDir, relativeDir);
      const dirStat = await statPath(absoluteDir);
      if (!dirStat?.isDirectory()) continue;
      const discoveredFiles: string[] = [];
      await walkLocalFiles(skillDir, absoluteDir, discoveredFiles);
      for (const relativePath of discoveredFiles) {
        allFiles.add(relativePath);
      }
    }
  }

  return Array.from(allFiles)
    .map((relativePath) => ({
      path: normalizePortablePath(relativePath),
      kind: classifyInventoryKind(relativePath),
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
}

export async function readLocalSkillImportFromDirectory(
  companyId: string,
  skillDir: string,
  options?: {
    inventoryMode?: LocalSkillInventoryMode;
    metadata?: Record<string, unknown> | null;
  },
): Promise<ImportedSkill> {
  const resolvedSkillDir = path.resolve(skillDir);
  const skillFilePath = path.join(resolvedSkillDir, "SKILL.md");
  const markdown = await fs.readFile(skillFilePath, "utf8");
  const parsed = parseFrontmatterMarkdown(markdown);
  const slug = deriveImportedSkillSlug(parsed.frontmatter, path.basename(resolvedSkillDir));
  const parsedMetadata = isPlainRecord(parsed.frontmatter.metadata) ? parsed.frontmatter.metadata : null;
  const skillKey = readCanonicalSkillKey(parsed.frontmatter, parsedMetadata);
  const metadata = {
    ...(skillKey ? { skillKey } : {}),
    ...(parsedMetadata ?? {}),
    sourceKind: "local_path",
    ...(options?.metadata ?? {}),
  };
  const inventory = await collectLocalSkillInventory(resolvedSkillDir, options?.inventoryMode ?? "full");

  return {
    key: deriveCanonicalSkillKey(companyId, {
      slug,
      sourceType: "local_path",
      sourceLocator: resolvedSkillDir,
      metadata,
    }),
    slug,
    name: asString(parsed.frontmatter.name) ?? slug,
    description: asString(parsed.frontmatter.description),
    markdown,
    packageDir: resolvedSkillDir,
    sourceType: "local_path",
    sourceLocator: resolvedSkillDir,
    sourceRef: null,
    trustLevel: deriveTrustLevel(inventory),
    compatibility: "compatible",
    fileInventory: inventory,
    metadata,
  };
}

export async function discoverProjectWorkspaceSkillDirectories(target: ProjectSkillScanTarget): Promise<Array<{
  skillDir: string;
  inventoryMode: LocalSkillInventoryMode;
}>> {
  const discovered = new Map<string, LocalSkillInventoryMode>();
  const rootSkillPath = path.join(target.workspaceCwd, "SKILL.md");
  if ((await statPath(rootSkillPath))?.isFile()) {
    discovered.set(path.resolve(target.workspaceCwd), "project_root");
  }

  for (const relativeRoot of PROJECT_SCAN_DIRECTORY_ROOTS) {
    const absoluteRoot = path.join(target.workspaceCwd, relativeRoot);
    const rootStat = await statPath(absoluteRoot);
    if (!rootStat?.isDirectory()) continue;

    const entries = await fs.readdir(absoluteRoot, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const absoluteSkillDir = path.resolve(absoluteRoot, entry.name);
      if (!(await statPath(path.join(absoluteSkillDir, "SKILL.md")))?.isFile()) continue;
      discovered.set(absoluteSkillDir, "full");
    }
  }

  return Array.from(discovered.entries())
    .map(([skillDir, inventoryMode]) => ({ skillDir, inventoryMode }))
    .sort((left, right) => left.skillDir.localeCompare(right.skillDir));
}

export async function readLocalSkillImports(companyId: string, sourcePath: string): Promise<ImportedSkill[]> {
  const resolvedPath = path.resolve(sourcePath);
  const stat = await fs.stat(resolvedPath).catch(() => null);
  if (!stat) {
    throw unprocessable(`Skill source path does not exist: ${sourcePath}`);
  }

  if (stat.isFile()) {
    const markdown = await fs.readFile(resolvedPath, "utf8");
    const parsed = parseFrontmatterMarkdown(markdown);
    const slug = deriveImportedSkillSlug(parsed.frontmatter, path.basename(path.dirname(resolvedPath)));
    const parsedMetadata = isPlainRecord(parsed.frontmatter.metadata) ? parsed.frontmatter.metadata : null;
    const skillKey = readCanonicalSkillKey(parsed.frontmatter, parsedMetadata);
    const metadata = {
      ...(skillKey ? { skillKey } : {}),
      ...(parsedMetadata ?? {}),
      sourceKind: "local_path",
    };
    const inventory: CompanySkillFileInventoryEntry[] = [
      { path: "SKILL.md", kind: "skill" },
    ];
    return [{
      key: deriveCanonicalSkillKey(companyId, {
        slug,
        sourceType: "local_path",
        sourceLocator: path.dirname(resolvedPath),
        metadata,
      }),
      slug,
      name: asString(parsed.frontmatter.name) ?? slug,
      description: asString(parsed.frontmatter.description),
      markdown,
      packageDir: path.dirname(resolvedPath),
      sourceType: "local_path",
      sourceLocator: path.dirname(resolvedPath),
      sourceRef: null,
      trustLevel: deriveTrustLevel(inventory),
      compatibility: "compatible",
      fileInventory: inventory,
      metadata,
    }];
  }

  const root = resolvedPath;
  const allFiles: string[] = [];
  await walkLocalFiles(root, root, allFiles);
  const skillPaths = allFiles.filter((entry) => path.posix.basename(entry).toLowerCase() === "skill.md");
  if (skillPaths.length === 0) {
    throw unprocessable("No SKILL.md files were found in the provided path.");
  }

  const imports: ImportedSkill[] = [];
  for (const skillPath of skillPaths) {
    const skillDir = path.posix.dirname(skillPath);
    const inventory = allFiles
      .filter((entry) => entry === skillPath || entry.startsWith(`${skillDir}/`))
      .map((entry) => {
        const relative = entry === skillPath ? "SKILL.md" : entry.slice(skillDir.length + 1);
        return {
          path: normalizePortablePath(relative),
          kind: classifyInventoryKind(relative),
        };
      })
      .sort((left, right) => left.path.localeCompare(right.path));
    const imported = await readLocalSkillImportFromDirectory(companyId, path.join(root, skillDir));
    imported.fileInventory = inventory;
    imported.trustLevel = deriveTrustLevel(inventory);
    imports.push(imported);
  }

  return imports;
}

export async function readUrlSkillImports(
  companyId: string,
  sourceUrl: string,
  requestedSkillSlug: string | null = null,
): Promise<{ skills: ImportedSkill[]; warnings: string[] }> {
  const url = sourceUrl.trim();
  const warnings: string[] = [];
  if (url.includes("github.com/")) {
    const parsed = parseGitHubSourceUrl(url);
    const { pinnedRef, trackingRef } = await resolveGitHubPinnedRef(parsed);
    let ref = pinnedRef;
    const tree = await fetchJson<{ tree?: Array<{ path: string; type: string }> }>(
      `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/git/trees/${ref}?recursive=1`,
    ).catch(() => {
      throw unprocessable(`Failed to read GitHub tree for ${url}`);
    });
    const allPaths = (tree.tree ?? [])
      .filter((entry) => entry.type === "blob")
      .map((entry) => entry.path)
      .filter((entry): entry is string => typeof entry === "string");
    const basePrefix = parsed.basePath ? `${parsed.basePath.replace(/^\/+|\/+$/g, "")}/` : "";
    const scopedPaths = basePrefix
      ? allPaths.filter((entry) => entry.startsWith(basePrefix))
      : allPaths;
    const relativePaths = scopedPaths.map((entry) => basePrefix ? entry.slice(basePrefix.length) : entry);
    const filteredPaths = parsed.filePath
      ? relativePaths.filter((entry) => entry === path.posix.relative(parsed.basePath || ".", parsed.filePath!))
      : relativePaths;
    const skillPaths = filteredPaths.filter(
      (entry) => path.posix.basename(entry).toLowerCase() === "skill.md",
    );
    if (skillPaths.length === 0) {
      throw unprocessable(
        "No SKILL.md files were found in the provided GitHub source.",
      );
    }
    const skills: ImportedSkill[] = [];
    for (const relativeSkillPath of skillPaths) {
      const repoSkillPath = basePrefix ? `${basePrefix}${relativeSkillPath}` : relativeSkillPath;
      const markdown = await fetchText(resolveRawGitHubUrl(parsed.owner, parsed.repo, ref, repoSkillPath));
      const parsedMarkdown = parseFrontmatterMarkdown(markdown);
      const skillDir = path.posix.dirname(relativeSkillPath);
      const slug = deriveImportedSkillSlug(parsedMarkdown.frontmatter, path.posix.basename(skillDir));
      const skillKey = readCanonicalSkillKey(
        parsedMarkdown.frontmatter,
        isPlainRecord(parsedMarkdown.frontmatter.metadata) ? parsedMarkdown.frontmatter.metadata : null,
      );
      if (requestedSkillSlug && !matchesRequestedSkill(relativeSkillPath, requestedSkillSlug) && slug !== requestedSkillSlug) {
        continue;
      }
      const metadata = {
        ...(skillKey ? { skillKey } : {}),
        sourceKind: "github",
        owner: parsed.owner,
        repo: parsed.repo,
        ref: ref,
        trackingRef,
        repoSkillDir: normalizeGitHubSkillDirectory(
          basePrefix ? `${basePrefix}${skillDir}` : skillDir,
          slug,
        ),
      };
      const inventory = filteredPaths
        .filter((entry) => entry === relativeSkillPath || entry.startsWith(`${skillDir}/`))
        .map((entry) => ({
          path: entry === relativeSkillPath ? "SKILL.md" : entry.slice(skillDir.length + 1),
          kind: classifyInventoryKind(entry === relativeSkillPath ? "SKILL.md" : entry.slice(skillDir.length + 1)),
        }))
        .sort((left, right) => left.path.localeCompare(right.path));
      skills.push({
        key: deriveCanonicalSkillKey(companyId, {
          slug,
          sourceType: "github",
          sourceLocator: sourceUrl,
          metadata,
        }),
        slug,
        name: asString(parsedMarkdown.frontmatter.name) ?? slug,
        description: asString(parsedMarkdown.frontmatter.description),
        markdown,
        sourceType: "github",
        sourceLocator: sourceUrl,
        sourceRef: ref,
        trustLevel: deriveTrustLevel(inventory),
        compatibility: "compatible",
        fileInventory: inventory,
        metadata,
      });
    }
    if (skills.length === 0) {
      throw unprocessable(
        requestedSkillSlug
          ? `Skill ${requestedSkillSlug} was not found in the provided GitHub source.`
          : "No SKILL.md files were found in the provided GitHub source.",
      );
    }
    return { skills, warnings };
  }

  if (url.startsWith("http://") || url.startsWith("https://")) {
    const markdown = await fetchText(url);
    const parsedMarkdown = parseFrontmatterMarkdown(markdown);
    const urlObj = new URL(url);
    const fileName = path.posix.basename(urlObj.pathname);
    const slug = deriveImportedSkillSlug(parsedMarkdown.frontmatter, fileName.replace(/\.md$/i, ""));
    const skillKey = readCanonicalSkillKey(
      parsedMarkdown.frontmatter,
      isPlainRecord(parsedMarkdown.frontmatter.metadata) ? parsedMarkdown.frontmatter.metadata : null,
    );
    const metadata = {
      ...(skillKey ? { skillKey } : {}),
      sourceKind: "url",
    };
    const inventory: CompanySkillFileInventoryEntry[] = [{ path: "SKILL.md", kind: "skill" }];
    return {
      skills: [{
        key: deriveCanonicalSkillKey(companyId, {
          slug,
          sourceType: "url",
          sourceLocator: url,
          metadata,
        }),
        slug,
        name: asString(parsedMarkdown.frontmatter.name) ?? slug,
        description: asString(parsedMarkdown.frontmatter.description),
        markdown,
        sourceType: "url",
        sourceLocator: url,
        sourceRef: null,
        trustLevel: deriveTrustLevel(inventory),
        compatibility: "compatible",
        fileInventory: inventory,
        metadata,
      }],
      warnings,
    };
  }

  throw unprocessable("Unsupported skill source. Use a local path or URL.");
}
