import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type {
  CompanyPortabilityCollisionStrategy,
  CompanyPortabilityEnvInput,
  CompanyPortabilityExportPreviewResult,
  CompanyPortabilityFileEntry,
  CompanyPortabilityInclude,
  CompanyPortabilityManifest,
  CompanyPortabilityProjectWorkspaceManifestEntry,
  CompanyPortabilitySidebarOrder,
} from "@paperclipai/shared";
import {
  deriveProjectUrlKey,
  normalizeAgentUrlKey,
  asString,
  isPlainRecord,
  normalizePortablePath,
} from "@paperclipai/shared";
import { unprocessable } from "../errors.js";
import { stripEmptyValues } from "./portability-yaml-render.js";

const execFileAsync = promisify(execFile);

const DEFAULT_INCLUDE: CompanyPortabilityInclude = {
  company: true,
  agents: true,
  projects: false,
  issues: false,
  skills: false,
};

type ImportMode = "board_full" | "agent_safe";

type ImportBehaviorOptions = {
  mode?: ImportMode;
  sourceCompanyId?: string | null;
};

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

type EnvInputRecord = {
  kind: "secret" | "plain";
  requirement: "required" | "optional";
  default?: string | null;
  description?: string | null;
  portability?: "portable" | "system_dependent";
};

export const COMPANY_LOGO_CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
  "image/gif": ".gif",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/svg+xml": ".svg",
  "image/webp": ".webp",
};

export function resolveImportMode(options?: ImportBehaviorOptions): ImportMode {
  return options?.mode ?? "board_full";
}

export function resolveSkillConflictStrategy(mode: ImportMode, collisionStrategy: CompanyPortabilityCollisionStrategy) {
  if (mode === "board_full") return "replace" as const;
  return collisionStrategy === "skip" ? "skip" as const : "rename" as const;
}

export function classifyPortableFileKind(pathValue: string): CompanyPortabilityExportPreviewResult["fileInventory"][number]["kind"] {
  const normalized = normalizePortablePath(pathValue);
  if (normalized === "COMPANY.md") return "company";
  if (normalized === ".paperclip.yaml" || normalized === ".paperclip.yml") return "extension";
  if (normalized === "README.md") return "readme";
  if (normalized.startsWith("agents/")) return "agent";
  if (normalized.startsWith("skills/")) return "skill";
  if (normalized.startsWith("projects/")) return "project";
  if (normalized.startsWith("tasks/")) return "issue";
  return "other";
}

export function isSensitiveEnvKey(key: string) {
  const normalized = key.trim().toLowerCase();
  return (
    normalized === "token" ||
    normalized.endsWith("_token") ||
    normalized.endsWith("-token") ||
    normalized.includes("apikey") ||
    normalized.includes("api_key") ||
    normalized.includes("api-key") ||
    normalized.includes("access_token") ||
    normalized.includes("access-token") ||
    normalized.includes("auth") ||
    normalized.includes("auth_token") ||
    normalized.includes("auth-token") ||
    normalized.includes("authorization") ||
    normalized.includes("bearer") ||
    normalized.includes("secret") ||
    normalized.includes("passwd") ||
    normalized.includes("password") ||
    normalized.includes("credential") ||
    normalized.includes("jwt") ||
    normalized.includes("privatekey") ||
    normalized.includes("private_key") ||
    normalized.includes("private-key") ||
    normalized.includes("cookie") ||
    normalized.includes("connectionstring")
  );
}

export function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

export function asInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

export function containsAbsolutePathFragment(value: string) {
  return /(^|\s)(\/[^/\s]|[A-Za-z]:[\\/])/.test(value);
}

export function containsSystemDependentPathValue(value: unknown): boolean {
  if (typeof value === "string") {
    return path.isAbsolute(value) || /^[A-Za-z]:[\\/]/.test(value) || containsAbsolutePathFragment(value);
  }
  if (Array.isArray(value)) {
    return value.some((entry) => containsSystemDependentPathValue(entry));
  }
  if (isPlainRecord(value)) {
    return Object.values(value).some((entry) => containsSystemDependentPathValue(entry));
  }
  return false;
}

export function clonePortableRecord(value: unknown) {
  if (!isPlainRecord(value)) return null;
  return structuredClone(value) as Record<string, unknown>;
}

