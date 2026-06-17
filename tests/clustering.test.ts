import { describe, it, expect } from "vitest";
import { cluster } from "../clustering/engine";
import type { Workflow } from "../shared/types";

function makeWorkflow(id: string, tags: string[]): Workflow {
  return {
    id,
    name: id,
    description: "",
    tags,
    repo_path: `/tmp/${id}`,
    color: "#fff",
    icon: "Bot",
    cluster_id: null,
    added: "2026-01-01",
    updated: "2026-01-01",
  };
}

describe("cluster()", () => {
  it("returns empty for no workflows", () => {
    const result = cluster([]);
    expect(result.workflows).toHaveLength(0);
    expect(result.clusters).toHaveLength(0);
  });

  it("groups workflows that share a tag", () => {
    const workflows = [
      makeWorkflow("a", ["finance", "invoice"]),
      makeWorkflow("b", ["finance", "budget"]),
      makeWorkflow("c", ["legal"]),
    ];
    const result = cluster(workflows);
    expect(result.clusters).toHaveLength(1);
    expect(result.clusters[0].workflow_ids).toContain("a");
    expect(result.clusters[0].workflow_ids).toContain("b");
  });

  it("leaves solo-tag workflows unclustered (cluster_id null)", () => {
    const workflows = [
      makeWorkflow("a", ["finance"]),
      makeWorkflow("b", ["legal"]),
    ];
    const result = cluster(workflows);
    expect(result.clusters).toHaveLength(0);
    result.workflows.forEach((w) => expect(w.cluster_id).toBeNull());
  });

  it("names cluster after most frequent shared tag", () => {
    const workflows = [
      makeWorkflow("a", ["finance", "reporting"]),
      makeWorkflow("b", ["finance", "reporting"]),
      makeWorkflow("c", ["finance"]),
    ];
    const result = cluster(workflows);
    expect(result.clusters).toHaveLength(1);
    // 'finance' appears in all 3, 'reporting' in 2 — finance wins
    expect(result.clusters[0].name.toLowerCase()).toContain("finance");
  });

  it("chains workflows via shared tags (union-find transitivity)", () => {
    // a-b share 'x', b-c share 'y' — all three should cluster
    const workflows = [
      makeWorkflow("a", ["x"]),
      makeWorkflow("b", ["x", "y"]),
      makeWorkflow("c", ["y"]),
    ];
    const result = cluster(workflows);
    expect(result.clusters).toHaveLength(1);
    expect(result.clusters[0].workflow_ids).toHaveLength(3);
  });

  it("sets cluster_id on clustered workflows", () => {
    const workflows = [makeWorkflow("a", ["ops"]), makeWorkflow("b", ["ops"])];
    const result = cluster(workflows);
    const clusterId = result.clusters[0].id;
    const wA = result.workflows.find((w) => w.id === "a");
    const wB = result.workflows.find((w) => w.id === "b");
    expect(wA?.cluster_id).toBe(clusterId);
    expect(wB?.cluster_id).toBe(clusterId);
  });
});
