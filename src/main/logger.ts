import { appendFileSync, mkdirSync } from "fs";
import { join } from "path";
import type { ActivityEntry } from "../../shared/types";

export type { ActivityEntry };

const DATA_REPO = "/Users/christianbraathen/Repositories/workflow-hub-data";
const LOG_DIR = join(DATA_REPO, "activity-log");

// Appends a JSONL entry to activity-log/YYYY-MM.jsonl.
// Silently no-ops if the data repo doesn't exist — never crash the main flow.
export function writeActivityLog(entry: ActivityEntry): void {
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    const month = entry.timestamp.slice(0, 7); // "YYYY-MM"
    const logFile = join(LOG_DIR, `${month}.jsonl`);
    appendFileSync(logFile, JSON.stringify(entry) + "\n", "utf-8");
  } catch {
    // Data repo may not be reachable — don't surface to the user.
  }
}