export function disableImportedTimerHeartbeat(runtimeConfig: unknown) {
  const next = clonePortableRecord(runtimeConfig) ?? {};
  const heartbeat = isPlainRecord(next.heartbeat) ? { ...next.heartbeat } : {};
  heartbeat.enabled = false;
  next.heartbeat = heartbeat;
  return next;
}

export function normalizePortableProjectWorkspaceExtension(
  workspaceKey: string,
  value: unknown,
): CompanyPortabilityProjectWorkspaceManifestEntry | null {
  if (!isPlainRecord(value)) return null;
  const normalizedKey = normalizeAgentUrlKey(workspaceKey) ?? workspaceKey.trim();
  if (!normalizedKey) return null;
  return {
    key: normalizedKey,
    name: asString(value.name) ?? normalizedKey,
    sourceType: asString(value.sourceType),
    repoUrl: asString(value.repoUrl),
    repoRef: asString(value.repoRef),
    defaultRef: asString(value.defaultRef),
    visibility: asString(value.visibility),
    setupCommand: asString(value.setupCommand),
    cleanupCommand: asString(value.cleanupCommand),
    metadata: isPlainRecord(value.metadata) ? value.metadata : null,
    isPrimary: asBoolean(value.isPrimary) ?? false,
  };
}

export function derivePortableProjectWorkspaceKey(
  workspace: NonNullable<ProjectLike["workspaces"]>[number],
  usedKeys: Set<string>,
) {
  const baseKey =
    normalizeAgentUrlKey(workspace.name)
    ?? normalizeAgentUrlKey(asString(workspace.repoUrl)?.split("/").pop()?.replace(/\.git$/i, "") ?? "")
    ?? "workspace";
  return uniqueSlug(baseKey, usedKeys);
}

export function exportPortableProjectExecutionWorkspacePolicy(
  projectSlug: string,
  policy: unknown,
  workspaceKeyById: Map<string, string>,
  warnings: string[],
) {
  const next = clonePortableRecord(policy);
  if (!next) return null;
  const defaultWorkspaceId = asString(next.defaultProjectWorkspaceId);
  if (defaultWorkspaceId) {
    const defaultWorkspaceKey = workspaceKeyById.get(defaultWorkspaceId);
    if (defaultWorkspaceKey) {
      next.defaultProjectWorkspaceKey = defaultWorkspaceKey;
    } else {
      warnings.push(`Project ${projectSlug} default workspace ${defaultWorkspaceId} was omitted from export because that workspace is not portable.`);
    }
    delete next.defaultProjectWorkspaceId;
  }
  const cleaned = stripEmptyValues(next);
  return isPlainRecord(cleaned) ? cleaned : null;
}

export function importPortableProjectExecutionWorkspacePolicy(
  projectSlug: string,
  policy: Record<string, unknown> | null | undefined,
  workspaceIdByKey: Map<string, string>,
  warnings: string[],
) {
  const next = clonePortableRecord(policy);
  if (!next) return null;
  const defaultWorkspaceKey = asString(next.defaultProjectWorkspaceKey);
  if (defaultWorkspaceKey) {
    const defaultWorkspaceId = workspaceIdByKey.get(defaultWorkspaceKey);
    if (defaultWorkspaceId) {
      next.defaultProjectWorkspaceId = defaultWorkspaceId;
    } else {
      warnings.push(`Project ${projectSlug} references missing workspace key ${defaultWorkspaceKey}; imported execution workspace policy without a default workspace.`);
    }
  }
  delete next.defaultProjectWorkspaceKey;
  const cleaned = stripEmptyValues(next);
  return isPlainRecord(cleaned) ? cleaned : null;
}

export function stripPortableProjectExecutionWorkspaceRefs(policy: Record<string, unknown> | null | undefined) {
  const next = clonePortableRecord(policy);
  if (!next) return null;
  delete next.defaultProjectWorkspaceId;
  delete next.defaultProjectWorkspaceKey;
  const cleaned = stripEmptyValues(next);
  return isPlainRecord(cleaned) ? cleaned : null;
}

