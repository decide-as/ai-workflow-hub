import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { hostname } from "os";
import { app } from "electron";
import chokidar from "chokidar";
import type { MachineConfig } from "../../shared/types";

export function getMachineConfigPath(): string {
  return join(app.getPath("userData"), "machine-config.json");
}

export function readMachineConfigFromPath(path: string): MachineConfig {
  if (!existsSync(path)) {
    return { machine_id: hostname(), workflows: [] };
  }
  try {
    const raw = readFileSync(path, "utf-8");
    return JSON.parse(raw) as MachineConfig;
  } catch {
    return { machine_id: hostname(), workflows: [] };
  }
}

export function readMachineConfig(): MachineConfig {
  return readMachineConfigFromPath(getMachineConfigPath());
}

export function writeMachineConfig(config: MachineConfig): void {
  const path = getMachineConfigPath();
  const dir = join(path, "..");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(config, null, 2), "utf-8");
}

export function watchMachineConfig(
  onChange: (config: MachineConfig) => void,
): void {
  const path = getMachineConfigPath();
  chokidar
    .watch(path, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 200 },
    })
    .on("change", () => {
      onChange(readMachineConfig());
    });
}
