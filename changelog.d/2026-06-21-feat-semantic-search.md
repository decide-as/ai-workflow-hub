---
bump: minor
---

### Added

- Semantic "describe" search powered by local embeddings: type a natural-language description in the search field to find matching workflows by meaning, not just keyword. The `all-MiniLM-L6-v2` model runs entirely offline in the Electron main process via `@xenova/transformers`; model and corpus embeddings are cached to `userData` on first run.
- Unified search bar replaces the previous text-only field — the same input handles both exact substring matching and semantic similarity search (≥ 5 characters triggers semantic mode). Icon switches from magnifying glass → sparkles → spinner to reflect the current mode.
- Semantic match score badge (shown in red) appears on workflow cards and rows for results surfaced by semantic search, suppressed for exact text matches where the cosine score would be misleadingly low.
- `SemanticSearchResult` type added to `shared/types.ts`; `--c-score` CSS variable added to both dark and light themes for consistent score badge theming.