export async function readGitOutput(cwd: string, args: string[]) {
  const { stdout } = await execFileAsync("git", ["-C", cwd, ...args], { cwd });
  const trimmed = stdout.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function inferPortableWorkspaceGitMetadata(workspace: NonNullable<ProjectLike["workspaces"]>[number]) {
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

export function toSafeSlug(input: string, fallback: string) {
  return normalizeAgentUrlKey(input) ?? fallback;
}

export function uniqueSlug(base: string, used: Set<string>) {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let idx = 2;
  while (true) {
    const candidate = `${base}-${idx}`;
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
    idx += 1;
  }
}

export function uniqueNameBySlug(baseName: string, existingSlugs: Set<string>) {
  const baseSlug = normalizeAgentUrlKey(baseName) ?? "agent";
  if (!existingSlugs.has(baseSlug)) return baseName;
  let idx = 2;
  while (true) {
    const candidateName = `${baseName} ${idx}`;
    const candidateSlug = normalizeAgentUrlKey(candidateName) ?? `agent-${idx}`;
    if (!existingSlugs.has(candidateSlug)) return candidateName;
    idx += 1;
  }
}

export function uniqueProjectName(baseName: string, existingProjectSlugs: Set<string>) {
  const baseSlug = deriveProjectUrlKey(baseName, baseName);
  if (!existingProjectSlugs.has(baseSlug)) return baseName;
  let idx = 2;
  while (true) {
    const candidateName = `${baseName} ${idx}`;
    const candidateSlug = deriveProjectUrlKey(candidateName, candidateName);
    if (!existingProjectSlugs.has(candidateSlug)) return candidateName;
    idx += 1;
  }
}

export function normalizeInclude(input?: Partial<CompanyPortabilityInclude>): CompanyPortabilityInclude {
  return {
    company: input?.company ?? DEFAULT_INCLUDE.company,
    agents: input?.agents ?? DEFAULT_INCLUDE.agents,
    projects: input?.projects ?? DEFAULT_INCLUDE.projects,
    issues: input?.issues ?? DEFAULT_INCLUDE.issues,
    skills: input?.skills ?? DEFAULT_INCLUDE.skills,
  };
}

export function resolvePortablePath(fromPath: string, targetPath: string) {
  const baseDir = path.posix.dirname(fromPath.replace(/\\/g, "/"));
  return normalizePortablePath(path.posix.join(baseDir, targetPath.replace(/\\/g, "/")));
}

export function isPortableBinaryFile(
  value: CompanyPortabilityFileEntry,
): value is Extract<CompanyPortabilityFileEntry, { encoding: "base64" }> {
  return typeof value === "object" && value !== null && value.encoding === "base64" && typeof value.data === "string";
}

export function readPortableTextFile(
  files: Record<string, CompanyPortabilityFileEntry>,
  filePath: string,
) {
  const value = files[filePath];
  return typeof value === "string" ? value : null;
}

export function inferContentTypeFromPath(filePath: string) {
  const extension = path.posix.extname(filePath).toLowerCase();
  switch (extension) {
    case ".gif":
      return "image/gif";
    case ".jpeg":
    case ".jpg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".svg":
      return "image/svg+xml";
    case ".webp":
      return "image/webp";
    default:
      return null;
  }
}

export function resolveCompanyLogoExtension(contentType: string | null | undefined, originalFilename: string | null | undefined) {
  const fromContentType = contentType ? COMPANY_LOGO_CONTENT_TYPE_EXTENSIONS[contentType.toLowerCase()] : null;
  if (fromContentType) return fromContentType;

  const extension = originalFilename ? path.extname(originalFilename).toLowerCase() : "";
  return extension || ".png";
}

export function portableBinaryFileToBuffer(entry: Extract<CompanyPortabilityFileEntry, { encoding: "base64" }>) {
  return Buffer.from(entry.data, "base64");
}

export function portableFileToBuffer(entry: CompanyPortabilityFileEntry, filePath: string) {
  if (typeof entry === "string") {
    return Buffer.from(entry, "utf8");
  }
  if (isPortableBinaryFile(entry)) {
    return portableBinaryFileToBuffer(entry);
  }
  throw unprocessable(`Unsupported file entry encoding for ${filePath}`);
}

export function bufferToPortableBinaryFile(buffer: Buffer, contentType: string | null): CompanyPortabilityFileEntry {
  return {
    encoding: "base64",
    data: buffer.toString("base64"),
    contentType,
  };
}

export async function streamToBuffer(stream: NodeJS.ReadableStream) {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export function normalizeFileMap(
  files: Record<string, CompanyPortabilityFileEntry>,
  rootPath?: string | null,
): Record<string, CompanyPortabilityFileEntry> {
  const normalizedRoot = rootPath ? normalizePortablePath(rootPath) : null;
  const out: Record<string, CompanyPortabilityFileEntry> = {};
  for (const [rawPath, content] of Object.entries(files)) {
    let nextPath = normalizePortablePath(rawPath);
    if (normalizedRoot && nextPath === normalizedRoot) {
      continue;
    }
    if (normalizedRoot && nextPath.startsWith(`${normalizedRoot}/`)) {
      nextPath = nextPath.slice(normalizedRoot.length + 1);
    }
    if (!nextPath) continue;
    out[nextPath] = content;
  }
  return out;
}

export function pickTextFiles(files: Record<string, CompanyPortabilityFileEntry>) {
  const out: Record<string, string> = {};
  for (const [filePath, content] of Object.entries(files)) {
    if (typeof content === "string") {
      out[filePath] = content;
    }
  }
  return out;
}

export function normalizePortableSlugList(value: unknown) {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    normalized.push(trimmed);
  }
  return normalized;
}

export function normalizePortableSidebarOrder(value: unknown): CompanyPortabilitySidebarOrder | null {
  if (!isPlainRecord(value)) return null;
  const sidebar = {
    agents: normalizePortableSlugList(value.agents),
    projects: normalizePortableSlugList(value.projects),
  };
  return sidebar.agents.length > 0 || sidebar.projects.length > 0 ? sidebar : null;
}

export function normalizePortableConfig(
  value: unknown,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const input = value as Record<string, unknown>;
  const next: Record<string, unknown> = {};

  for (const [key, entry] of Object.entries(input)) {
    if (
      key === "cwd" ||
      key === "instructionsFilePath" ||
      key === "instructionsBundleMode" ||
      key === "instructionsRootPath" ||
      key === "instructionsEntryFile" ||
      key === "promptTemplate" ||
      key === "bootstrapPromptTemplate" ||
      key === "paperclipSkillSync"
    ) continue;
    if (key === "env") continue;
    next[key] = entry;
  }

  return next;
}

export function isAbsoluteCommand(value: string) {
  return path.isAbsolute(value) || /^[A-Za-z]:[\\/]/.test(value);
}

export function extractPortableEnvInputs(
  agentSlug: string,
  envValue: unknown,
  warnings: string[],
): CompanyPortabilityEnvInput[] {
  if (!isPlainRecord(envValue)) return [];
  const env = envValue as Record<string, unknown>;
  const inputs: CompanyPortabilityEnvInput[] = [];

  for (const [key, binding] of Object.entries(env)) {
    if (key.toUpperCase() === "PATH") {
      warnings.push(`Agent ${agentSlug} PATH override was omitted from export because it is system-dependent.`);
      continue;
    }

    if (isPlainRecord(binding) && binding.type === "secret_ref") {
      inputs.push({
        key,
        description: `Provide ${key} for agent ${agentSlug}`,
        agentSlug,
        kind: "secret",
        requirement: "optional",
        defaultValue: "",
        portability: "portable",
      });
      continue;
    }

    if (isPlainRecord(binding) && binding.type === "plain") {
      const defaultValue = asString(binding.value);
      const isSensitive = isSensitiveEnvKey(key);
      const portability = defaultValue && isAbsoluteCommand(defaultValue)
        ? "system_dependent"
        : "portable";
      if (portability === "system_dependent") {
        warnings.push(`Agent ${agentSlug} env ${key} default was exported as system-dependent.`);
      }
      inputs.push({
        key,
        description: `Optional default for ${key} on agent ${agentSlug}`,
        agentSlug,
        kind: isSensitive ? "secret" : "plain",
        requirement: "optional",
        defaultValue: isSensitive ? "" : defaultValue ?? "",
        portability,
      });
      continue;
    }

    if (typeof binding === "string") {
      const portability = isAbsoluteCommand(binding) ? "system_dependent" : "portable";
      if (portability === "system_dependent") {
        warnings.push(`Agent ${agentSlug} env ${key} default was exported as system-dependent.`);
      }
      inputs.push({
        key,
        description: `Optional default for ${key} on agent ${agentSlug}`,
        agentSlug,
        kind: isSensitiveEnvKey(key) ? "secret" : "plain",
        requirement: "optional",
        defaultValue: binding,
        portability,
      });
    }
  }

  return inputs;
}

export function jsonEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function isPathDefault(pathSegments: string[], value: unknown, rules: Array<{ path: string[]; value: unknown }>) {
  return rules.some((rule) => jsonEqual(rule.path, pathSegments) && jsonEqual(rule.value, value));
}

export function pruneDefaultLikeValue(
  value: unknown,
  opts: {
    dropFalseBooleans: boolean;
    path?: string[];
    defaultRules?: Array<{ path: string[]; value: unknown }>;
  },
): unknown {
  const pathSegments = opts.path ?? [];
  if (opts.defaultRules && isPathDefault(pathSegments, value, opts.defaultRules)) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => pruneDefaultLikeValue(entry, { ...opts, path: pathSegments }));
  }
  if (isPlainRecord(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      const next = pruneDefaultLikeValue(entry, {
        ...opts,
        path: [...pathSegments, key],
      });
      if (next === undefined) continue;
      out[key] = next;
    }
    return out;
  }
  if (value === undefined) return undefined;
  if (opts.dropFalseBooleans && value === false) return undefined;
  return value;
}

