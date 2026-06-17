import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, readFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import yaml from "js-yaml";
import type { Registry } from "../shared/types";

// Pull the pure registry read logic out — test it without Electron's app module
// by setting AI_HUB_REGISTRY env var and importing the cli's readReg helper
// (which is identical logic without the Electron dependency)

function makeRegistry(partial: Partial<Registry> = {}): Registry {
  return { workflows: [], clusters: [], ...partial };
}

describe("registry YAML round-trip", () => {
  let tmpDir: string;
  let registryPath: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `ai-hub-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    registryPath = join(tmpDir, "workflows.yaml");
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("parses a valid registry YAML", () => {
    const reg: Registry = {
      workflows: [
        {
          id: "abc-123",
          name: "Test Workflow",
          description: "A test",
          tags: ["finance", "reporting"],
          repo_path: "/tmp/test",
          color: "#10b981",
          icon: "Receipt",
          cluster_id: null,
          added: "2026-01-01",
          updated: "2026-01-01",
        },
      ],
      clusters: [],
    };
    writeFileSync(registryPath, yaml.dump(reg), "utf-8");
    const loaded = yaml.load(readFileSync(registryPath, "utf-8")) as Registry;
    expect(loaded.workflows).toHaveLength(1);
    expect(loaded.workflows[0].id).toBe("abc-123");
    expect(loaded.workflows[0].tags).toEqual(["finance", "reporting"]);
  });

  it("survives an empty registry file (empty YAML → null)", () => {
    writeFileSync(registryPath, "", "utf-8");
    const loaded = yaml.load(
      readFileSync(registryPath, "utf-8"),
    ) as Registry | null;
    const reg = loaded ?? makeRegistry();
    expect(reg.workflows).toHaveLength(0);
  });

  it("preserves optional rich metadata fields through round-trip", () => {
    const reg: Registry = {
      workflows: [
        {
          id: "xyz-999",
          name: "Rich Workflow",
          description: "Has extras",
          tags: ["legal"],
          repo_path: "/tmp/rich",
          color: "#8b5cf6",
          icon: "Scale",
          cluster_id: "cluster-1",
          added: "2026-01-01",
          updated: "2026-01-02",
          status: "active",
          run_count: 42,
          success_rate: 97.5,
          model: "claude-sonnet-4-6",
        },
      ],
      clusters: [
        {
          id: "cluster-1",
          name: "Legal",
          tags: ["legal"],
          workflow_ids: ["xyz-999"],
        },
      ],
    };
    writeFileSync(registryPath, yaml.dump(reg), "utf-8");
    const loaded = yaml.load(readFileSync(registryPath, "utf-8")) as Registry;
    const w = loaded.workflows[0];
    expect(w.run_count).toBe(42);
    expect(w.success_rate).toBe(97.5);
    expect(w.model).toBe("claude-sonnet-4-6");
    expect(loaded.clusters[0].name).toBe("Legal");
  });
});
