---
id: prd-2026-06-26-clustering-v2
title: Improved Image Clustering with Outlier Detection and Misc Bucket
owner: Christian Braathen
created: 2026-06-26
updated: 2026-06-26
status: draft
priority: P1
related_docs: [prd-2026-06-26-image-auto-clustering.md, design-2026-06-26-image-auto-clustering.md]
---

# Improved Image Clustering with Outlier Detection and Misc Bucket

## Problem

The current clustering produces poor folder names and misplaces images because
it forces every image into a cluster even when it doesn't fit. A BankID screen
lands in `data-sales`, a kitchen render lands in `modern-bathroom`, and 120
unrelated images pile into a single catch-all cluster. The root causes are:
(1) the Python organizer script uses TF-IDF on verbose descriptions instead of
the curated keywords Qwen already produced, and (2) k-means has no concept of
"this image belongs to no cluster."

## Context

The existing `image-clustering.ts` is architecturally correct — it uses
`paraphrase-multilingual-mpnet-base-v2` (768-dim) real embeddings — but the
standalone Python organizer script bypassed those embeddings and fell back to
TF-IDF on raw description text, which is too noisy for short image descriptions.
Additionally, neither implementation allows images to be "unassigned" — every
image must go somewhere, polluting clusters with outliers.

Qwen's generated keywords (4-8 per image) are already high-quality semantic
labels confirmed by spot-check. Using keyword tokens as the feature space
produces dramatically cleaner vectors than tokenising verbose descriptions.

## Goals

- Images that clearly belong to a topic cluster go there; images that don't fit
  any cluster go to `misc/`.
- Cluster labels read as natural, human-recognisable categories.
- Cluster sizes are meaningful — no single cluster swallowing 40% of all images.

## Non-Goals

- Not changing the vision analysis (Qwen) step — metadata quality is already good.
- Not adding new npm or Python packages or new Ollama models.
- Not building a UI for manual cluster review or reassignment.
- Not hierarchical clustering.

## Scope

### In Scope

- Replace TF-IDF-on-descriptions with keyword-token vectors in the Python script.
- Add minimum cluster size threshold: clusters with fewer than 5 images dissolve
  into `misc/`.
- Add distance-based outlier detection: images whose cosine distance to their
  cluster centroid exceeds mean + 1.5σ are moved to `misc/`.
- Improve label generation to use Qwen's raw keywords directly (top 2 by
  frequency within cluster members) rather than TF-IDF token extraction.
- Update `image-clustering.ts` (TypeScript app) with the same outlier detection
  and misc bucket logic so the in-app experience matches.
- Update the state file format to record a `misc` list alongside named clusters.

### Out of Scope

- Changing the clustering algorithm from k-means.
- Re-analyzing images (cached `.organizer-state.json` is reused).
- Changing the IPC interface beyond adding `misc` to `ClusterResult`.

## Success Criteria

1. Running on the 317-image dataset, no single named cluster contains more than
   30% of all images.
2. `misc/` exists and contains images that are visibly mixed-topic on spot-check.
3. Cluster labels are recognisable human categories — no statistical noise tokens.
4. All images are accounted for: sum(cluster sizes) + len(misc) = 317.
5. TypeScript `ClusterResult` includes a `misc: string[]` field.

## Users and Stakeholders

- Christian (solo dev + user): runs the organizer on screenshots regularly.

## Requirements

### Functional

- System must build keyword-token vectors: split each image's Qwen keywords into
  individual tokens, build a binary TF-IDF matrix over this curated vocabulary.
- System must apply k-means++ with silhouette-based K selection over K ∈ [2, 12].
- System must dissolve clusters with fewer than `min_cluster_size` (default 5)
  images into `misc/`.
- System must detect per-cluster outliers: compute mean and std of
  member-to-centroid cosine distances; move images with distance > mean + 1.5σ
  to `misc/`.
- System must label clusters using the top 2 most-frequent Qwen keywords across
  cluster members.
- System must create `misc/` and move unassigned images there.
- TypeScript `ClusterResult` must include `misc: string[]`.

### Non-Functional

- Python script must not require `pip install` — only stdlib.
- Re-clustering must run on existing `.organizer-state.json` without re-running
  vision analysis.
- `min_cluster_size` and outlier sigma must be configurable constants.

## Affected Modules

| Module | Impact |
|---|---|
| `scratchpad/organize_screenshots.py` | core — keyword vectors, outlier detection, misc bucket |
| `src/main/image-clustering.ts` | update — misc bucket, outlier detection, keyword labels |
| `shared/types.ts` | update — add `misc: string[]` to `ClusterResult` |

## Risks

- Outlier threshold (1.5σ) may be too aggressive for small datasets or too lenient
  for very heterogeneous ones. Mitigation: expose as a constant, default 1.5.
- Dissolving small clusters may suppress valid minority topics. Mitigation:
  min_cluster_size defaults to 5, configurable down to 3.
- Keyword token vectors are sparser than description vectors — may produce lower
  silhouette scores but more meaningful clusters. Acceptable trade-off.

## Assumptions

- `.organizer-state.json` with 317 analyzed images already exists and is valid.
- Qwen's generated keywords are high enough quality to use directly as the
  feature space and as cluster labels (confirmed by spot-check).
