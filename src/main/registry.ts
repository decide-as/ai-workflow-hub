import { readFileSync, existsSync } from "fs";
import { join } from "path";
import yaml from "js-yaml";
import chokidar from "chokidar";
import type { Registry } from "../../shared/types";

const EMPTY: Registry = { workflows: [], clusters: [] };

// electron-vite bundles the main process to out/main/index.js in both dev and
// packaged (inside app.asar/out/main/). Two levels up is always the app root.
export function getBaseDir(): string {
  return join(__dirname, "..", "..");
}

export function getRegistryPath(): string {
  if (process.env.AI_HUB_REGISTRY) return process.env.AI_HUB_REGISTRY;
  return join(getBaseDir(), "registry", "workflows.yaml");
}

let cache: Registry = EMPTY;

export function getRegistry(): Registry {
  const path = getRegistryPath();
  if (!existsSync(path)) return EMPTY;
  try {
    cache = (yaml.load(readFileSync(path, "utf-8")) as Registry) ?? EMPTY;
    return cache;
  } catch {
    return cache;
  }
}

export function watchRegistry(
  path: string,
  onChange: (reg: Registry) => void,
): void {
  chokidar
    .watch(path, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 200 },
    })
    .on("change", () => {
      try {
        const reg =
          (yaml.load(readFileSync(path, "utf-8")) as Registry) ?? EMPTY;
        cache = reg;
        onChange(reg);
      } catch {
        // silently ignore parse errors during live reload
      }
    });
}
