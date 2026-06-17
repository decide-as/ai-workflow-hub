# Running Claude Headlessly from the Main Process

## Preferred pattern

When a workflow needs Claude to process files, images, or text and return structured output, **do not call the Anthropic API directly**. Instead, invoke the local `claude` CLI binary as a subprocess:

```typescript
import { spawnSync } from "child_process";

const result = spawnSync(
  claudeBin,          // resolved by findClaudeBin() — see bookkeeping.ts
  [
    "-p", prompt,     // non-interactive print mode
    "--allowedTools", "Read",
    "--add-dir", tmpDir,
  ],
  { encoding: "utf8", timeout: 120_000 },
);

const output = result.stdout;
```

This approach:
- Uses the user's existing `claude` auth and model settings — no `ANTHROPIC_API_KEY` needed in the app
- Inherits whatever model the user has configured
- No terminal window appears — stdout/stderr are captured by the parent process
- Works identically across machines

## Why not the API directly?

Calling `api.anthropic.com` from the Electron main process requires managing an API key inside the app and couples the app to a specific model. The `claude` binary already handles auth (OAuth, API key, Bedrock, etc.) and model selection — there is no reason to duplicate that.

The one exception is features that depend on Anthropic-specific APIs unavailable in the CLI (e.g. the Files API, Batch API). For everything else, use the subprocess pattern.

## Finding the binary

The `claude` command in a user's shell is often a **shell function** (set up in `.zshrc` / `.bashrc`) that wraps the real binary. Shell functions are not available to `spawnSync`. Always resolve the underlying binary path:

```typescript
import { execFileSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

function findClaudeBin(): string | null {
  // 1. PATH lookup (most portable)
  try {
    const found = execFileSync("which", ["claude"], { encoding: "utf8" }).trim();
    if (found && existsSync(found)) return found;
  } catch { /* fall through */ }

  // 2. Known install locations
  const candidates = [
    join(homedir(), ".local", "bin", "claude"),
    "/usr/local/bin/claude",
    "/opt/homebrew/bin/claude",
  ];
  return candidates.find(existsSync) ?? null;
}
```

## Passing images

Claude's Read tool can read local image files by path. Write dropped/pasted images to a `mkdtemp` directory, reference the paths in the prompt, and pass `--add-dir <tmpDir>` to grant access:

```typescript
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";

const tmp = mkdtempSync(join(tmpdir(), "workflow-"));
writeFileSync(join(tmp, "statement.png"), imageBuffer);

const prompt = `Read the image at ${tmp}/statement.png and ...`;

const result = spawnSync(claudeBin, [
  "-p", prompt,
  "--allowedTools", "Read",
  "--add-dir", tmp,
], { encoding: "utf8", timeout: 120_000 });

rmSync(tmp, { recursive: true, force: true }); // always clean up
```

## Parsing structured output

Ask Claude to return only the structured data you need — no explanation, no markdown fences. Then parse it directly from stdout. For arrays or objects, a simple regex or `JSON.parse` is enough. See `src/main/bookkeeping.ts` for a worked example using a `declare -a` bash array as the structured format.

## Timeout

Always set a `timeout` (milliseconds) on the `spawnSync` call. Claude API calls can take 30–60 s for image-heavy prompts; 120 000 ms (2 min) is a safe upper bound for single-image workflows.