export function dedupeEnvInputs(values: CompanyPortabilityManifest["envInputs"]) {
  const seen = new Set<string>();
  const out: CompanyPortabilityManifest["envInputs"] = [];
  for (const value of values) {
    const key = `${value.agentSlug ?? ""}:${value.key.toUpperCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

export function buildEnvInputMap(inputs: CompanyPortabilityEnvInput[]) {
  const env: Record<string, Record<string, unknown>> = {};
  for (const input of inputs) {
    const entry: Record<string, unknown> = {
      kind: input.kind,
      requirement: input.requirement,
    };
    if (input.defaultValue !== null) entry.default = input.defaultValue;
    if (input.description) entry.description = input.description;
    if (input.portability === "system_dependent") entry.portability = "system_dependent";
    env[input.key] = entry;
  }
  return env;
}

export function readCompanyApprovalDefault(_frontmatter: Record<string, unknown>) {
  return true;
}

export const DEFAULT_COLLISION_STRATEGY: CompanyPortabilityCollisionStrategy = "rename";

export const COMPANY_LOGO_FILE_NAME = "company-logo";

export const RUNTIME_DEFAULT_RULES: Array<{ path: string[]; value: unknown }> = [
  { path: ["heartbeat", "cooldownSec"], value: 10 },
  { path: ["heartbeat", "intervalSec"], value: 3600 },
  { path: ["heartbeat", "wakeOnOnDemand"], value: true },
  { path: ["heartbeat", "wakeOnAssignment"], value: true },
  { path: ["heartbeat", "wakeOnAutomation"], value: true },
  { path: ["heartbeat", "wakeOnDemand"], value: true },
  { path: ["heartbeat", "maxConcurrentRuns"], value: 3 },
];

export const ADAPTER_DEFAULT_RULES_BY_TYPE: Record<string, Array<{ path: string[]; value: unknown }>> = {
  codex_local: [
    { path: ["timeoutSec"], value: 0 },
    { path: ["graceSec"], value: 15 },
  ],
  gemini_local: [
    { path: ["timeoutSec"], value: 0 },
    { path: ["graceSec"], value: 15 },
  ],
  opencode_local: [
    { path: ["timeoutSec"], value: 0 },
    { path: ["graceSec"], value: 15 },
  ],
  cursor: [
    { path: ["timeoutSec"], value: 0 },
    { path: ["graceSec"], value: 15 },
  ],
  claude_local: [
    { path: ["timeoutSec"], value: 0 },
    { path: ["graceSec"], value: 15 },
    { path: ["maxTurnsPerRun"], value: 300 },
  ],
  openclaw_gateway: [
    { path: ["timeoutSec"], value: 120 },
    { path: ["waitTimeoutMs"], value: 120000 },
    { path: ["sessionKeyStrategy"], value: "fixed" },
    { path: ["sessionKey"], value: "paperclip" },
    { path: ["role"], value: "operator" },
    { path: ["scopes"], value: ["operator.admin"] },
  ],
};
