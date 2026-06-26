import { app } from "electron";
import { join } from "path";
import type { VisionResult, ImageCluster, ClusterResult } from "../../shared/types";

const EMBEDDING_MODEL = "Xenova/paraphrase-multilingual-mpnet-base-v2";

const EN_STOPWORDS = new Set([
  "a","an","the","and","or","but","in","on","at","to","for","of","with",
  "by","from","is","are","was","were","be","been","being","have","has",
  "had","do","does","did","will","would","could","should","may","might",
  "this","that","these","those","it","its","as","into","than","then",
  "when","where","which","who","what","how","not","no","so","if","up",
  "out","about","an","i","we","you","they","he","she","image","shows",
  "showing","show","displaying","displays","display","using","used","use",
  "multiple","several","including","includes","include","also","while",
  "screenshot","screen","window","page","view","appears","appear",
]);

const NO_STOPWORDS = new Set([
  "og","er","i","på","til","av","for","med","som","en","et","ei","de",
  "det","den","ikke","har","jeg","vi","du","han","hun","de","seg","sin",
  "sitt","sine","å","om","ved","fra","over","under","etter","før",
]);

type Extractor = (
  text: string,
  opts: { pooling: string; normalize: boolean },
) => Promise<{ data: Float32Array }>;

let _extractor: Extractor | null = null;

async function getExtractor(): Promise<Extractor> {
  if (_extractor) return _extractor;
  const { pipeline, env } = await import("@xenova/transformers");
  env.cacheDir = join(app.getPath("userData"), "models");
  _extractor = (await pipeline("feature-extraction", EMBEDDING_MODEL)) as Extractor;
  return _extractor;
}

function imageText(v: VisionResult): string {
  return `${v.description}. ${v.keywords.join(", ")}`;
}

function dot(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function cosineDistance(a: Float32Array, b: Float32Array): number {
  return 1 - dot(a, b);
}

function centroid(vecs: Float32Array[]): Float32Array {
  const dim = vecs[0].length;
  const c = new Float32Array(dim);
  for (const v of vecs) for (let i = 0; i < dim; i++) c[i] += v[i];
  const norm = Math.sqrt(vecs.reduce((s, v) => s + dot(v, v), 0) / vecs.length);
  for (let i = 0; i < dim; i++) c[i] = c[i] / vecs.length / (norm || 1);
  return c;
}

// k-means++ initialisation: pick seeds weighted by distance to existing seeds
function kMeansPlusPlus(vecs: Float32Array[], k: number): Float32Array[] {
  const n = vecs.length;
  const seeds: Float32Array[] = [vecs[Math.floor(Math.random() * n)]];
  while (seeds.length < k) {
    const dists = vecs.map((v) =>
      Math.min(...seeds.map((s) => cosineDistance(v, s))),
    );
    const total = dists.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < n; i++) {
      r -= dists[i];
      if (r <= 0) { seeds.push(vecs[i]); break; }
    }
    if (seeds.length < k) seeds.push(vecs[n - seeds.length]);
  }
  return seeds;
}

function kMeans(vecs: Float32Array[], k: number): number[] {
  let centroids = kMeansPlusPlus(vecs, k);
  let assignments = new Array(vecs.length).fill(0);

  for (let iter = 0; iter < 100; iter++) {
    // assign
    const next = vecs.map((v) => {
      let best = 0, bestD = Infinity;
      for (let c = 0; c < k; c++) {
        const d = cosineDistance(v, centroids[c]);
        if (d < bestD) { bestD = d; best = c; }
      }
      return best;
    });

    const changed = next.some((a, i) => a !== assignments[i]);
    assignments = next;
    if (!changed) break;

    // recompute centroids
    const groups: Float32Array[][] = Array.from({ length: k }, () => []);
    assignments.forEach((c, i) => groups[c].push(vecs[i]));
    centroids = groups.map((g, ci) => g.length > 0 ? centroid(g) : centroids[ci]);
  }

  return assignments;
}

function silhouetteScore(vecs: Float32Array[], assignments: number[], k: number): number {
  const n = vecs.length;
  let total = 0;
  for (let i = 0; i < n; i++) {
    const ci = assignments[i];
    const sameCluster = vecs.filter((_, j) => j !== i && assignments[j] === ci);
    const a = sameCluster.length > 0
      ? sameCluster.reduce((s, v) => s + cosineDistance(vecs[i], v), 0) / sameCluster.length
      : 0;

    let b = Infinity;
    for (let c = 0; c < k; c++) {
      if (c === ci) continue;
      const otherCluster = vecs.filter((_, j) => assignments[j] === c);
      if (otherCluster.length === 0) continue;
      const meanD = otherCluster.reduce((s, v) => s + cosineDistance(vecs[i], v), 0) / otherCluster.length;
      if (meanD < b) b = meanD;
    }

    const s = b === Infinity ? 0 : (b - a) / Math.max(a, b);
    total += s;
  }
  return total / n;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-zæøåé\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !EN_STOPWORDS.has(t) && !NO_STOPWORDS.has(t));
}

