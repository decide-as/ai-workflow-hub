import { execSync, spawnSync } from "child_process";
import { existsSync, writeFileSync, unlinkSync, chmodSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { OpenResult, OpenErrorKind } from "../../shared/types";

// Escape a string for embedding inside a double-quoted osascript string literal.
function escapeForOsascript(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function isIterm2Running(): boolean {
  try {
    const out = execSync("pgrep -x iTerm2", {
      stdio: ["ignore", "pipe", "ignore"],
    }).toString();
    return out.trim().length > 0;
  } catch {
    return false;
  }
}

export function findClaudeBin(): string | null {
  try {
    const out = execSync("which claude", {
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf-8",
    });
    const p = out.trim();
    return p.length > 0 ? p : null;
  } catch {
    return null;
  }
}

function classifyError(stderr: string): {
  error: string;
  errorKind: OpenErrorKind;
} {
  const s = stderr.toLowerCase();
  if (
    s.includes("not authorized") ||
    s.includes("authorization") ||
    s.includes("is not allowed")
  ) {
    return {
      error:
        "Automation permission required — open System Settings › Privacy & Security › Automation and allow Terminal.",
      errorKind: "permission",
    };
  }
  return { error: stderr || "osascript failed", errorKind: "unknown" };
}

// When an initialPrompt is given we write it to a sidecar .txt file and
// generate a small bash launcher script that reads it with $(<file).
// This avoids double-escaping the prompt through both bash and osascript
// string layers. The launcher file is intentionally NOT cleaned up here —
// it runs asynchronously after osascript returns.
function makeLauncherCommand(repoPath: string, initialPrompt?: string): string {
  if (!initialPrompt) {
    // The command is embedded inside a double-quoted osascript string literal,
    // so the path's inner quotes must be backslash-escaped (\").
    return `cd \\"${escapeForOsascript(repoPath)}\\" && claude`;
  }

  const id = Date.now();
  const promptFile = join(tmpdir(), `ai-hub-prompt-${id}.txt`);
  const shScript = join(tmpdir(), `ai-hub-launch-${id}.sh`);

  writeFileSync(promptFile, initialPrompt, "utf-8");
  writeFileSync(
    shScript,
    [
      "#!/bin/bash",
      `cd '${repoPath.replace(/'/g, "'\\''")}'`,
      `PROMPT=$(cat '${promptFile.replace(/'/g, "'\\''")}')`,
      "",
      `exec claude "$PROMPT"`,
    ].join("\n"),
    "utf-8",
  );
  chmodSync(shScript, 0o755);

  // The osascript just needs to run this file path.
  return escapeForOsascript(shScript);
}

export function openInTerminal(
  repoPath: string,
  initialPrompt?: string,
): OpenResult {
  if (!existsSync(repoPath)) {
    return {
      success: false,
      error: `Repo path not found: ${repoPath}`,
      errorKind: "path-missing",
    };
  }

  if (!findClaudeBin()) {
    return {
      success: false,
      error: "claude not found in PATH — install from claude.ai/download",
      errorKind: "claude-missing",
    };
  }

  const useITerm = isIterm2Running();
  const cmd = makeLauncherCommand(repoPath, initialPrompt);

  // For the simple (no prompt) case, cmd is a shell inline like
  // `cd "/repo" && claude`. For the prompt case, cmd is a path to a .sh file.
  // Both work identically inside `write text` / `do script`.
  const script = useITerm
    ? `tell application "iTerm2"
  create window with default profile
  tell current session of current window
    write text "${cmd}"
  end tell
end tell`
    : `tell application "Terminal"
  do script "${cmd}"
  activate
end tell`;

  const tmpScript = join(tmpdir(), `ai-hub-${Date.now()}.scpt`);
  try {
    writeFileSync(tmpScript, script, "utf-8");
    const result = spawnSync("osascript", [tmpScript], { encoding: "utf-8" });
    if (result.status !== 0) {
      const { error, errorKind } = classifyError(result.stderr?.trim() ?? "");
      return { success: false, error, errorKind };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err), errorKind: "unknown" };
  } finally {
    try {
      unlinkSync(tmpScript);
    } catch {
      /* ignore */
    }
  }
}
