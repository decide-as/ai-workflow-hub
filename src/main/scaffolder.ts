import { spawnSync } from "child_process";
import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type {
  Workflow,
  BranchListResult,
  OpenResult,
} from "../../shared/types";
import { openInTerminal } from "./terminal";

// Resolve git to a full path — Electron main process may not include
// /opt/homebrew/bin in its PATH even when the shell that launched it does.
function findGitBin(): string {
  const candidates = [
    "/opt/homebrew/bin/git",
    "/usr/local/bin/git",
    "/usr/bin/git",
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return "git";
}

const GIT = findGitBin();

function cacheDir(workflowId: string): string {
  return join(homedir(), ".workflow-hub", "cache", workflowId);
}

// Returns branches sorted: default/master/main first, then alphabetical.
function sortBranches(branches: string[], defaultBranch?: string): string[] {
  const priority = [defaultBranch, "master", "main"].filter(
    Boolean,
  ) as string[];
  const rest = branches.filter((b) => !priority.includes(b)).sort();
  const top = priority.filter((b) => branches.includes(b));
  return [...new Set([...top, ...rest])];
}

export function listBranches(
  repo: string,
  defaultBranch?: string,
): BranchListResult {
  try {
    let branches: string[];

    if (repo.startsWith("/") && existsSync(repo)) {
      // Local path — read remote tracking branches directly, no network needed.
      const result = spawnSync(GIT, ["-C", repo, "branch", "-r"], {
        encoding: "utf-8",
        timeout: 10_000,
      });
      if (result.error || result.status !== 0) {
        return {
          success: false,
          branches: [],
          error:
            result.error?.message ||
            result.stderr?.trim() ||
            "git branch -r failed",
        };
      }
      branches = result.stdout
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.startsWith("origin/") && !l.includes("->"))
        .map((l) => l.replace(/^origin\//, "").trim())
        .filter(Boolean);

      // Fallback to local branches when there are no remote tracking branches
      // (e.g. a standalone local repo with no remote configured).
      if (branches.length === 0) {
        const local = spawnSync(GIT, ["-C", repo, "branch"], {
          encoding: "utf-8",
          timeout: 10_000,
        });
        if (!local.error && local.status === 0) {
          branches = local.stdout
            .split("\n")
            .map((l) => l.replace(/^\*?\s+/, "").trim())
            .filter(Boolean);
        }
      }
    } else {
      // Remote URL — use ls-remote.
      const result = spawnSync(GIT, ["ls-remote", "--heads", repo], {
        encoding: "utf-8",
        timeout: 15_000,
      });
      if (result.error || result.status !== 0) {
        return {
          success: false,
          branches: [],
          error:
            result.error?.message ||
            result.stderr?.trim() ||
            "git ls-remote failed",
        };
      }
      branches = result.stdout
        .split("\n")
        .filter((l) => l.includes("\t"))
        .map((l) => l.split("\t")[1].replace("refs/heads/", "").trim())
        .filter(Boolean);
    }

    return { success: true, branches: sortBranches(branches, defaultBranch) };
  } catch (err) {
    return { success: false, branches: [], error: String(err) };
  }
}

function cloneOrFetch(
  repo: string,
  dest: string,
): { ok: boolean; error?: string } {
  if (existsSync(join(dest, ".git"))) {
    // Already cloned — fetch latest.
    const r = spawnSync(GIT, ["-C", dest, "fetch", "--prune"], {
      encoding: "utf-8",
      timeout: 30_000,
    });
    if (r.error || r.status !== 0) {
      return {
        ok: false,
        error: r.error?.message || r.stderr?.trim() || "git fetch failed",
      };
    }
  } else {
    mkdirSync(dest, { recursive: true });
    const r = spawnSync(GIT, ["clone", repo, dest], {
      encoding: "utf-8",
      timeout: 60_000,
    });
    if (r.error || r.status !== 0) {
      return {
        ok: false,
        error: r.error?.message || r.stderr?.trim() || "git clone failed",
      };
    }
  }
  return { ok: true };
}

// Runs setup_command in dest if it has never been run or the command changed.
// Uses a .wh-setup marker file containing the SHA-256 of the last successful
// setup_command. Re-runs automatically when the command string changes (e.g.
// a new dependency is added). Returns an error string on failure.
function runSetupIfNeeded(
  dest: string,
  setupCommand: string,
): { ok: boolean; error?: string } {
  const marker = join(dest, ".wh-setup");
  const hash = createHash("sha256").update(setupCommand).digest("hex");

  if (existsSync(marker)) {
    try {
      const stored = readFileSync(marker, "utf-8").trim();
      if (stored === hash) return { ok: true }; // already done
    } catch {
      /* marker unreadable — re-run setup */
    }
  }

  const r = spawnSync("bash", ["-c", setupCommand], {
    cwd: dest,
    encoding: "utf-8",
    timeout: 300_000, // 5 min ceiling for slow pip installs
  });

  if (r.error || r.status !== 0) {
    const msg =
      r.error?.message ||
      r.stderr?.trim() ||
      `setup_command exited with code ${r.status}`;
    return { ok: false, error: msg };
  }

  writeFileSync(marker, hash, "utf-8");
  return { ok: true };
}

function checkoutBranch(
  dest: string,
  branch: string,
): { ok: boolean; error?: string } {
  // Use `git checkout -B branch origin/branch` to handle both new and existing
  // local tracking branches.
  const r = spawnSync(
    GIT,
    ["-C", dest, "checkout", "-B", branch, `origin/${branch}`],
    { encoding: "utf-8", timeout: 15_000 },
  );
  if (r.error || r.status !== 0) {
    return {
      ok: false,
      error: r.error?.message || r.stderr?.trim() || "git checkout failed",
    };
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
    return {
      success: false,
      error: "Workflow has no scaffold config",
      errorKind: "unknown",
    };
  }

  const dest = cacheDir(workflow.id);

  const cloneResult = cloneOrFetch(cfg.repo, dest);
  if (!cloneResult.ok) {
    return { success: false, error: cloneResult.error, errorKind: "unknown" };
  }

  const checkoutResult = checkoutBranch(dest, branch);
  if (!checkoutResult.ok) {
    return {
      success: false,
      error: checkoutResult.error,
      errorKind: "unknown",
    };
  }

  if (cfg.setup_command) {
    const setupResult = runSetupIfNeeded(dest, cfg.setup_command);
    if (!setupResult.ok) {
      return { success: false, error: setupResult.error, errorKind: "unknown" };
    }
  }

  // Auto-activate a venv if setup created one at the conventional location.
  const venvActivate = join(dest, ".venv", "bin", "activate");
  const activateScript = existsSync(venvActivate) ? venvActivate : undefined;

  const prompt = cfg.initial_prompt_template.replace(
    "{description}",
    description,
  );
  return openInTerminal(dest, prompt, activateScript);
}