function tfidfLabel(memberTexts: string[], allClusterTexts: string[][]): string {
  const clusterTokens = memberTexts.flatMap(tokenize);
  const tf = new Map<string, number>();
  for (const t of clusterTokens) tf.set(t, (tf.get(t) ?? 0) + 1);

  const nClusters = allClusterTexts.length;
  const scores = new Map<string, number>();
  for (const [term, freq] of tf) {
    const docsWithTerm = allClusterTexts.filter((texts) =>
      texts.some((t) => tokenize(t).includes(term)),
    ).length;
    const idf = Math.log((nClusters + 1) / (docsWithTerm + 1)) + 1;
    scores.set(term, (freq / clusterTokens.length) * idf);
  }

  // Try to build a meaningful 1-3 word label from top terms
  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0) return "images";

  const top = ranked.slice(0, 3).map(([t]) => t);
  // Return top 1 term if it's clearly dominant, otherwise top 2
  if (ranked.length > 1 && ranked[0][1] > ranked[1][1] * 2) return top[0];
  return top.slice(0, 2).join(" ");
}

export async function clusterImages(
  images: VisionResult[],
  opts?: { maxClusters?: number },
): Promise<ClusterResult> {
  const maxK = Math.min(opts?.maxClusters ?? 8, Math.floor(images.length / 2));

  // Edge case: too few images for meaningful clustering
  if (images.length < 4) {
    const topKw = images.flatMap((v) => v.keywords).slice(0, 5);
    return {
      clusters: [{
        label: images[0]?.keywords[0] ?? "images",
        keywords: [...new Set(topKw)].slice(0, 5),
        imagePaths: images.map((v) => v.imagePath),
        centroidIndex: 0,
      }],
      model: EMBEDDING_MODEL,
      k: 1,
      silhouetteScore: 1,
    };
  }

  const extractor = await getExtractor();
  const vecs: Float32Array[] = [];
  for (const img of images) {
    const out = await extractor(imageText(img), { pooling: "mean", normalize: true });
    vecs.push(new Float32Array(out.data));
  }

  // Try each K and pick the one with the best silhouette score
  let bestK = 2;
  let bestAssignments = kMeans(vecs, 2);
  let bestScore = silhouetteScore(vecs, bestAssignments, 2);

  for (let k = 3; k <= maxK; k++) {
    const assignments = kMeans(vecs, k);
    const score = silhouetteScore(vecs, assignments, k);
    if (score > bestScore) {
      bestScore = score;
      bestK = k;
      bestAssignments = assignments;
    }
  }

  // Build cluster groups
  const groups: number[][] = Array.from({ length: bestK }, () => []);
  bestAssignments.forEach((c, i) => groups[c].push(i));

  const allClusterTexts = groups.map((idxs) => idxs.map((i) => imageText(images[i])));

  const clusters: ImageCluster[] = groups.map((idxs, ci) => {
    const memberTexts = idxs.map((i) => imageText(images[i]));
    const label = tfidfLabel(memberTexts, allClusterTexts);

    // Top keywords: frequency-ranked across members
    const kwFreq = new Map<string, number>();
    for (const i of idxs)
      for (const kw of images[i].keywords)
        kwFreq.set(kw, (kwFreq.get(kw) ?? 0) + 1);
    const keywords = [...kwFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k]) => k);

    return {
      label,
      keywords,
      imagePaths: idxs.map((i) => images[i].imagePath),
      centroidIndex: ci,
    };
  });

  // Replace centroidIndex with actual closest-to-centroid image index
  groups.forEach((idxs, ci) => {
    const memberVecs = idxs.map((i) => vecs[i]);
    const c = centroid(memberVecs);
    let best = 0, bestD = Infinity;
    idxs.forEach((imageIdx, pos) => {
      const d = cosineDistance(vecs[imageIdx], c);
      if (d < bestD) { bestD = d; best = pos; }
    });
    clusters[ci].centroidIndex = best;
  });

  return { clusters, model: EMBEDDING_MODEL, k: bestK, silhouetteScore: bestScore };
}
