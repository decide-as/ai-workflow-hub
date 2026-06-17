#!/usr/bin/env tsx
import { Command } from "commander";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  renameSync,
} from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import yaml from "js-yaml";
import { v4 as uuidv4 } from "uuid";
import { cluster } from "../clustering/engine";
import type { Registry, Workflow } from "../shared/types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REGISTRY_PATH =
  process.env.AI_HUB_REGISTRY ?? join(__dirname, "../registry/workflows.yaml");

const EMPTY: Registry = { workflows: [], clusters: [] };

function readReg(): Registry {
  if (!existsSync(REGISTRY_PATH)) return EMPTY;
  return (yaml.load(readFileSync(REGISTRY_PATH, "utf-8")) as Registry) ?? EMPTY;
}

function writeReg(reg: Registry): void {
  mkdirSync(dirname(REGISTRY_PATH), { recursive: true });
  const tmp = REGISTRY_PATH + ".tmp";
  writeFileSync(tmp, yaml.dump(reg, { lineWidth: 120 }), "utf-8");
  renameSync(tmp, REGISTRY_PATH);
}

function clusterAndSave(reg: Registry): Registry {
  const { workflows, clusters } = cluster(reg.workflows);
  const next: Registry = { workflows, clusters };
  writeReg(next);
  return next;
}

const program = new Command()
  .name("ai-hub")
  .description("Register and manage AI workflows in the hub")
  .version("0.1.0");

program
  .command("register")
  .description("Register a new workflow")
  .requiredOption("-n, --name <name>", "Display name")
  .requiredOption("-p, --path <path>", "Absolute path to the repo")
  .requiredOption("-t, --tags <tags>", "Comma-separated tags")
  .requiredOption("-d, --description <desc>", "Short description")
  .option("--color <hex>", "Accent color (hex)", "#6366f1")
  .option(
    "--icon <name>",
    "Lucide icon name (e.g. Plane, Mail, Receipt)",
    "Bot",
  )
  .action((opts) => {
    const repoPath = resolve(opts.path);
    if (!existsSync(repoPath)) {
      console.error(`✗ Path does not exist: ${repoPath}`);
      process.exit(1);
    }

    const reg = readReg();
    const now = new Date().toISOString().slice(0, 10);
    const workflow: Workflow = {
      id: uuidv4(),
      name: opts.name,
      description: opts.description,
      tags: opts.tags
        .split(",")
        .map((t: string) => t.trim())
        .filter(Boolean),
      repo_path: repoPath,
      color: opts.color,
      icon: opts.icon,
      cluster_id: null,
      added: now,
      updated: now,
    };

    reg.workflows.push(workflow);
    const saved = clusterAndSave(reg);
    const clusterName = saved.clusters.find((c) =>
      c.workflow_ids.includes(workflow.id),
    )?.name;

    console.log(`✓ Registered: ${workflow.name} (${workflow.id.slice(0, 8)})`);
    if (clusterName) console.log(`  → Clustered into: ${clusterName}`);
  });

program
  .command("update <id>")
  .description("Update an existing workflow (partial)")
  .option("-n, --name <name>")
  .option("-d, --description <desc>")
  .option("-t, --tags <tags>")
  .option("--color <hex>")
  .option("--icon <name>")
  .action((id, opts) => {
    const reg = readReg();
    const idx = reg.workflows.findIndex((w) => w.id.startsWith(id));
    if (idx === -1) {
      console.error(`✗ Workflow not found: ${id}`);
      process.exit(1);
    }

    const w = reg.workflows[idx];
    if (opts.name) w.name = opts.name;
    if (opts.description) w.description = opts.description;
    if (opts.tags)
      w.tags = opts.tags
        .split(",")
        .map((t: string) => t.trim())
        .filter(Boolean);
    if (opts.color) w.color = opts.color;
    if (opts.icon) w.icon = opts.icon;
    w.updated = new Date().toISOString().slice(0, 10);

    clusterAndSave(reg);
    console.log(`✓ Updated: ${w.name}`);
  });

program
  .command("remove <id>")
  .description("Remove a workflow")
  .action((id) => {
    const reg = readReg();
    const before = reg.workflows.length;
    reg.workflows = reg.workflows.filter((w) => !w.id.startsWith(id));
    if (reg.workflows.length === before) {
      console.error(`✗ Workflow not found: ${id}`);
      process.exit(1);
    }
    clusterAndSave(reg);
    console.log(`✓ Removed workflow ${id}`);
  });

program
  .command("list")
  .description("List all registered workflows")
  .option("--json", "Output as JSON")
  .action((opts) => {
    const { workflows, clusters } = readReg();
    if (opts.json) {
      console.log(JSON.stringify({ workflows, clusters }, null, 2));
      return;
    }
    if (workflows.length === 0) {
      console.log("No workflows registered. Run: ai-hub register --help");
      return;
    }
    for (const w of workflows) {
      const c = clusters.find((c) => c.id === w.cluster_id);
      console.log(`  ${w.name} (${w.id.slice(0, 8)})`);
      console.log(`   ${w.description}`);
      console.log(
        `   tags: ${w.tags.join(", ")}  workspace: ${c?.name ?? "—"}`,
      );
      console.log(`   path: ${w.repo_path}`);
      console.log();
    }
  });

program.parse();
