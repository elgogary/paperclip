import path from "node:path";
import type {
  CompanyPortabilityEnvInput,
  CompanyPortabilityFileEntry,
  CompanyPortabilityIssueRoutineTriggerManifestEntry,
  CompanyPortabilityIssueRoutineManifestEntry,
  CompanyPortabilityIssueManifestEntry,
  CompanyPortabilityManifest,
  CompanyPortabilityProjectWorkspaceManifestEntry,
  CompanyPortabilitySidebarOrder,
} from "@paperclipai/shared";
import {
  ROUTINE_CATCH_UP_POLICIES,
  ROUTINE_CONCURRENCY_POLICIES,
  ROUTINE_TRIGGER_KINDS,
  ROUTINE_TRIGGER_SIGNING_MODES,
  deriveProjectUrlKey,
  normalizeAgentUrlKey,
  asString,
  isPlainRecord,
  normalizePortablePath,
  normalizeSkillSlug,
  normalizeSkillKey,
  parseFrontmatterMarkdown,
  parseYamlFrontmatter,
} from "@paperclipai/shared";
import { unprocessable } from "../errors.js";
import { validateCron } from "./cron.js";
import { deriveManifestSkillKey } from "./portability-skills.js";

type CompanyPackageIncludeEntry = {
  path: string;
};

export type ResolvedSource = {
  manifest: CompanyPortabilityManifest;
  files: Record<string, CompanyPortabilityFileEntry>;
  warnings: string[];
};

type EnvInputRecord = {
  kind: "secret" | "plain";
  requirement: "required" | "optional";
  default?: string | null;
  description?: string | null;
  portability?: "portable" | "system_dependent";
};

// ---------------------------------------------------------------------------
// Internal helpers duplicated from company-portability.ts
// ---------------------------------------------------------------------------

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function asInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function isEmptyObject(value: unknown): boolean {
  return isPlainRecord(value) && Object.keys(value).length === 0;
}

function isEmptyArray(value: unknown): boolean {
  return Array.isArray(value) && value.length === 0;
}

function stripEmptyValues(value: unknown, opts?: { preserveEmptyStrings?: boolean }): unknown {
  if (Array.isArray(value)) {
    const next = value
      .map((entry) => stripEmptyValues(entry, opts))
      .filter((entry) => entry !== undefined);
    return next.length > 0 ? next : undefined;
  }
  if (isPlainRecord(value)) {
    const next: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      const cleaned = stripEmptyValues(entry, opts);
      if (cleaned === undefined) continue;
      next[key] = cleaned;
    }
    return Object.keys(next).length > 0 ? next : undefined;
  }
  if (
    value === undefined ||
    value === null ||
    (!opts?.preserveEmptyStrings && value === "") ||
    isEmptyArray(value) ||
    isEmptyObject(value)
  ) {
    return undefined;
  }
  return value;
}

