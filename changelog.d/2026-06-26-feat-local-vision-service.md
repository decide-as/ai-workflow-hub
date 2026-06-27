---
bump: minor
---

### Added

- Local vision analysis service using Ollama `qwen3-vl:8b` — analyzes images on-device with no cloud data sharing; returns structured descriptions and keywords with actionable pre-flight errors when Ollama or the model is missing.
- Image auto-clustering: embeds vision results using `paraphrase-multilingual-mpnet-base-v2` (768-dim), clusters via k-means++ with silhouette-scored auto-K selection, detects outliers (mean + 1.5σ per cluster), dissolves small clusters (< 5 images), and labels each group via TF-IDF across member descriptions.
- Image File Organizer workflow (`image-organizer` action): picks a folder, analyzes new images incrementally (cached in `.organizer-state.json`), produces a plan with named subfolders + a `misc/` bucket for outliers, surfaces restructure warnings when cluster boundaries shift, and supports dry-run preview before committing any file moves.
- Python CLI organizer (`scripts/image-organizer.py`) using the same embedding model via `sentence-transformers` for offline batch clustering with LLM label synthesis.
