import {
  readdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  renameSync,
  appendFileSync,
} from "fs";
import { join, extname, basename } from "path";
import { analyzeImage } from "./vision";
import { clusterImages } from "./image-clustering";
import type {
  VisionResult,
  OrganizerPlan,
  OrganizerMove,
  OrganizerRestructureItem,
  OrganizerProgress,
  OrganizerResult,
} from "../../shared/types";

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
const STATE_FILE = ".organizer-state.json";
const LOG_FILE = ".organizer-log.txt";

interface StoredState {
  version: number;
  clusters: Array<{ label: string; imagePaths: string[] }>;
  analyzedImages: Record<string, VisionResult>;
}

function loadState(folder: string): StoredState | null {
  const p = join(folder, STATE_FILE);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as StoredState;
  } catch {
    return null;
  }
}

function saveState(folder: string, state: StoredState): void {
  writeFileSync(
    join(folder, STATE_FILE),
    JSON.stringify(state, null, 2),
    "utf8",
  );
}

function appendLog(folder: string, line: string): void {
  appendFileSync(join(folder, LOG_FILE), line + "\n", "utf8");
}

function scanImages(folder: string): string[] {
  return readdirSync(folder)
    .filter((f) => IMAGE_EXTS.has(extname(f).toLowerCase()))
    .map((f) => join(folder, f));
}

function safeDestPath(destDir: string, filename: string): string {
  const base = basename(filename, extname(filename));
  const ext = extname(filename);
  let dest = join(destDir, filename);
  let n = 1;
  while (existsSync(dest)) {
    dest = join(destDir, `${base}-${n}${ext}`);
    n++;
  }
  return dest;
}

export async function scanAndPlan(
  sourceFolder: string,
  onProgress: (p: OrganizerProgress) => void,
): Promise<OrganizerPlan> {
  const allImages = scanImages(sourceFolder);
  const state = loadState(sourceFolder);
  const cachedResults: Record<string, VisionResult> =
    state?.analyzedImages ?? {};

  const newImages = allImages.filter((p) => !cachedResults[p]);
  const total = newImages.length;

  // Analyze new images one by one, reporting progress
  for (let i = 0; i < newImages.length; i++) {
    onProgress({
      current: i + 1,
      total,
      currentFile: basename(newImages[i]),
      phase: "analyzing",
    });
    const result = await analyzeImage(newImages[i]);
    cachedResults[newImages[i]] = result;
  }

  onProgress({ current: 0, total: 0, currentFile: "", phase: "clustering" });

  // Cluster all images
  const allResults = allImages.map((p) => cachedResults[p]).filter(Boolean);
  const { clusters, misc } = await clusterImages(allResults);

  // Build moves list — cluster images go to labelled subfolders, misc to misc/
  const moves: OrganizerMove[] = [];
  const allRootImages = new Set(allImages);

  for (const cluster of clusters) {
    const destDir = join(sourceFolder, sanitizeLabel(cluster.label));
    for (const imagePath of cluster.imagePaths) {
      if (!allRootImages.has(imagePath)) continue;
      const destPath = safeDestPath(destDir, basename(imagePath));
      moves.push({
        sourcePath: imagePath,
        destPath,
        clusterLabel: cluster.label,
      });
    }
  }

  const miscDir = join(sourceFolder, "misc");
  for (const imagePath of misc) {
    if (!allRootImages.has(imagePath)) continue;
    const destPath = safeDestPath(miscDir, basename(imagePath));
    moves.push({ sourcePath: imagePath, destPath, clusterLabel: "misc" });
  }

  // Detect restructuring — files that would move to a different cluster than before
  const restructured: OrganizerRestructureItem[] = [];
  if (state?.clusters) {
    const oldPathToCluster: Record<string, string> = {};
    for (const c of state.clusters) {
      for (const p of c.imagePaths) oldPathToCluster[p] = c.label;
    }
    for (const move of moves) {
      const old = oldPathToCluster[move.sourcePath];
      if (old && old !== move.clusterLabel) {
        restructured.push({
          sourcePath: move.sourcePath,
          oldCluster: old,
          newCluster: move.clusterLabel,
        });
      }
    }
  }

  // Persist updated analysis cache
  const updatedState: StoredState = {
    version: 1,
    clusters: clusters.map((c) => ({
      label: c.label,
      imagePaths: c.imagePaths,
    })),
    analyzedImages: cachedResults,
  };
  saveState(sourceFolder, updatedState);

  return {
    sourceFolder,
    moves,
    clusters: clusters.map((c) => ({
      label: c.label,
      count: c.imagePaths.length,
    })),
    miscCount: misc.length,
    restructured,
    newImageCount: newImages.length,
    totalImageCount: allImages.length,
  };
}

export function applyPlan(
  plan: OrganizerPlan,
  dryRun: boolean,
): OrganizerResult {
  const ts = new Date().toISOString();
  const logPath = join(plan.sourceFolder, LOG_FILE);
  const tag = dryRun ? "DRY-RUN" : "MOVE";
  const errors: string[] = [];
  let moved = 0;

  appendLog(plan.sourceFolder, `\n--- ${ts} [${tag}] ---`);

  for (const move of plan.moves) {
    const line = `${tag}: ${move.sourcePath} → ${move.destPath}`;
    appendLog(plan.sourceFolder, line);

    if (!dryRun) {
      try {
        const dir = join(plan.sourceFolder, sanitizeLabel(move.clusterLabel));
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        renameSync(move.sourcePath, move.destPath);
        moved++;
      } catch (e) {
        const err = `ERROR: ${move.sourcePath} — ${e}`;
        appendLog(plan.sourceFolder, err);
        errors.push(err);
      }
    } else {
      moved++;
    }
  }

  appendLog(
    plan.sourceFolder,
    `--- ${moved} files ${dryRun ? "would be moved" : "moved"}, ${errors.length} errors ---`,
  );

  return { dryRun, moved, logPath, errors };
}

function sanitizeLabel(label: string): string {
  return label
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 40);
}
