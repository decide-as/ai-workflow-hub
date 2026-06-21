import { app } from "electron";
import { join } from "path";
import { createHash } from "crypto";
import { readFileSync, writeFileSync, existsSync } from "fs";
import type { Workflow } from "../../shared/types";

type Extractor = (
  text: string,
  opts: { pooling: string; normalize: boolean },
) => Promise<{ data: Float32Array }>;

let _extractor: Extractor | null = null;

async function getExtractor(): Promise<Extractor> {
  if (_extractor) return _extractor;
  const { pipeline, env } = await import("@xenova/transformers");
  env.cacheDir = join(app.getPath("userData"), "models");
  _extractor = (await pipeline(
    "feature-extraction",
    "Xenova/all-MiniLM-L6-v2",
  )) as Extractor;
  return _extractor;
}

function workflowText(w: Workflow): string {
  return [w.name, w.summary, w.description, w.tags.join(", ")]
    .filter(Boolean)
    .join(". ");
}

function corpusHash(workflows: Workflow[]): string {
  const str = workflows.map((w) => `${w.id}:${workflowText(w)}`).join("|");
  return createHash("sha256").update(str).digest("hex").slice(0, 16);
}

interface DiskCache {
  hash: string;
  ids: string[];
  embeddings: number[][];
}

interface MemCache {
  hash: string;
  ids: string[];
  vecs: Float32Array[];
}

let _cache: MemCache | null = null;

function cachePath(): string {
  return join(app.getPath("userData"), "workflow-embeddings.json");
}

function loadDisk(hash: string): MemCache | null {
  const p = cachePath();
  if (!existsSync(p)) return null;
  try {
    const d: DiskCache = JSON.parse(readFileSync(p, "utf8"));
    if (d.hash !== hash) return null;
    return { hash: d.hash, ids: d.ids, vecs: d.embeddings.map((e) => new Float32Array(e)) };
  } catch {
    return null;
  }
}

function saveDisk(mem: MemCache): void {
  try {
    const d: DiskCache = {
      hash: mem.hash,
      ids: mem.ids,
      embeddings: mem.vecs.map((v) => Array.from(v)),
    };
    writeFileSync(cachePath(), JSON.stringify(d));
  } catch (e) {
    console.error("[embeddings] save failed:", e);
  }
}

async function ensureCorpus(workflows: Workflow[]): Promise<void> {
  const active = workflows.filter((w) => !w.status || w.status === "active");
  const hash = corpusHash(active);
  if (_cache?.hash === hash) return;

  const disk = loadDisk(hash);
  if (disk) {
    _cache = disk;
    return;
  }

  const extractor = await getExtractor();
  const ids = active.map((w) => w.id);
  const vecs: Float32Array[] = [];
  for (const w of active) {
    const out = await extractor(workflowText(w), { pooling: "mean", normalize: true });
    vecs.push(new Float32Array(out.data));
  }

  _cache = { hash, ids, vecs };
  saveDisk(_cache);
}

function dot(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export async function warmupEmbeddings(workflows: Workflow[]): Promise<void> {
  try {
    await ensureCorpus(workflows);
  } catch (e) {
    console.error("[embeddings] warmup failed:", e);
  }
}

export async function semanticSearch(
  query: string,
  workflows: Workflow[],
): Promise<{ id: string; score: number }[]> {
  await ensureCorpus(workflows);
  if (!_cache) return [];

  const extractor = await getExtractor();
  const out = await extractor(query, { pooling: "mean", normalize: true });
  const qv = new Float32Array(out.data);

  return _cache.ids
    .map((id, i) => ({ id, score: dot(qv, _cache!.vecs[i]) }))
    .sort((a, b) => b.score - a.score);
}
