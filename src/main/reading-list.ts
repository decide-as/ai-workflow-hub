import { spawnSync } from "child_process";
import { join, isAbsolute } from "path";
import type {
  ReadingListEntry,
  ReadingListImportResult,
  ReadingListAddResult,
} from "../../shared/types";

function scriptsDir(baseDir: string): string {
  const repoPath = "workflows/reading-list";
  const resolved = isAbsolute(repoPath) ? repoPath : join(baseDir, repoPath);
  return join(resolved, "scripts");
}

function runPython(script: string, args: string[] = []): string {
  const result = spawnSync("python3", [script, ...args], {
    encoding: "utf8",
    timeout: 120_000,
  });
  if (result.error) throw result.error;
  return (result.stdout ?? "").trim();
}

export function importFromReminders(baseDir: string): ReadingListImportResult {
  try {
    const script = join(scriptsDir(baseDir), "import_reminders.py");
    const output = runPython(script);
    return JSON.parse(output) as ReadingListImportResult;
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export function addUrl(baseDir: string, url: string): ReadingListAddResult {
  try {
    const script = join(scriptsDir(baseDir), "add_url.py");
    const output = runPython(script, [url]);
    return JSON.parse(output) as ReadingListAddResult;
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export function getEntries(
  baseDir: string,
  limit = 100,
): ReadingListEntry[] | { error: string } {
  try {
    const script = join(scriptsDir(baseDir), "get_entries.py");
    const output = runPython(script, [String(limit)]);
    return JSON.parse(output) as ReadingListEntry[];
  } catch (err) {
    return { error: String(err) };
  }
}
