---
id: prd-2026-06-26-image-auto-clustering
title: Image Auto-Clustering with Local Embeddings
owner: Christian Braathen
created: 2026-06-26
updated: 2026-06-26
status: draft
priority: P1
related_docs: [design-2026-06-26-image-auto-clustering.md]
---

# Image Auto-Clustering with Local Embeddings

## Problem

The vision service can describe and tag individual images, but gives no way to
group them. A user with hundreds of screenshots has no way to understand what
categories of content they have without manually reviewing each one. The missing
layer is automatic grouping — taking the descriptions and keywords already
produced and organising them into labelled clusters.

## Context

The vision service (`src/main/vision.ts`) already returns `{ description,
keywords[] }` per image via Ollama. The project already ships
`@xenova/transformers` with `paraphrase-multilingual-mpnet-base-v2` for
workflow search. Embedding generation infrastructure is therefore already
present and tested. No new model downloads are required.

## Goals

- Given N analyzed images, group them into meaningful topic clusters
  automatically, with no user-defined categories required upfront.
- Label each cluster with a short keyword or phrase that describes its content.
- Run entirely locally using the existing embedding model.

## Non-Goals

- Does not perform image analysis itself — that is `vision.ts`.
- Does not persist clusters to disk — callers decide storage.
- Does not display clusters in the UI — that is the file organizer workflow's job.
- Does not support hierarchical or overlapping clusters.

## Scope

### In Scope

- Embed each image's `description + keywords` using the existing multilingual model.
- Cluster the embeddings into K groups using k-means with automatic K selection via silhouette score.
- Label each cluster by finding the most representative keyword across its members (highest TF-IDF weight against the cluster's descriptions).
- Expose the result via IPC so any workflow or renderer can call it.

### Out of Scope

- GPU-accelerated clustering.
- Incremental / streaming clustering as new images arrive.
- Cluster persistence or versioning.
- UI for cluster review or editing.

## Success Criteria

1. Given ≥5 analyzed images, `clusterImages()` returns ≥2 meaningful clusters with distinct labels.
2. Each cluster label is a single keyword or short phrase present in or strongly derived from the member images' keywords/descriptions.
3. The function completes in under 10 seconds for up to 500 images on the target machine (Apple Silicon, 48 GB).
4. Calling `clusterImages()` does not permanently retain the embedding model in RAM — it releases within 30 seconds of completion (inherits `embeddings.ts` lifecycle).
5. TypeScript types for `ClusterResult` are exported from `shared/types.ts` and match the IPC response.
6. Works for N=1 and N=2 (edge cases: returns 1 cluster each).

## Users and Stakeholders

- Christian (solo dev + user): needs clusters to drive the file organizer workflow.

## Requirements

### Functional

- System must accept an array of `VisionResult` objects and return an array of `ImageCluster` objects.
- System must auto-select K using silhouette score over K ∈ [2, min(8, N÷2)].
- System must fall back to K=1 when N < 4.
- System must label each cluster using TF-IDF across member descriptions, returning the highest-scoring term not in a stopword list.
- System must expose `vision:cluster` as an IPC channel callable from the renderer.

### Non-Functional

- Pure in-memory computation — no filesystem writes.
- No new npm dependencies — k-means implemented in vanilla TypeScript using existing Float32Array embeddings.
- Embedding model cache is shared with `embeddings.ts` (same `getExtractor()` call pattern).

## Affected Modules

| Module | Impact |
|---|---|
| `src/main/image-clustering.ts` | new — core clustering and labelling logic |
| `src/main/embeddings.ts` | read-only reuse of `getExtractor()` |
| `shared/types.ts` | add `ImageCluster`, `ClusterResult` types |
| `shared/ipc-channels.ts` | add `VISION_CLUSTER` channel |
| `src/main/index.ts` | add IPC handler |
| `src/preload/index.ts` | expose `visionCluster()` to renderer |

## Dependencies

- `@xenova/transformers` — already installed, used by `embeddings.ts`.
- Ollama is **not** required for clustering — only the embedding model is used.

## Risks

- Silhouette-based K selection adds O(K²·N) computation — acceptable for N≤500 but may be slow for larger sets.
- k-means is non-deterministic (random seed initialisation) — clusters may vary between runs on the same input. Acceptable for file organisation use.
- Cluster labels derived from TF-IDF may be noisy for short descriptions. Mitigate by also considering keyword frequency as a fallback.

## Assumptions

- `VisionResult` objects passed in have already been computed — this module does not call the vision service.
- The embedding model (`paraphrase-multilingual-mpnet-base-v2`) is already cached on disk from prior workflow search usage.
- English and Norwegian descriptions both embed well with the multilingual model (confirmed by existing semantic search usage).

## Open Questions

- **Q:** Should K selection be fully automatic, or should callers be able to pass a fixed K?
  **Recommendation:** Accept an optional `maxClusters?: number` parameter (default 8). Automatic selection still runs within [2, maxClusters], giving callers control without requiring it.

- **Q:** Should the cluster label be a single keyword or allow a short phrase (2-3 words)?
  **Recommendation:** Allow up to 3 words. Single keywords are too vague for mixed-content clusters. Cap at 3 words to keep labels scannable as folder names.

## Prioritization

**Profile:** solo_dev

| Bucket | Score |
|--------|-------|
| Value | 62 |
| Risk | 71 |
| Constraints | 68 |
| Energy | 55 |
| **Total** | **64** |

**Interpretation:** P1 — solid value with low risk. The existing embedding infrastructure eliminates the main technical unknown.

**Top concerns:** Energy bucket is weakest — k-means + silhouette scoring from scratch in TypeScript is the most effortful part.
