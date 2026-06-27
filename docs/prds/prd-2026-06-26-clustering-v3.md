---
id: prd-2026-06-26-clustering-v3
title: Dense Embedding Clustering with LLM-Synthesised Folder Labels
owner: Christian Braathen
created: 2026-06-26
updated: 2026-06-26
status: draft
priority: P1
related_docs: [prd-2026-06-26-clustering-v2.md, design-2026-06-26-image-auto-clustering.md]
---

# Dense Embedding Clustering with LLM-Synthesised Folder Labels

## Problem

Both previous clustering attempts (TF-IDF on descriptions, keyword-token vectors)
produce silhouette scores below 0.1 and catch-all clusters because sparse
vectors cannot represent semantic similarity — "flight" and "airline ticket" share
no tokens and look unrelated. Folder labels produced by keyword frequency are also
mechanical and often wrong (e.g. `macos-azure`, `norwegian-date`). The system
needs dense semantic embeddings to find genuine topic structure, and needs a
reasoning model to synthesise a human-readable label from cluster content.

## Context

The lanserbart repo already solves this for icon search:
`sentence-transformers/paraphrase-multilingual-mpnet-base-v2` (768-dim),
L2-normalised, flat numpy dot product (`embeddings @ query_vec`). That is the
same model already used by the Electron app (`@xenova/transformers` loads it for
workflow semantic search). Ollama (`qwen3-vl:8b`) is already running and handles
text-only inference without images, making it usable as a labelling LLM with no
additional model downloads.

## Goals

- Cluster 300+ analyzed images into semantically coherent groups using 768-dim
  dense embeddings (same model/approach as lanserbart).
- Generate folder labels that a human would choose — synthesised by a reasoning
  model reading the cluster's image descriptions, not derived from term frequency.
- Images that don't fit any cluster land in `misc/`.

## Non-Goals

- Not changing the vision analysis step (Qwen metadata is already high quality).
- Not re-implementing the Electron app's clustering — Python organizer script only.
- Not adding a faiss or ANN index — flat numpy is sufficient for <1000 images.
- Not persisting embeddings to disk — recompute from cached descriptions each run.

## Scope

### In Scope

- Add `sentence-transformers` as a Python dependency to the organizer script.
- Embed each image's `description + keywords` with
  `paraphrase-multilingual-mpnet-base-v2` (768-dim), `normalize_embeddings=True`.
- Cluster using k-means++ + silhouette selection (same logic as v2).
- Keep outlier detection (mean + 1.5σ) and minimum cluster size (5) → `misc/`.
- After clusters are finalised, call Ollama (`qwen3-vl:8b`, text-only) with all
  member descriptions to synthesise one short label per cluster.
- Apply that LLM-generated label as the folder name.

### Out of Scope

- Updating `image-clustering.ts` (TypeScript) — tracked separately.
- Embedding model fine-tuning or domain adaptation.
- Persistent embedding cache.

## Success Criteria

1. Silhouette score materially higher than the 0.09 v2 ceiling.
2. No single named cluster holds more than 25% of all images.
3. Folder labels pass a human smell-test: 10 random labels make sense cold.
4. `misc/` contains visibly mixed, unrelated images only.
5. Full recluster of 317 images completes in under 5 minutes.

## Users and Stakeholders

- Christian (solo dev + user).

## Requirements

### Functional

- Encode `"{description}. {keywords}"` per image using
  `SentenceTransformer("paraphrase-multilingual-mpnet-base-v2")` with
  `normalize_embeddings=True`, float32 [N, 768].
- Similarity via flat numpy dot product (`embeddings @ embeddings.T`).
- K selection, outlier detection, misc dissolve carry over from v2.
- Label each cluster via Ollama text-only request: prompt instructs model to
  output exactly one short label (2-4 words, lowercase, hyphen-separated);
  body includes member descriptions (up to 200 chars each, max 30 per cluster).
- Label calls use `keep_alive: 0`.
- Folder names sanitised: lowercase, hyphens, alphanumeric, max 40 chars.

### Non-Functional

- `pip install sentence-transformers` is a one-time setup step.
- Model download (~970 MB) happens automatically on first run, cached to
  `~/.cache/huggingface/`.
- Embedding batch size: 32.
- LLM label calls sequential (~11 clusters, ~2 min total).

## Affected Modules

| Module | Impact |
|---|---|
| `scratchpad/organize_screenshots.py` | core — dense embeddings + LLM labels |
| `scratchpad/recluster.py` | superseded |
| `src/main/image-clustering.ts` | follow-up — misc field, label alignment |

## Dependencies

- `sentence-transformers` Python package (new).
- `paraphrase-multilingual-mpnet-base-v2` weights (~970 MB, HuggingFace).
- Ollama `qwen3-vl:8b` for label synthesis (already running).

## Risks

- First run requires ~970 MB model download. Mitigation: check cache first.
- LLM labelling adds ~2 min for 11 clusters. Acceptable quality trade-off.
- LLM may produce invalid label format. Mitigation: sanitise + retry with
  stricter prompt.

## Assumptions

- `sentence-transformers` is installable in the local Python environment.
- Model may already be cached from lanserbart usage.
- `qwen3-vl:8b` handles text-only prompts reliably for short summarisation.
