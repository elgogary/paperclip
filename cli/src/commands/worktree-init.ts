import {
  existsSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { eq } from "drizzle-orm";
import {
  applyPendingMigrations,
  createDb,
  ensurePostgresDatabase,
  formatDatabaseBackupResult,
  projectWorkspaces,
  runDatabaseBackup,
  runDatabaseRestore,
} from "@paperclipai/db";
import { ensureAgentJwtSecret, loadPaperclipEnvFile, mergePaperclipEnvEntries, readPaperclipEnvEntries, resolvePaperclipEnvFile } from "../config/env.js";
import { readConfig, resolveConfigPath } from "../config/store.js";
import { printPaperclipCliBanner } from "../utils/banner.js";
import {
  buildWorktreeConfig,
  buildWorktreeEnvEntries,
  DEFAULT_WORKTREE_HOME,
  generateWorktreeColor,
  isWorktreeSeedMode,
  resolveSuggestedWorktreeName,
  resolveWorktreeSeedPlan,
  resolveWorktreeLocalPaths,
  sanitizeWorktreeInstanceId,
  type WorktreeSeedMode,
  type WorktreeLocalPaths,
} from "./worktree-lib.js";
import type { PaperclipConfig } from "../config/schema.js";
import {
  type WorktreeInitOptions,
  type WorktreeMakeOptions,
  type EmbeddedPostgresHandle,
  type SeedWorktreeDatabaseResult,
  nonEmpty,
  resolveWorktreeMakeName,
  resolveWorktreeHome,
  resolveWorktreeStartPoint,
  resolveSourceConfigPath,
  resolveSourceConnectionString,
  copySeededSecretsKey,
  ensureEmbeddedPostgres,
  findAvailablePort,
  detectGitBranchName,
  detectGitWorkspaceInfo,
  copyGitHooksToWorktreeGitDir,
  rebindWorkspaceCwd,
  extractExecSyncErrorMessage,
  localBranchExists,
  resolveGitWorktreeAddArgs,
  resolveWorktreeMakeTargetPath,
} from "./worktree-helpers.js";

async function rebindSeededProjectWorkspaces(input: {
  targetConnectionString: string;
  currentCwd: string;
}): Promise<SeedWorktreeDatabaseResult["reboundWorkspaces"]> {
  const targetRepo = detectGitWorkspaceInfo(input.currentCwd);
  if (!targetRepo) return [];

  const db = createDb(input.targetConnectionString);
  const closableDb = db as typeof db & {
    $client?: { end?: (opts?: { timeout?: number }) => Promise<void> };
  };

  try {
    const rows = await db
      .select({
        id: projectWorkspaces.id,
        name: projectWorkspaces.name,
        cwd: projectWorkspaces.cwd,
      })
      .from(projectWorkspaces);

    const rebound: SeedWorktreeDatabaseResult["reboundWorkspaces"] = [];
    for (const row of rows) {
      const workspaceCwd = nonEmpty(row.cwd);
      if (!workspaceCwd) continue;

      const sourceRepo = detectGitWorkspaceInfo(workspaceCwd);
      if (!sourceRepo) continue;
      if (sourceRepo.commonDir !== targetRepo.commonDir) continue;

      const reboundCwd = rebindWorkspaceCwd({
        sourceRepoRoot: sourceRepo.root,
        targetRepoRoot: targetRepo.root,
        workspaceCwd,
      });
      if (!reboundCwd) continue;

      const normalizedCurrent = path.resolve(workspaceCwd);
      if (reboundCwd === normalizedCurrent) continue;
      if (!existsSync(reboundCwd)) continue;

      await db
        .update(projectWorkspaces)
        .set({
          cwd: reboundCwd,
          updatedAt: new Date(),
        })
        .where(eq(projectWorkspaces.id, row.id));

      rebound.push({
        name: row.name,
        fromCwd: normalizedCurrent,
        toCwd: reboundCwd,
      });
    }

    return rebound;
  } finally {
    await closableDb.$client?.end?.({ timeout: 5 }).catch(() => undefined);
  }
}

async function seedWorktreeDatabase(input: {
  sourceConfigPath: string;
  sourceConfig: PaperclipConfig;
  targetConfig: PaperclipConfig;
  targetPaths: WorktreeLocalPaths;
  instanceId: string;
  seedMode: WorktreeSeedMode;
}): Promise<SeedWorktreeDatabaseResult> {
  const seedPlan = resolveWorktreeSeedPlan(input.seedMode);
  const sourceEnvFile = resolvePaperclipEnvFile(input.sourceConfigPath);
  const sourceEnvEntries = readPaperclipEnvEntries(sourceEnvFile);
  copySeededSecretsKey({
    sourceConfigPath: input.sourceConfigPath,
    sourceConfig: input.sourceConfig,
    sourceEnvEntries,
    targetKeyFilePath: input.targetPaths.secretsKeyFilePath,
  });
  let sourceHandle: EmbeddedPostgresHandle | null = null;
  let targetHandle: EmbeddedPostgresHandle | null = null;

  try {
    if (input.sourceConfig.database.mode === "embedded-postgres") {
      sourceHandle = await ensureEmbeddedPostgres(
        input.sourceConfig.database.embeddedPostgresDataDir,
        input.sourceConfig.database.embeddedPostgresPort,
      );
    }
    const sourceConnectionString = resolveSourceConnectionString(
      input.sourceConfig,
      sourceEnvEntries,
      sourceHandle?.port,
    );
    const backup = await runDatabaseBackup({
      connectionString: sourceConnectionString,
      backupDir: path.resolve(input.targetPaths.backupDir, "seed"),
      retentionDays: 7,
      filenamePrefix: `${input.instanceId}-seed`,
      includeMigrationJournal: true,
      excludeTables: seedPlan.excludedTables,
      nullifyColumns: seedPlan.nullifyColumns,
    });

    targetHandle = await ensureEmbeddedPostgres(
      input.targetConfig.database.embeddedPostgresDataDir,
      input.targetConfig.database.embeddedPostgresPort,
    );

    const adminConnectionString = `postgres://paperclip:paperclip@127.0.0.1:${targetHandle.port}/postgres`;
    await ensurePostgresDatabase(adminConnectionString, "paperclip");
    const targetConnectionString = `postgres://paperclip:paperclip@127.0.0.1:${targetHandle.port}/paperclip`;
    await runDatabaseRestore({
      connectionString: targetConnectionString,
      backupFile: backup.backupFile,
    });
    await applyPendingMigrations(targetConnectionString);
    const reboundWorkspaces = await rebindSeededProjectWorkspaces({
      targetConnectionString,
      currentCwd: input.targetPaths.cwd,
    });

    return {
      backupSummary: formatDatabaseBackupResult(backup),
      reboundWorkspaces,
    };
  } finally {
    if (targetHandle?.startedByThisProcess) {
      await targetHandle.stop();
    }
    if (sourceHandle?.startedByThisProcess) {
      await sourceHandle.stop();
    }
  }
}

async function runWorktreeInit(opts: WorktreeInitOptions): Promise<void> {
  const cwd = process.cwd();
  const worktreeName = resolveSuggestedWorktreeName(
    cwd,
    opts.name ?? detectGitBranchName(cwd) ?? undefined,
  );
  const seedMode = opts.seedMode ?? "minimal";
  if (!isWorktreeSeedMode(seedMode)) {
    throw new Error(`Unsupported seed mode "${seedMode}". Expected one of: minimal, full.`);
  }
  const instanceId = sanitizeWorktreeInstanceId(opts.instance ?? worktreeName);
  const paths = resolveWorktreeLocalPaths({
    cwd,
    homeDir: resolveWorktreeHome(opts.home),
    instanceId,
  });
  const branding = {
    name: worktreeName,
    color: generateWorktreeColor(),
  };
  const sourceConfigPath = resolveSourceConfigPath(opts);
  const sourceConfig = existsSync(sourceConfigPath) ? readConfig(sourceConfigPath) : null;

  if ((existsSync(paths.configPath) || existsSync(paths.instanceRoot)) && !opts.force) {
    throw new Error(
      `Worktree config already exists at ${paths.configPath} or instance data exists at ${paths.instanceRoot}. Re-run with --force to replace it.`,
    );
  }

  if (opts.force) {
    rmSync(paths.repoConfigDir, { recursive: true, force: true });
    rmSync(paths.instanceRoot, { recursive: true, force: true });
  }

  const preferredServerPort = opts.serverPort ?? ((sourceConfig?.server.port ?? 3100) + 1);
  const serverPort = await findAvailablePort(preferredServerPort);
  const preferredDbPort = opts.dbPort ?? ((sourceConfig?.database.embeddedPostgresPort ?? 54329) + 1);
  const databasePort = await findAvailablePort(preferredDbPort, new Set([serverPort]));
  const targetConfig = buildWorktreeConfig({
    sourceConfig,
    paths,
    serverPort,
    databasePort,
  });

  writeConfig(targetConfig, paths.configPath);
  const sourceEnvEntries = readPaperclipEnvEntries(resolvePaperclipEnvFile(sourceConfigPath));
  const existingAgentJwtSecret =
    nonEmpty(sourceEnvEntries.PAPERCLIP_AGENT_JWT_SECRET) ??
    nonEmpty(process.env.PAPERCLIP_AGENT_JWT_SECRET);
  mergePaperclipEnvEntries(
    {
      ...buildWorktreeEnvEntries(paths, branding),
      ...(existingAgentJwtSecret ? { PAPERCLIP_AGENT_JWT_SECRET: existingAgentJwtSecret } : {}),
    },
    paths.envPath,
  );
  ensureAgentJwtSecret(paths.configPath);
  loadPaperclipEnvFile(paths.configPath);
  const copiedGitHooks = copyGitHooksToWorktreeGitDir(cwd);

  let seedSummary: string | null = null;
  let reboundWorkspaceSummary: SeedWorktreeDatabaseResult["reboundWorkspaces"] = [];
  if (opts.seed !== false) {
    if (!sourceConfig) {
      throw new Error(
        `Cannot seed worktree database because source config was not found at ${sourceConfigPath}. Use --no-seed or provide --from-config.`,
      );
    }
    const spinner = p.spinner();
    spinner.start(`Seeding isolated worktree database from source instance (${seedMode})...`);
    try {
      const seeded = await seedWorktreeDatabase({
        sourceConfigPath,
        sourceConfig,
        targetConfig,
        targetPaths: paths,
        instanceId,
        seedMode,
      });
      seedSummary = seeded.backupSummary;
      reboundWorkspaceSummary = seeded.reboundWorkspaces;
      spinner.stop(`Seeded isolated worktree database (${seedMode}).`);
    } catch (error) {
      spinner.stop(pc.red("Failed to seed worktree database."));
      throw error;
    }
  }

  p.log.message(pc.dim(`Repo config: ${paths.configPath}`));
  p.log.message(pc.dim(`Repo env: ${paths.envPath}`));
  p.log.message(pc.dim(`Isolated home: ${paths.homeDir}`));
  p.log.message(pc.dim(`Instance: ${paths.instanceId}`));
  p.log.message(pc.dim(`Worktree badge: ${branding.name} (${branding.color})`));
  p.log.message(pc.dim(`Server port: ${serverPort} | DB port: ${databasePort}`));
  if (copiedGitHooks?.copied) {
    p.log.message(
      pc.dim(`Mirrored git hooks: ${copiedGitHooks.sourceHooksPath} -> ${copiedGitHooks.targetHooksPath}`),
    );
  }
  if (seedSummary) {
    p.log.message(pc.dim(`Seed mode: ${seedMode}`));
    p.log.message(pc.dim(`Seed snapshot: ${seedSummary}`));
    for (const rebound of reboundWorkspaceSummary) {
      p.log.message(
        pc.dim(`Rebound workspace ${rebound.name}: ${rebound.fromCwd} -> ${rebound.toCwd}`),
      );
    }
  }
  p.outro(
    pc.green(
      `Worktree ready. Run Paperclip inside this repo and the CLI/server will use ${paths.instanceId} automatically.`,
    ),
  );
}

import { writeConfig } from "../config/store.js";

export async function worktreeInitCommand(opts: WorktreeInitOptions): Promise<void> {
  printPaperclipCliBanner();
  p.intro(pc.bgCyan(pc.black(" paperclipai worktree init ")));
  await runWorktreeInit(opts);
}

export async function worktreeMakeCommand(nameArg: string, opts: WorktreeMakeOptions): Promise<void> {
  printPaperclipCliBanner();
  p.intro(pc.bgCyan(pc.black(" paperclipai worktree:make ")));

  const name = resolveWorktreeMakeName(nameArg);
  const startPoint = resolveWorktreeStartPoint(opts.startPoint);
  const sourceCwd = process.cwd();
  const sourceConfigPath = resolveSourceConfigPath(opts);
  const targetPath = resolveWorktreeMakeTargetPath(name);
  if (existsSync(targetPath)) {
    throw new Error(`Target path already exists: ${targetPath}`);
  }

  mkdirSync(path.dirname(targetPath), { recursive: true });
  if (startPoint) {
    const [remote] = startPoint.split("/", 1);
    try {
      execFileSync("git", ["fetch", remote], {
        cwd: sourceCwd,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      throw new Error(
        `Failed to fetch from remote "${remote}": ${extractExecSyncErrorMessage(error) ?? String(error)}`,
      );
    }
  }

  const worktreeArgs = resolveGitWorktreeAddArgs({
    branchName: name,
    targetPath,
    branchExists: !startPoint && localBranchExists(sourceCwd, name),
    startPoint,
  });

  const spinner = p.spinner();
  spinner.start(`Creating git worktree at ${targetPath}...`);
  try {
    execFileSync("git", worktreeArgs, {
      cwd: sourceCwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    spinner.stop(`Created git worktree at ${targetPath}.`);
  } catch (error) {
    spinner.stop(pc.red("Failed to create git worktree."));
    throw new Error(extractExecSyncErrorMessage(error) ?? String(error));
  }

  const installSpinner = p.spinner();
  installSpinner.start("Installing dependencies...");
  try {
    execFileSync("pnpm", ["install"], {
      cwd: targetPath,
      stdio: ["ignore", "pipe", "pipe"],
    });
    installSpinner.stop("Installed dependencies.");
  } catch (error) {
    installSpinner.stop(pc.yellow("Failed to install dependencies (continuing anyway)."));
    p.log.warning(extractExecSyncErrorMessage(error) ?? String(error));
  }

  const originalCwd = process.cwd();
  try {
    process.chdir(targetPath);
    await runWorktreeInit({
      ...opts,
      name,
      sourceConfigPathOverride: sourceConfigPath,
    });
  } catch (error) {
    throw error;
  } finally {
    process.chdir(originalCwd);
  }
}

export function registerWorktreeInitCommands(worktree: import("commander").Command, program: import("commander").Command): void {
  program
    .command("worktree:make")
    .description("Create ~/NAME as a git worktree, then initialize an isolated Paperclip instance inside it")
    .argument("<name>", "Worktree name — auto-prefixed with paperclip- if needed (created at ~/paperclip-NAME)")
    .option("--start-point <ref>", "Remote ref to base the new branch on (env: PAPERCLIP_WORKTREE_START_POINT)")
    .option("--instance <id>", "Explicit isolated instance id")
    .option("--home <path>", `Home root for worktree instances (env: PAPERCLIP_WORKTREES_DIR, default: ${DEFAULT_WORKTREE_HOME})`)
    .option("--from-config <path>", "Source config.json to seed from")
    .option("--from-data-dir <path>", "Source PAPERCLIP_HOME used when deriving the source config")
    .option("--from-instance <id>", "Source instance id when deriving the source config", "default")
    .option("--server-port <port>", "Preferred server port", (value: string) => Number(value))
    .option("--db-port <port>", "Preferred embedded Postgres port", (value: string) => Number(value))
    .option("--seed-mode <mode>", "Seed profile: minimal or full (default: minimal)", "minimal")
    .option("--no-seed", "Skip database seeding from the source instance")
    .option("--force", "Replace existing repo-local config and isolated instance data", false)
    .action(worktreeMakeCommand);

  worktree
    .command("init")
    .description("Create repo-local config/env and an isolated instance for this worktree")
    .option("--name <name>", "Display name used to derive the instance id")
    .option("--instance <id>", "Explicit isolated instance id")
    .option("--home <path>", `Home root for worktree instances (env: PAPERCLIP_WORKTREES_DIR, default: ${DEFAULT_WORKTREE_HOME})`)
    .option("--from-config <path>", "Source config.json to seed from")
    .option("--from-data-dir <path>", "Source PAPERCLIP_HOME used when deriving the source config")
    .option("--from-instance <id>", "Source instance id when deriving the source config", "default")
    .option("--server-port <port>", "Preferred server port", (value: string) => Number(value))
    .option("--db-port <port>", "Preferred embedded Postgres port", (value: string) => Number(value))
    .option("--seed-mode <mode>", "Seed profile: minimal or full (default: minimal)", "minimal")
    .option("--no-seed", "Skip database seeding from the source instance")
    .option("--force", "Replace existing repo-local config and isolated instance data", false)
    .action(worktreeInitCommand);
}