function normalizePortableSlugList(value: unknown) {
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

function normalizePortableSidebarOrder(value: unknown): CompanyPortabilitySidebarOrder | null {
  if (!isPlainRecord(value)) return null;
  const sidebar = {
    agents: normalizePortableSlugList(value.agents),
    projects: normalizePortableSlugList(value.projects),
  };
  return sidebar.agents.length > 0 || sidebar.projects.length > 0 ? sidebar : null;
}

function parseYamlFile(raw: string): Record<string, unknown> {
  return parseYamlFrontmatter(raw);
}

function readPortableTextFile(
  files: Record<string, CompanyPortabilityFileEntry>,
  filePath: string,
) {
  const value = files[filePath];
  return typeof value === "string" ? value : null;
}

function normalizeFileMap(
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

function resolvePortablePath(fromPath: string, targetPath: string) {
  const baseDir = path.posix.dirname(fromPath.replace(/\\/g, "/"));
  return normalizePortablePath(path.posix.join(baseDir, targetPath.replace(/\\/g, "/")));
}

function normalizePortableProjectWorkspaceExtension(
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

function findPaperclipExtensionPath(files: Record<string, CompanyPortabilityFileEntry>) {
  if (typeof files[".paperclip.yaml"] === "string") return ".paperclip.yaml";
  if (typeof files[".paperclip.yml"] === "string") return ".paperclip.yml";
  return Object.keys(files).find((entry) => entry.endsWith("/.paperclip.yaml") || entry.endsWith("/.paperclip.yml")) ?? null;
}

function readCompanyApprovalDefault(_frontmatter: Record<string, unknown>) {
  return true;
}

function dedupeEnvInputs(values: CompanyPortabilityManifest["envInputs"]) {
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

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

export function normalizeRoutineTriggerExtension(value: unknown): CompanyPortabilityIssueRoutineTriggerManifestEntry | null {
  if (!isPlainRecord(value)) return null;
  const kind = asString(value.kind);
  if (!kind) return null;
  return {
    kind,
    label: asString(value.label),
    enabled: asBoolean(value.enabled) ?? true,
    cronExpression: asString(value.cronExpression),
    timezone: asString(value.timezone),
    signingMode: asString(value.signingMode),
    replayWindowSec: asInteger(value.replayWindowSec),
  };
}

export function normalizeRoutineExtension(value: unknown): CompanyPortabilityIssueRoutineManifestEntry | null {
  if (!isPlainRecord(value)) return null;
  const triggers = Array.isArray(value.triggers)
    ? value.triggers
      .map((entry) => normalizeRoutineTriggerExtension(entry))
      .filter((entry): entry is CompanyPortabilityIssueRoutineTriggerManifestEntry => entry !== null)
    : [];
  const routine = {
    concurrencyPolicy: asString(value.concurrencyPolicy),
    catchUpPolicy: asString(value.catchUpPolicy),
    triggers,
  };
  return stripEmptyValues(routine) ? routine : null;
}

export function buildRoutineManifestFromLiveRoutine(routine: {
  concurrencyPolicy: string;
  catchUpPolicy: string;
  triggers: Array<{
    kind: string;
    label: string | null;
    enabled: boolean;
    cronExpression: string | null;
    timezone: string | null;
    signingMode: string | null;
    replayWindowSec: number | null;
  }>;
}): CompanyPortabilityIssueRoutineManifestEntry {
  return {
    concurrencyPolicy: routine.concurrencyPolicy,
    catchUpPolicy: routine.catchUpPolicy,
    triggers: routine.triggers.map((trigger) => ({
      kind: trigger.kind,
      label: trigger.label ?? null,
      enabled: Boolean(trigger.enabled),
      cronExpression: trigger.kind === "schedule" ? trigger.cronExpression ?? null : null,
      timezone: trigger.kind === "schedule" ? trigger.timezone ?? null : null,
      signingMode: trigger.kind === "webhook" ? trigger.signingMode ?? null : null,
      replayWindowSec: trigger.kind === "webhook" ? trigger.replayWindowSec ?? null : null,
    })),
  };
}

export const WEEKDAY_TO_CRON: Record<string, string> = {
  sunday: "0",
  monday: "1",
  tuesday: "2",
  wednesday: "3",
  thursday: "4",
  friday: "5",
  saturday: "6",
};

export function readZonedDateParts(startsAt: string, timeZone: string) {
  try {
    const date = new Date(startsAt);
    if (Number.isNaN(date.getTime())) return null;
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      weekday: "long",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    });
    const parts = Object.fromEntries(
      formatter
        .formatToParts(date)
        .filter((entry) => entry.type !== "literal")
        .map((entry) => [entry.type, entry.value]),
    ) as Record<string, string>;
    const weekday = WEEKDAY_TO_CRON[parts.weekday?.toLowerCase() ?? ""];
    const month = Number(parts.month);
    const day = Number(parts.day);
    const hour = Number(parts.hour);
    const minute = Number(parts.minute);
    if (!weekday || !Number.isFinite(month) || !Number.isFinite(day) || !Number.isFinite(hour) || !Number.isFinite(minute)) {
      return null;
    }
    return { weekday, month, day, hour, minute };
  } catch {
    return null;
  }
}

export function normalizeCronList(values: string[]) {
  return Array.from(new Set(values)).sort((left, right) => Number(left) - Number(right)).join(",");
}

export function buildLegacyRoutineTriggerFromRecurrence(
  issue: Pick<CompanyPortabilityIssueManifestEntry, "slug" | "legacyRecurrence">,
  scheduleValue: unknown,
) {
  const warnings: string[] = [];
  const errors: string[] = [];
  if (!issue.legacyRecurrence || !isPlainRecord(issue.legacyRecurrence)) {
    return { trigger: null, warnings, errors };
  }

  const schedule = isPlainRecord(scheduleValue) ? scheduleValue : null;
  const frequency = asString(issue.legacyRecurrence.frequency);
  const interval = asInteger(issue.legacyRecurrence.interval) ?? 1;
  if (!frequency) {
    errors.push(`Recurring task ${issue.slug} uses legacy recurrence without frequency; add .paperclip.yaml routines.${issue.slug}.triggers.`);
    return { trigger: null, warnings, errors };
  }
  if (interval < 1) {
    errors.push(`Recurring task ${issue.slug} uses legacy recurrence with an invalid interval; add .paperclip.yaml routines.${issue.slug}.triggers.`);
    return { trigger: null, warnings, errors };
  }

  const timezone = asString(schedule?.timezone) ?? "UTC";
  const startsAt = asString(schedule?.startsAt);
  const zonedStartsAt = startsAt ? readZonedDateParts(startsAt, timezone) : null;
  if (startsAt && !zonedStartsAt) {
    errors.push(`Recurring task ${issue.slug} has an invalid legacy startsAt/timezone combination; add .paperclip.yaml routines.${issue.slug}.triggers.`);
    return { trigger: null, warnings, errors };
  }

  const time = isPlainRecord(issue.legacyRecurrence.time) ? issue.legacyRecurrence.time : null;
  const hour = asInteger(time?.hour) ?? zonedStartsAt?.hour ?? 0;
  const minute = asInteger(time?.minute) ?? zonedStartsAt?.minute ?? 0;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    errors.push(`Recurring task ${issue.slug} uses legacy recurrence with an invalid time; add .paperclip.yaml routines.${issue.slug}.triggers.`);
    return { trigger: null, warnings, errors };
  }

  if (issue.legacyRecurrence.until != null || issue.legacyRecurrence.count != null) {
    warnings.push(`Recurring task ${issue.slug} uses legacy recurrence end bounds; Paperclip will import the routine trigger without those limits.`);
  }

  let cronExpression: string | null = null;

  if (frequency === "hourly") {
    const hourField = interval === 1
      ? "*"
      : zonedStartsAt
        ? `${zonedStartsAt.hour}-23/${interval}`
        : `*/${interval}`;
    cronExpression = `${minute} ${hourField} * * *`;
  } else if (frequency === "daily") {
    if (Array.isArray(issue.legacyRecurrence.weekdays) || Array.isArray(issue.legacyRecurrence.monthDays) || Array.isArray(issue.legacyRecurrence.months)) {
      errors.push(`Recurring task ${issue.slug} uses unsupported legacy daily recurrence constraints; add .paperclip.yaml routines.${issue.slug}.triggers.`);
      return { trigger: null, warnings, errors };
    }
    const dayField = interval === 1 ? "*" : `*/${interval}`;
    cronExpression = `${minute} ${hour} ${dayField} * *`;
  } else if (frequency === "weekly") {
    if (interval !== 1) {
      errors.push(`Recurring task ${issue.slug} uses legacy weekly recurrence with interval > 1; add .paperclip.yaml routines.${issue.slug}.triggers.`);
      return { trigger: null, warnings, errors };
    }
    const weekdays = Array.isArray(issue.legacyRecurrence.weekdays)
      ? issue.legacyRecurrence.weekdays
        .map((entry) => asString(entry))
        .filter((entry): entry is string => Boolean(entry))
      : [];
    const cronWeekdays = weekdays
      .map((entry) => WEEKDAY_TO_CRON[entry.toLowerCase()])
      .filter((entry): entry is string => Boolean(entry));
    if (cronWeekdays.length === 0 && zonedStartsAt?.weekday) {
      cronWeekdays.push(zonedStartsAt.weekday);
    }
    if (cronWeekdays.length === 0) {
      errors.push(`Recurring task ${issue.slug} uses legacy weekly recurrence without weekdays; add .paperclip.yaml routines.${issue.slug}.triggers.`);
      return { trigger: null, warnings, errors };
    }
    cronExpression = `${minute} ${hour} * * ${normalizeCronList(cronWeekdays)}`;
  } else if (frequency === "monthly") {
    if (interval !== 1) {
      errors.push(`Recurring task ${issue.slug} uses legacy monthly recurrence with interval > 1; add .paperclip.yaml routines.${issue.slug}.triggers.`);
      return { trigger: null, warnings, errors };
    }
    if (Array.isArray(issue.legacyRecurrence.ordinalWeekdays) && issue.legacyRecurrence.ordinalWeekdays.length > 0) {
      errors.push(`Recurring task ${issue.slug} uses legacy ordinal monthly recurrence; add .paperclip.yaml routines.${issue.slug}.triggers.`);
      return { trigger: null, warnings, errors };
    }
    const monthDays = Array.isArray(issue.legacyRecurrence.monthDays)
      ? issue.legacyRecurrence.monthDays
        .map((entry) => asInteger(entry))
        .filter((entry): entry is number => entry != null && entry >= 1 && entry <= 31)
      : [];
    if (monthDays.length === 0 && zonedStartsAt?.day) {
      monthDays.push(zonedStartsAt.day);
    }
    if (monthDays.length === 0) {
      errors.push(`Recurring task ${issue.slug} uses legacy monthly recurrence without monthDays; add .paperclip.yaml routines.${issue.slug}.triggers.`);
      return { trigger: null, warnings, errors };
    }
    const months = Array.isArray(issue.legacyRecurrence.months)
      ? issue.legacyRecurrence.months
        .map((entry) => asInteger(entry))
        .filter((entry): entry is number => entry != null && entry >= 1 && entry <= 12)
      : [];
    const monthField = months.length > 0 ? normalizeCronList(months.map(String)) : "*";
    cronExpression = `${minute} ${hour} ${normalizeCronList(monthDays.map(String))} ${monthField} *`;
  } else if (frequency === "yearly") {
    if (interval !== 1) {
      errors.push(`Recurring task ${issue.slug} uses legacy yearly recurrence with interval > 1; add .paperclip.yaml routines.${issue.slug}.triggers.`);
      return { trigger: null, warnings, errors };
    }
    const months = Array.isArray(issue.legacyRecurrence.months)
      ? issue.legacyRecurrence.months
        .map((entry) => asInteger(entry))
        .filter((entry): entry is number => entry != null && entry >= 1 && entry <= 12)
      : [];
    if (months.length === 0 && zonedStartsAt?.month) {
      months.push(zonedStartsAt.month);
    }
    const monthDays = Array.isArray(issue.legacyRecurrence.monthDays)
      ? issue.legacyRecurrence.monthDays
        .map((entry) => asInteger(entry))
        .filter((entry): entry is number => entry != null && entry >= 1 && entry <= 31)
      : [];
    if (monthDays.length === 0 && zonedStartsAt?.day) {
      monthDays.push(zonedStartsAt.day);
    }
    if (months.length === 0 || monthDays.length === 0) {
      errors.push(`Recurring task ${issue.slug} uses legacy yearly recurrence without month/monthDay anchors; add .paperclip.yaml routines.${issue.slug}.triggers.`);
      return { trigger: null, warnings, errors };
    }
    cronExpression = `${minute} ${hour} ${normalizeCronList(monthDays.map(String))} ${normalizeCronList(months.map(String))} *`;
  } else {
    errors.push(`Recurring task ${issue.slug} uses unsupported legacy recurrence frequency "${frequency}"; add .paperclip.yaml routines.${issue.slug}.triggers.`);
    return { trigger: null, warnings, errors };
  }

  return {
    trigger: {
      kind: "schedule",
      label: "Migrated legacy recurrence",
      enabled: true,
      cronExpression,
      timezone,
      signingMode: null,
      replayWindowSec: null,
    } satisfies CompanyPortabilityIssueRoutineTriggerManifestEntry,
    warnings,
    errors,
  };
}

export function resolvePortableRoutineDefinition(
  issue: Pick<CompanyPortabilityIssueManifestEntry, "slug" | "recurring" | "routine" | "legacyRecurrence">,
  scheduleValue: unknown,
) {
  const warnings: string[] = [];
  const errors: string[] = [];
  if (!issue.recurring) {
    return { routine: null, warnings, errors };
  }

  const routine = issue.routine
    ? {
      concurrencyPolicy: issue.routine.concurrencyPolicy,
      catchUpPolicy: issue.routine.catchUpPolicy,
      triggers: [...issue.routine.triggers],
    }
    : {
      concurrencyPolicy: null,
      catchUpPolicy: null,
      triggers: [] as CompanyPortabilityIssueRoutineTriggerManifestEntry[],
    };

  if (routine.concurrencyPolicy && !ROUTINE_CONCURRENCY_POLICIES.includes(routine.concurrencyPolicy as any)) {
    errors.push(`Recurring task ${issue.slug} uses unsupported routine concurrencyPolicy "${routine.concurrencyPolicy}".`);
  }
  if (routine.catchUpPolicy && !ROUTINE_CATCH_UP_POLICIES.includes(routine.catchUpPolicy as any)) {
    errors.push(`Recurring task ${issue.slug} uses unsupported routine catchUpPolicy "${routine.catchUpPolicy}".`);
  }

  for (const trigger of routine.triggers) {
    if (!ROUTINE_TRIGGER_KINDS.includes(trigger.kind as any)) {
      errors.push(`Recurring task ${issue.slug} uses unsupported trigger kind "${trigger.kind}".`);
      continue;
    }
    if (trigger.kind === "schedule") {
      if (!trigger.cronExpression || !trigger.timezone) {
        errors.push(`Recurring task ${issue.slug} has a schedule trigger missing cronExpression/timezone.`);
        continue;
      }
      const cronError = validateCron(trigger.cronExpression);
      if (cronError) {
        errors.push(`Recurring task ${issue.slug} has an invalid schedule trigger: ${cronError}`);
      }
      continue;
    }
    if (trigger.kind === "webhook" && trigger.signingMode && !ROUTINE_TRIGGER_SIGNING_MODES.includes(trigger.signingMode as any)) {
      errors.push(`Recurring task ${issue.slug} uses unsupported webhook signingMode "${trigger.signingMode}".`);
    }
  }

  if (routine.triggers.length === 0 && issue.legacyRecurrence) {
    const migrated = buildLegacyRoutineTriggerFromRecurrence(issue, scheduleValue);
    warnings.push(...migrated.warnings);
    errors.push(...migrated.errors);
    if (migrated.trigger) {
      routine.triggers.push(migrated.trigger);
    }
  }

  return { routine, warnings, errors };
}

export function readIncludeEntries(frontmatter: Record<string, unknown>): CompanyPackageIncludeEntry[] {
  const includes = frontmatter.includes;
  if (!Array.isArray(includes)) return [];
  return includes.flatMap((entry) => {
    if (typeof entry === "string") {
      return [{ path: entry }];
    }
    if (isPlainRecord(entry)) {
      const pathValue = asString(entry.path);
      return pathValue ? [{ path: pathValue }] : [];
    }
    return [];
  });
}

export function readAgentEnvInputs(
  extension: Record<string, unknown>,
  agentSlug: string,
): CompanyPortabilityManifest["envInputs"] {
  const inputs = isPlainRecord(extension.inputs) ? extension.inputs : null;
  const env = inputs && isPlainRecord(inputs.env) ? inputs.env : null;
  if (!env) return [];

  return Object.entries(env).flatMap(([key, value]) => {
    if (!isPlainRecord(value)) return [];
    const record = value as EnvInputRecord;
    return [{
      key,
      description: asString(record.description) ?? null,
      agentSlug,
      kind: record.kind === "plain" ? "plain" : "secret",
      requirement: record.requirement === "required" ? "required" : "optional",
      defaultValue: typeof record.default === "string" ? record.default : null,
      portability: record.portability === "system_dependent" ? "system_dependent" : "portable",
    }];
  });
}

export function readAgentSkillRefs(frontmatter: Record<string, unknown>) {
  const skills = frontmatter.skills;
  if (!Array.isArray(skills)) return [];
  return Array.from(new Set(
    skills
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => normalizeSkillKey(entry) ?? entry.trim())
      .filter(Boolean),
  ));
}

