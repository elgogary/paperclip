import {
  existsSync,
  rmSync,
} from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { expandHomePrefix } from "../config/home.js";
import { resolveConfigPath } from "../config/store.js";
import { readPaperclipEnvEntries, resolvePaperclipEnvFile } from "../config/env.js";
import { printPaperclipCliBanner } from "../utils/banner.js";
import {
  DEFAULT_WORKTREE_HOME,
  formatShellExports,
  sanitizeWorktreeInstanceId,
} from "./worktree-lib.js";
import {
  type WorktreeCleanupOptions,
  type WorktreeEnvOptions,
  type WorktreeListOptions,
  resolveWorktreeMakeName,
  resolveWorktreeHome,
  resolveWorktreeMakeTargetPath,
  extractExecSyncErrorMessage,
  localBranchExists,
  parseGitWorktreeList,
  toMergeSourceChoices,
} from "./worktree-helpers.js";

function branchHasUniqueCommits(cwd: string, branchName: string): boolean {
  try {
    const output = execFileSync(
      "git",
      ["log", "--oneline", branchName, "--not", "--remotes", "--exclude", `refs/heads/${branchName}`, "--branches"],
      { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    ).trim();
    return output.length > 0;
  } catch {
    return false;
  }
}

function branchExistsOnAnyRemote(cwd: string, branchName: string): boolean {
  try {
    const output = execFileSync(
      "git",
      ["branch", "-r", "--list", `*/${branchName}`],
      { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    ).trim();
    return output.length > 0;
  } catch {
    return false;
  }
}

function worktreePathHasUncommittedChanges(worktreePath: string): boolean {
  try {
    const output = execFileSync(
      "git",
      ["status", "--porcelain"],
      { cwd: worktreePath, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    ).trim();
    return output.length > 0;
  } catch {
    return false;
  }
}

export async function worktreeCleanupCommand(nameArg: string, opts: WorktreeCleanupOptions): Promise<void> {
  printPaperclipCliBanner();
  p.intro(pc.bgCyan(pc.black(" paperclipai worktree:cleanup ")));

  const name = resolveWorktreeMakeName(nameArg);
  const sourceCwd = process.cwd();
  const targetPath = resolveWorktreeMakeTargetPath(name);
  const instanceId = sanitizeWorktreeInstanceId(opts.instance ?? name);
  const homeDir = path.resolve(expandHomePrefix(resolveWorktreeHome(opts.home)));
  const instanceRoot = path.resolve(homeDir, "instances", instanceId);

  // -- 1. Assess current state --

  const hasBranch = localBranchExists(sourceCwd, name);
  const hasTargetDir = existsSync(targetPath);
  const hasInstanceData = existsSync(instanceRoot);

  const worktrees = parseGitWorktreeList(sourceCwd);
  const linkedWorktree = worktrees.find(
    (wt) => wt.branch === `refs/heads/${name}` || path.resolve(wt.worktree) === path.resolve(targetPath),
  );

  if (!hasBranch && !hasTargetDir && !hasInstanceData && !linkedWorktree) {
    p.log.info("Nothing to clean up — no branch, worktree directory, or instance data found.");
    p.outro(pc.green("Already clean."));
    return;
  }

  // -- 2. Safety checks --

  const problems: string[] = [];

  if (hasBranch && branchHasUniqueCommits(sourceCwd, name)) {
    const onRemote = branchExistsOnAnyRemote(sourceCwd, name);
    if (onRemote) {
      p.log.info(
        `Branch "${name}" has unique local commits, but the branch also exists on a remote — safe to delete locally.`,
      );
    } else {
      problems.push(
        `Branch "${name}" has commits not found on any other branch or remote. ` +
          `Deleting it will lose work. Push it first, or use --force.`,
      );
    }
  }

  if (hasTargetDir && worktreePathHasUncommittedChanges(targetPath)) {
    problems.push(
      `Worktree directory ${targetPath} has uncommitted changes. Commit or stash first, or use --force.`,
    );
  }

  if (problems.length > 0 && !opts.force) {
    for (const problem of problems) {
      p.log.error(problem);
    }
    throw new Error("Safety checks failed. Resolve the issues above or re-run with --force.");
  }
  if (problems.length > 0 && opts.force) {
    for (const problem of problems) {
      p.log.warning(`Overridden by --force: ${problem}`);
    }
  }

  // -- 3. Clean up (idempotent steps) --

  // 3a. Remove the git worktree registration
  if (linkedWorktree) {
    const worktreeDirExists = existsSync(linkedWorktree.worktree);
    const spinner = p.spinner();
    if (worktreeDirExists) {
      spinner.start(`Removing git worktree at ${linkedWorktree.worktree}...`);
      try {
        const removeArgs = ["worktree", "remove", linkedWorktree.worktree];
        if (opts.force) removeArgs.push("--force");
        execFileSync("git", removeArgs, {
          cwd: sourceCwd,
          stdio: ["ignore", "pipe", "pipe"],
        });
        spinner.stop(`Removed git worktree at ${linkedWorktree.worktree}.`);
      } catch (error) {
        spinner.stop(pc.yellow(`Could not remove worktree cleanly, will prune instead.`));
        p.log.warning(extractExecSyncErrorMessage(error) ?? String(error));
      }
    } else {
      spinner.start("Pruning stale worktree entry...");
      execFileSync("git", ["worktree", "prune"], {
        cwd: sourceCwd,
        stdio: ["ignore", "pipe", "pipe"],
      });
      spinner.stop("Pruned stale worktree entry.");
    }
  } else {
    // Even without a linked worktree, prune to clean up any orphaned entries
    execFileSync("git", ["worktree", "prune"], {
      cwd: sourceCwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
  }

  // 3b. Remove the worktree directory if it still exists (e.g. partial creation)
  if (existsSync(targetPath)) {
    const spinner = p.spinner();
    spinner.start(`Removing worktree directory ${targetPath}...`);
    rmSync(targetPath, { recursive: true, force: true });
    spinner.stop(`Removed worktree directory ${targetPath}.`);
  }

  // 3c. Delete the local branch (now safe — worktree is gone)
  if (localBranchExists(sourceCwd, name)) {
    const spinner = p.spinner();
    spinner.start(`Deleting local branch "${name}"...`);
    try {
      const deleteFlag = opts.force ? "-D" : "-d";
      execFileSync("git", ["branch", deleteFlag, name], {
        cwd: sourceCwd,
        stdio: ["ignore", "pipe", "pipe"],
      });
      spinner.stop(`Deleted local branch "${name}".`);
    } catch (error) {
      spinner.stop(pc.yellow(`Could not delete branch "${name}".`));
      p.log.warning(extractExecSyncErrorMessage(error) ?? String(error));
    }
  }

  // 3d. Remove instance data
  if (existsSync(instanceRoot)) {
    const spinner = p.spinner();
    spinner.start(`Removing instance data at ${instanceRoot}...`);
    rmSync(instanceRoot, { recursive: true, force: true });
    spinner.stop(`Removed instance data at ${instanceRoot}.`);
  }

  p.outro(pc.green("Cleanup complete."));
}

export async function worktreeEnvCommand(opts: WorktreeEnvOptions): Promise<void> {
  const configPath = resolveConfigPath(opts.config);
  const envPath = resolvePaperclipEnvFile(configPath);
  const envEntries = readPaperclipEnvEntries(envPath);
  const out = {
    PAPERCLIP_CONFIG: configPath,
    ...(envEntries.PAPERCLIP_HOME ? { PAPERCLIP_HOME: envEntries.PAPERCLIP_HOME } : {}),
    ...(envEntries.PAPERCLIP_INSTANCE_ID ? { PAPERCLIP_INSTANCE_ID: envEntries.PAPERCLIP_INSTANCE_ID } : {}),
    ...(envEntries.PAPERCLIP_CONTEXT ? { PAPERCLIP_CONTEXT: envEntries.PAPERCLIP_CONTEXT } : {}),
    ...envEntries,
  };

  if (opts.json) {
    console.log(JSON.stringify(out, null, 2));
    return;
  }

  console.log(formatShellExports(out));
}

export async function worktreeListCommand(opts: WorktreeListOptions): Promise<void> {
  const choices = toMergeSourceChoices(process.cwd());
  if (opts.json) {
    console.log(JSON.stringify(choices, null, 2));
    return;
  }

  for (const choice of choices) {
    const flags = [
      choice.isCurrent ? "current" : null,
      choice.hasPaperclipConfig ? "paperclip" : "no-paperclip-config",
    ].filter((value): value is string => value !== null);
    p.log.message(`${choice.branchLabel}  ${choice.worktree}  [${flags.join(", ")}]`);
  }
}

export function registerWorktreeCleanupCommands(worktree: import("commander").Command, program: import("commander").Command): void {
  worktree
    .command("env")
    .description("Print shell exports for the current worktree-local Paperclip instance")
    .option("-c, --config <path>", "Path to config file")
    .option("--json", "Print JSON instead of shell exports")
    .action(worktreeEnvCommand);

  program
    .command("worktree:list")
    .description("List git worktrees visible from this repo and whether they look like Paperclip worktrees")
    .option("--json", "Print JSON instead of text output")
    .action(worktreeListCommand);

  program
    .command("worktree:cleanup")
    .description("Safely remove a worktree, its branch, and its isolated instance data")
    .argument("<name>", "Worktree name — auto-prefixed with paperclip- if needed")
    .option("--instance <id>", "Explicit instance id (if different from the worktree name)")
    .option("--home <path>", `Home root for worktree instances (env: PAPERCLIP_WORKTREES_DIR, default: ${DEFAULT_WORKTREE_HOME})`)
    .option("--force", "Bypass safety checks (uncommitted changes, unique commits)", false)
    .action(worktreeCleanupCommand);
}
