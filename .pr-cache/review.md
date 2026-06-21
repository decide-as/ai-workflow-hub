### Stage
MVP

### Scope
This branch: `shared/ipc-channels.ts`, `src/main/embeddings.ts`, `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/src/App.tsx`, `src/renderer/src/components/SearchBar.tsx`, `src/renderer/src/components/WorkflowCard.tsx`, `src/renderer/src/components/WorkflowRow.tsx`.

### Verdict for current stage
WORLD-CLASS FOR THIS STAGE

### Ready to advance?
NOT READY FOR NEXT STAGE

### Summary

The feature is complete, correct, and well-scoped. The embedding pipeline (`embeddings.ts`) is clean: lazy extractor init, SHA-256 corpus hash for disk-cache invalidation, cosine similarity via dot-product of normalized vectors. IPC wiring follows the established pattern exactly. The unified search bar UX (text OR semantic, score badge suppressed on text matches) solves the original problem cleanly. No secrets, no injection vectors, no correctness bugs.

### Blocking issues in scope
None.

### Advancement blockers
- **Corpus build concurrency**: `ensureCorpus` has no in-flight lock. Two concurrent IPC calls while the corpus is building will race and both try to write `workflow-embeddings.json`. The 350ms debounce and 3s warmup delay make this unlikely in practice, but it is a data race. Add a `_building: Promise | null` guard before Alpha.
- **IPC input not validated at runtime**: `query` is typed `string` in TypeScript but IPC args are untyped at runtime. Add `if (typeof query !== "string") return []` in the handler before Alpha.
- **No unit tests for `embeddings.ts`**: The corpus hash, cache hit/miss, and dot-product logic are unit-testable with a mock extractor. Add before Beta.

### Out-of-scope issues noticed
None of significance.

### Next improvements
1. Add `_building: Promise<void> | null = null` concurrency guard in `ensureCorpus`.
2. Add runtime type guard in the IPC handler.
3. Add unit tests for `corpusHash`, `loadDisk`/`saveDisk`, and `dot`.
