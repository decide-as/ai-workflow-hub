import { spawnSync } from "child_process";
import { existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type {
  Workflow,
  BranchListResult,
  OpenResult,
} from "../../shared/types";
import { openInTerminal } from "./terminal";

function cacheDir(workflowId: string): string {
  return join(homedir(), ".workflow-hub", "cache", workflowId);
}

// Returns branches sorted: default/master/main first, then alphabetical.
function sortBranches(branches: string[], defaultBranch?: string): string[] {
  const priority = [defaultBranch, "master", "main"].filter(Boolean) as string[];
  const rest = branches.filter((b) => !priority.includes(b)).sort();
  const top = priority.filter((b) => branches.includes(b));
  return [...new Set([...top, ...rest])];
}

export function listBranches(
  repo: string,
  defaultBranch?: string,
): BranchListResult {
  try {
    // ls-remote works for both local paths and remote URLs without cloning.
    const result = spawnSync(
      "git",
      ["ls-remote", "--heads", repo],
      { encoding: "utf-8", timeout: 15_000 },
    );
    if (result.error || result.status !== 0) {
      return {
        success: false,
        branches: [],
        error: result.stderr?.trim() || "git ls-remote failed",
      };
    }
    const branches = result.stdout
      .split("\n")
      .filter((l) => l.includes("\t"))
      .map((l) => l.split("\t")[1].replace("refs/heads/", "").trim())
      .filter(Boolean);
    return { success: true, branches: sortBranches(branches, defaultBranch) };
  } catch (err) {
    return { success: false, branches: [], error: String(err) };
  }
}

function cloneOrFetch(repo: string, dest: string): { ok: boolean; error?: string } {
  if (existsSync(join(dest, ".git"))) {
    // Already cloned — fetch latest.
    const r = spawnSync("git", ["-C", dest, "fetch", "--prune"], {
      encoding: "utf-8",
      timeout: 30_000,
    });
    if (r.error || r.status !== 0) {
      return { ok: false, error: r.stderr?.trim() || "git fetch failed" };
    }
  } else {
    mkdirSync(dest, { recursive: true });
    const r = spawnSync("git", ["clone", repo, dest], {
      encoding: "utf-8",
      timeout: 60_000,
    });
    if (r.error || r.status !== 0) {
      return { ok: false, error: r.stderr?.trim() || "git clone failed" };
    }
  }
  return { ok: true };
}

function checkoutBranch(dest: string, branch: string): { ok: boolean; error?: string } {
  // Use `git checkout -B branch origin/branch` to handle both new and existing
  // local tracking branches.
  const r = spawnSync(
    "git",
    ["-C", dest, "checkout", "-B", branch, `origin/${branch}`],
    { encoding: "utf-8", timeout: 15_000 },
  );
  if (r.error || r.status !== 0) {
    return { ok: false, error: r.stderr?.trim() || "git checkout failed" };
  }
  return { ok: true };
}

export function scaffoldWorkflow(
  workflow: Workflow,
  branch: string,
  description: string,
): OpenResult {
  const cfg = workflow.scaffold;
  if (!cfg) {
    return { success: false, error: "Workflow has no scaffold config", errorKind: "unknown" };
  }

  const dest = cacheDir(workflow.id);

  const cloneResult = cloneOrFetch(cfg.repo, dest);
  if (!cloneResult.ok) {
    return { success: false, error: cloneResult.error, errorKind: "unknown" };
  }

  const checkoutResult = checkoutBranch(dest, branch);
  if (!checkoutResult.ok) {
    return { success: false, error: checkoutResult.error, errorKind: "unknown" };
  }

  const prompt = cfg.initial_prompt_template.replace("{description}", description);
  return openInTerminal(dest, prompt);
}