export function buildManifestFromPackageFiles(
  files: Record<string, CompanyPortabilityFileEntry>,
  opts?: { sourceLabel?: { companyId: string; companyName: string } | null },
): ResolvedSource {
  const normalizedFiles = normalizeFileMap(files);
  const companyPath = typeof normalizedFiles["COMPANY.md"] === "string"
    ? normalizedFiles["COMPANY.md"]
    : undefined;
  const resolvedCompanyPath = companyPath !== undefined
    ? "COMPANY.md"
    : Object.keys(normalizedFiles).find((entry) => entry.endsWith("/COMPANY.md") || entry === "COMPANY.md");
  if (!resolvedCompanyPath) {
    throw unprocessable("Company package is missing COMPANY.md");
  }

  const companyMarkdown = readPortableTextFile(normalizedFiles, resolvedCompanyPath);
  if (typeof companyMarkdown !== "string") {
    throw unprocessable(`Company package file is not readable as text: ${resolvedCompanyPath}`);
  }
  const companyDoc = parseFrontmatterMarkdown(companyMarkdown);
  const companyFrontmatter = companyDoc.frontmatter;
  const paperclipExtensionPath = findPaperclipExtensionPath(normalizedFiles);
  const paperclipExtension = paperclipExtensionPath
    ? parseYamlFile(readPortableTextFile(normalizedFiles, paperclipExtensionPath) ?? "")
    : {};
  const paperclipCompany = isPlainRecord(paperclipExtension.company) ? paperclipExtension.company : {};
  const paperclipSidebar = normalizePortableSidebarOrder(paperclipExtension.sidebar);
  const paperclipAgents = isPlainRecord(paperclipExtension.agents) ? paperclipExtension.agents : {};
  const paperclipProjects = isPlainRecord(paperclipExtension.projects) ? paperclipExtension.projects : {};
  const paperclipTasks = isPlainRecord(paperclipExtension.tasks) ? paperclipExtension.tasks : {};
  const paperclipRoutines = isPlainRecord(paperclipExtension.routines) ? paperclipExtension.routines : {};
  const companyName =
    asString(companyFrontmatter.name)
    ?? opts?.sourceLabel?.companyName
    ?? "Imported Company";
  const companySlug =
    asString(companyFrontmatter.slug)
    ?? normalizeAgentUrlKey(companyName)
    ?? "company";

  const includeEntries = readIncludeEntries(companyFrontmatter);
  const referencedAgentPaths = includeEntries
    .map((entry) => resolvePortablePath(resolvedCompanyPath, entry.path))
    .filter((entry) => entry.endsWith("/AGENTS.md") || entry === "AGENTS.md");
  const referencedProjectPaths = includeEntries
    .map((entry) => resolvePortablePath(resolvedCompanyPath, entry.path))
    .filter((entry) => entry.endsWith("/PROJECT.md") || entry === "PROJECT.md");
  const referencedTaskPaths = includeEntries
    .map((entry) => resolvePortablePath(resolvedCompanyPath, entry.path))
    .filter((entry) => entry.endsWith("/TASK.md") || entry === "TASK.md");
  const referencedSkillPaths = includeEntries
    .map((entry) => resolvePortablePath(resolvedCompanyPath, entry.path))
    .filter((entry) => entry.endsWith("/SKILL.md") || entry === "SKILL.md");
  const discoveredAgentPaths = Object.keys(normalizedFiles).filter(
    (entry) => entry.endsWith("/AGENTS.md") || entry === "AGENTS.md",
  );
  const discoveredProjectPaths = Object.keys(normalizedFiles).filter(
    (entry) => entry.endsWith("/PROJECT.md") || entry === "PROJECT.md",
  );
  const discoveredTaskPaths = Object.keys(normalizedFiles).filter(
    (entry) => entry.endsWith("/TASK.md") || entry === "TASK.md",
  );
  const discoveredSkillPaths = Object.keys(normalizedFiles).filter(
    (entry) => entry.endsWith("/SKILL.md") || entry === "SKILL.md",
  );
  const agentPaths = Array.from(new Set([...referencedAgentPaths, ...discoveredAgentPaths])).sort();
  const projectPaths = Array.from(new Set([...referencedProjectPaths, ...discoveredProjectPaths])).sort();
  const taskPaths = Array.from(new Set([...referencedTaskPaths, ...discoveredTaskPaths])).sort();
  const skillPaths = Array.from(new Set([...referencedSkillPaths, ...discoveredSkillPaths])).sort();

  const manifest: CompanyPortabilityManifest = {
    schemaVersion: 4,
    generatedAt: new Date().toISOString(),
    source: opts?.sourceLabel ?? null,
    includes: {
      company: true,
      agents: true,
      projects: projectPaths.length > 0,
      issues: taskPaths.length > 0,
      skills: skillPaths.length > 0,
    },
    company: {
      path: resolvedCompanyPath,
      name: companyName,
      description: asString(companyFrontmatter.description),
      brandColor: asString(paperclipCompany.brandColor),
      logoPath: asString(paperclipCompany.logoPath) ?? asString(paperclipCompany.logo),
      requireBoardApprovalForNewAgents:
        typeof paperclipCompany.requireBoardApprovalForNewAgents === "boolean"
          ? paperclipCompany.requireBoardApprovalForNewAgents
          : readCompanyApprovalDefault(companyFrontmatter),
    },
    sidebar: paperclipSidebar,
    agents: [],
    skills: [],
    projects: [],
    issues: [],
    envInputs: [],
  };

  const warnings: string[] = [];
  if (manifest.company?.logoPath && !normalizedFiles[manifest.company.logoPath]) {
    warnings.push(`Referenced company logo file is missing from package: ${manifest.company.logoPath}`);
  }
  for (const agentPath of agentPaths) {
    const markdownRaw = readPortableTextFile(normalizedFiles, agentPath);
    if (typeof markdownRaw !== "string") {
      warnings.push(`Referenced agent file is missing from package: ${agentPath}`);
      continue;
    }
    const agentDoc = parseFrontmatterMarkdown(markdownRaw);
    const frontmatter = agentDoc.frontmatter;
    const fallbackSlug = normalizeAgentUrlKey(path.posix.basename(path.posix.dirname(agentPath))) ?? "agent";
    const slug = asString(frontmatter.slug) ?? fallbackSlug;
    const extension = isPlainRecord(paperclipAgents[slug]) ? paperclipAgents[slug] : {};
    const extensionAdapter = isPlainRecord(extension.adapter) ? extension.adapter : null;
    const extensionRuntime = isPlainRecord(extension.runtime) ? extension.runtime : null;
    const extensionPermissions = isPlainRecord(extension.permissions) ? extension.permissions : null;
    const extensionMetadata = isPlainRecord(extension.metadata) ? extension.metadata : null;
    const adapterConfig = isPlainRecord(extensionAdapter?.config)
      ? extensionAdapter.config
      : {};
    const runtimeConfig = extensionRuntime ?? {};
    const title = asString(frontmatter.title);

    manifest.agents.push({
      slug,
      name: asString(frontmatter.name) ?? title ?? slug,
      path: agentPath,
      skills: readAgentSkillRefs(frontmatter),
      role: asString(extension.role) ?? "agent",
      title,
      icon: asString(extension.icon),
      capabilities: asString(extension.capabilities),
      reportsToSlug: asString(frontmatter.reportsTo) ?? asString(extension.reportsTo),
      adapterType: asString(extensionAdapter?.type) ?? "process",
      adapterConfig,
      runtimeConfig,
      permissions: extensionPermissions ?? {},
      budgetMonthlyCents:
        typeof extension.budgetMonthlyCents === "number" && Number.isFinite(extension.budgetMonthlyCents)
          ? Math.max(0, Math.floor(extension.budgetMonthlyCents))
          : 0,
      metadata: extensionMetadata,
    });

    manifest.envInputs.push(...readAgentEnvInputs(extension, slug));

    if (frontmatter.kind && frontmatter.kind !== "agent") {
      warnings.push(`Agent markdown ${agentPath} does not declare kind: agent in frontmatter.`);
    }
  }

  for (const skillPath of skillPaths) {
    const markdownRaw = readPortableTextFile(normalizedFiles, skillPath);
    if (typeof markdownRaw !== "string") {
      warnings.push(`Referenced skill file is missing from package: ${skillPath}`);
      continue;
    }
    const skillDoc = parseFrontmatterMarkdown(markdownRaw);
    const frontmatter = skillDoc.frontmatter;
    const skillDir = path.posix.dirname(skillPath);
    const fallbackSlug = normalizeAgentUrlKey(path.posix.basename(skillDir)) ?? "skill";
    const slug = asString(frontmatter.slug) ?? normalizeAgentUrlKey(asString(frontmatter.name) ?? "") ?? fallbackSlug;
    const inventory = Object.keys(normalizedFiles)
      .filter((entry) => entry === skillPath || entry.startsWith(`${skillDir}/`))
      .map((entry) => ({
        path: entry === skillPath ? "SKILL.md" : entry.slice(skillDir.length + 1),
        kind: entry === skillPath
          ? "skill"
          : entry.startsWith(`${skillDir}/references/`)
            ? "reference"
            : entry.startsWith(`${skillDir}/scripts/`)
              ? "script"
              : entry.startsWith(`${skillDir}/assets/`)
                ? "asset"
                : entry.endsWith(".md")
                  ? "markdown"
                  : "other",
      }));
    const metadata = isPlainRecord(frontmatter.metadata) ? frontmatter.metadata : null;
    const sources = metadata && Array.isArray(metadata.sources) ? metadata.sources : [];
    const primarySource = sources.find((entry) => isPlainRecord(entry)) as Record<string, unknown> | undefined;
    const sourceKind = asString(primarySource?.kind);
    let sourceType = "catalog";
    let sourceLocator: string | null = null;
    let sourceRef: string | null = null;
    let normalizedMetadata: Record<string, unknown> | null = null;

    if (sourceKind === "github-dir" || sourceKind === "github-file") {
      const repo = asString(primarySource?.repo);
      const repoPath = asString(primarySource?.path);
      const commit = asString(primarySource?.commit);
      const trackingRef = asString(primarySource?.trackingRef);
      const [owner, repoName] = (repo ?? "").split("/");
      sourceType = "github";
      sourceLocator = asString(primarySource?.url)
        ?? (repo ? `https://github.com/${repo}${repoPath ? `/tree/${trackingRef ?? commit ?? "main"}/${repoPath}` : ""}` : null);
      sourceRef = commit;
      normalizedMetadata = owner && repoName
        ? {
            sourceKind: "github",
            owner,
            repo: repoName,
            ref: commit,
            trackingRef,
            repoSkillDir: repoPath ?? `skills/${slug}`,
          }
        : null;
    } else if (sourceKind === "url") {
      sourceType = "url";
      sourceLocator = asString(primarySource?.url) ?? asString(primarySource?.rawUrl);
      normalizedMetadata = {
        sourceKind: "url",
      };
    } else if (metadata) {
      normalizedMetadata = {
        sourceKind: "catalog",
      };
    }
    const key = deriveManifestSkillKey(frontmatter, slug, normalizedMetadata, sourceType, sourceLocator);

    manifest.skills.push({
      key,
      slug,
      name: asString(frontmatter.name) ?? slug,
      path: skillPath,
      description: asString(frontmatter.description),
      sourceType,
      sourceLocator,
      sourceRef,
      trustLevel: null,
      compatibility: "compatible",
      metadata: normalizedMetadata,
      fileInventory: inventory,
    });
  }

  for (const projectPath of projectPaths) {
    const markdownRaw = readPortableTextFile(normalizedFiles, projectPath);
    if (typeof markdownRaw !== "string") {
      warnings.push(`Referenced project file is missing from package: ${projectPath}`);
      continue;
    }
    const projectDoc = parseFrontmatterMarkdown(markdownRaw);
    const frontmatter = projectDoc.frontmatter;
    const fallbackSlug = deriveProjectUrlKey(
      asString(frontmatter.name) ?? path.posix.basename(path.posix.dirname(projectPath)) ?? "project",
      projectPath,
    );
    const slug = asString(frontmatter.slug) ?? fallbackSlug;
    const extension = isPlainRecord(paperclipProjects[slug]) ? paperclipProjects[slug] : {};
    const workspaceExtensions = isPlainRecord(extension.workspaces) ? extension.workspaces : {};
    const workspaces = Object.entries(workspaceExtensions)
      .map(([workspaceKey, entry]) => normalizePortableProjectWorkspaceExtension(workspaceKey, entry))
      .filter((entry): entry is CompanyPortabilityProjectWorkspaceManifestEntry => entry !== null);
    manifest.projects.push({
      slug,
      name: asString(frontmatter.name) ?? slug,
      path: projectPath,
      description: asString(frontmatter.description),
      ownerAgentSlug: asString(frontmatter.owner),
      leadAgentSlug: asString(extension.leadAgentSlug),
      targetDate: asString(extension.targetDate),
      color: asString(extension.color),
      status: asString(extension.status),
      executionWorkspacePolicy: isPlainRecord(extension.executionWorkspacePolicy)
        ? extension.executionWorkspacePolicy
        : null,
      workspaces,
      metadata: isPlainRecord(extension.metadata) ? extension.metadata : null,
    });
    if (frontmatter.kind && frontmatter.kind !== "project") {
      warnings.push(`Project markdown ${projectPath} does not declare kind: project in frontmatter.`);
    }
  }

  for (const taskPath of taskPaths) {
    const markdownRaw = readPortableTextFile(normalizedFiles, taskPath);
    if (typeof markdownRaw !== "string") {
      warnings.push(`Referenced task file is missing from package: ${taskPath}`);
      continue;
    }
    const taskDoc = parseFrontmatterMarkdown(markdownRaw);
    const frontmatter = taskDoc.frontmatter;
    const fallbackSlug = normalizeAgentUrlKey(path.posix.basename(path.posix.dirname(taskPath))) ?? "task";
    const slug = asString(frontmatter.slug) ?? fallbackSlug;
    const extension = isPlainRecord(paperclipTasks[slug]) ? paperclipTasks[slug] : {};
    const routineExtension = normalizeRoutineExtension(paperclipRoutines[slug]);
    const routineExtensionRaw = isPlainRecord(paperclipRoutines[slug]) ? paperclipRoutines[slug] : {};
    const schedule = isPlainRecord(frontmatter.schedule) ? frontmatter.schedule : null;
    const legacyRecurrence = schedule && isPlainRecord(schedule.recurrence)
      ? schedule.recurrence
      : isPlainRecord(extension.recurrence)
        ? extension.recurrence
        : null;
    const recurring =
      asBoolean(frontmatter.recurring) === true
      || routineExtension !== null
      || legacyRecurrence !== null;
    manifest.issues.push({
      slug,
      identifier: asString(extension.identifier),
      title: asString(frontmatter.name) ?? asString(frontmatter.title) ?? slug,
      path: taskPath,
      projectSlug: asString(frontmatter.project),
      projectWorkspaceKey: asString(extension.projectWorkspaceKey),
      assigneeAgentSlug: asString(frontmatter.assignee),
      description: taskDoc.body || asString(frontmatter.description),
      recurring,
      routine: routineExtension,
      legacyRecurrence,
      status: asString(extension.status) ?? asString(routineExtensionRaw.status),
      priority: asString(extension.priority) ?? asString(routineExtensionRaw.priority),
      labelIds: Array.isArray(extension.labelIds)
        ? extension.labelIds.filter((entry): entry is string => typeof entry === "string")
        : [],
      billingCode: asString(extension.billingCode),
      executionWorkspaceSettings: isPlainRecord(extension.executionWorkspaceSettings)
        ? extension.executionWorkspaceSettings
        : null,
      assigneeAdapterOverrides: isPlainRecord(extension.assigneeAdapterOverrides)
        ? extension.assigneeAdapterOverrides
        : null,
      metadata: isPlainRecord(extension.metadata) ? extension.metadata : null,
    });
    if (frontmatter.kind && frontmatter.kind !== "task") {
      warnings.push(`Task markdown ${taskPath} does not declare kind: task in frontmatter.`);
    }
  }

  manifest.envInputs = dedupeEnvInputs(manifest.envInputs);
  return {
    manifest,
    files: normalizedFiles,
    warnings,
  };
}
