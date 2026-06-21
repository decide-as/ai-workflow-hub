---
bump: patch
---

### Changed

- Switch semantic search embedding model from `all-MiniLM-L6-v2` (384-dim) to `paraphrase-multilingual-mpnet-base-v2` (768-dim) for richer representations and multilingual support; existing embedding caches are automatically invalidated via model-name-aware corpus hash
