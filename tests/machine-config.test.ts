import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import type { Registry, MachineConfig } from "../shared/types";
import { readMachineConfigFromPath } from "../src/main/machine-config";
import { mergeRegistryWithMachineConfig } from "../src/main/registry";

// --- helpers -----------------------------------------------------------------

function makeWorkflow(id: string): Registry["workflows"][0] {
  return {
    id,
    name: `Workflow ${id}`,
    description: "test",
    tags: [],
    repo_path: "/tmp/test",
    color: "#000",
    icon: "File",
    cluster_id: null,
    added: "2026-01-01",
    updated: "2026-01-01",
  };
}

function makeRegistry(...ids: string[]): Registry {
  return { workflows: ids.map(makeWorkflow), clusters: [] };
}

function makeConfig(
  entries: { id: string; enabled: boolean }[],
): MachineConfig {
  return { machine_id: "test-host", workflows: entries };
}

// --- readMachineConfigFromPath -----------------------------------------------

describe("readMachineConfigFromPath", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `wh-cfg-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns empty default config when file does not exist", () => {
    const result = readMachineConfigFromPath(join(tmpDir, "missing.json"));
    expect(result.workflows).toEqual([]);
    expect(typeof result.machine_id).toBe("string");
    expect(result.machine_id.length).toBeGreaterThan(0);
  });

  it("parses a valid config file", () => {
    const config: MachineConfig = {
      machine_id: "my-mac",
      nickname: "Home Mac",
      workflows: [{ id: "abc-123", enabled: false }],
    };
    const p = join(tmpDir, "machine-config.json");
    writeFileSync(p, JSON.stringify(config), "utf-8");
    const result = readMachineConfigFromPath(p);
    expect(result.machine_id).toBe("my-mac");
    expect(result.nickname).toBe("Home Mac");
    expect(result.workflows).toHaveLength(1);
    expect(result.workflows[0]).toEqual({ id: "abc-123", enabled: false });
  });

  it("falls back to empty default on malformed JSON", () => {
    const p = join(tmpDir, "bad.json");
    writeFileSync(p, "{ not valid json }", "utf-8");
    const result = readMachineConfigFromPath(p);
    expect(result.workflows).toEqual([]);
    expect(typeof result.machine_id).toBe("string");
  });

  it("falls back to empty default on empty file", () => {
    const p = join(tmpDir, "empty.json");
    writeFileSync(p, "", "utf-8");
    const result = readMachineConfigFromPath(p);
    expect(result.workflows).toEqual([]);
  });

  it("preserves all enabled entries from a valid config", () => {
    const config: MachineConfig = {
      machine_id: "office-mini",
      workflows: [
        { id: "w1", enabled: true },
        { id: "w2", enabled: false },
        { id: "w3", enabled: true },
      ],
    };
    const p = join(tmpDir, "machine-config.json");
    writeFileSync(p, JSON.stringify(config), "utf-8");
    const result = readMachineConfigFromPath(p);
    expect(result.workflows).toHaveLength(3);
    expect(result.workflows[1].enabled).toBe(false);
  });
});

// --- mergeRegistryWithMachineConfig ------------------------------------------

describe("mergeRegistryWithMachineConfig", () => {
  it("returns registry unchanged when config has no entries", () => {
    const reg = makeRegistry("w1", "w2", "w3");
    const config = makeConfig([]);
    const result = mergeRegistryWithMachineConfig(reg, config);
    expect(result).toBe(reg); // same reference — short-circuit path
  });

  it("returns registry unchanged when all entries are enabled", () => {
    const reg = makeRegistry("w1", "w2");
    const config = makeConfig([
      { id: "w1", enabled: true },
      { id: "w2", enabled: true },
    ]);
    const result = mergeRegistryWithMachineConfig(reg, config);
    expect(result).toBe(reg);
  });

  it("removes a single disabled workflow", () => {
    const reg = makeRegistry("w1", "w2", "w3");
    const config = makeConfig([{ id: "w2", enabled: false }]);
    const result = mergeRegistryWithMachineConfig(reg, config);
    expect(result.workflows.map((w) => w.id)).toEqual(["w1", "w3"]);
  });

  it("removes multiple disabled workflows", () => {
    const reg = makeRegistry("w1", "w2", "w3", "w4");
    const config = makeConfig([
      { id: "w1", enabled: false },
      { id: "w3", enabled: false },
    ]);
    const result = mergeRegistryWithMachineConfig(reg, config);
    expect(result.workflows.map((w) => w.id)).toEqual(["w2", "w4"]);
  });

  it("removes all workflows when all are disabled", () => {
    const reg = makeRegistry("w1", "w2");
    const config = makeConfig([
      { id: "w1", enabled: false },
      { id: "w2", enabled: false },
    ]);
    const result = mergeRegistryWithMachineConfig(reg, config);
    expect(result.workflows).toHaveLength(0);
  });

  it("ignores config entries for workflows not in the registry", () => {
    const reg = makeRegistry("w1", "w2");
    const config = makeConfig([{ id: "ghost", enabled: false }]);
    const result = mergeRegistryWithMachineConfig(reg, config);
    // ghost not in registry, disabled set is non-empty but no match
    expect(result.workflows.map((w) => w.id)).toEqual(["w1", "w2"]);
  });

  it("preserves cluster list unchanged", () => {
    const reg: Registry = {
      ...makeRegistry("w1"),
      clusters: [{ id: "c1", name: "Finance", tags: [], workflow_ids: ["w1"] }],
    };
    const config = makeConfig([{ id: "w1", enabled: false }]);
    const result = mergeRegistryWithMachineConfig(reg, config);
    expect(result.clusters).toEqual(reg.clusters);
    expect(result.workflows).toHaveLength(0);
  });

  it("does not mutate the original registry", () => {
    const reg = makeRegistry("w1", "w2");
    const original = reg.workflows.map((w) => w.id);
    const config = makeConfig([{ id: "w1", enabled: false }]);
    mergeRegistryWithMachineConfig(reg, config);
    expect(reg.workflows.map((w) => w.id)).toEqual(original);
  });

  it("enabled entries in config do not affect opt-out filtering", () => {
    const reg = makeRegistry("w1", "w2", "w3");
    const config = makeConfig([
      { id: "w1", enabled: true },
      { id: "w2", enabled: false },
      { id: "w3", enabled: true },
    ]);
    const result = mergeRegistryWithMachineConfig(reg, config);
    expect(result.workflows.map((w) => w.id)).toEqual(["w1", "w3"]);
  });
});
