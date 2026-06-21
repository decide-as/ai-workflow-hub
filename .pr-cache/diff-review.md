## Diff Review

**Scope:** Raw diff hunks + git blame | **Agents:** 3 | **Findings:** 2 above threshold (80) | **Suppressed:** 3 below threshold

### Findings

| # | Agent | File | Lines | Confidence | Finding |
|---|---|---|---|---|---|
| 1 | bug | `src/main/embeddings.ts` | ~87–95 | 95 | Race condition: two concurrent IPC calls both pass `_cache?.hash === hash` null check, both embed corpus, both call `writeFileSync`. Torn JSON write possible; `_cache!` non-null assertion and `if (!_cache)` check race on same module-level variable. Fixed by adding a `_building` promise guard. |
| 2 | bug | `src/renderer/src/App.tsx` | ~201–213 | 85 | `clearTimeout` cancels the 350ms debounce but not the in-flight IPC `await`. After effect cleanup (e.g. HMR), `setSemanticScores`/`setSemanticSearching` still fire. Theoretical in production (App never unmounts in Electron), but worth an `isCancelled` flag for correctness. |

*Both findings are MVP-acceptable given the debounce guard and Electron's single-window lifecycle. Logged as advancement blockers for Alpha.*

### Agent summaries

- [x] **Guideline compliance** — Checked naming, import patterns, logging conventions, and typing. All findings were false positives from incomplete diff context (types and functions are defined in the full file).
- [x] **Bug detection** — Found two real async safety issues: corpus build race (confidence 95) and stale async state (confidence 85). Both acceptable at MVP stage.
- [x] **History consistency** — Found two real deviations fixed in this PR: hardcoded `#ef4444` → `var(--c-score)` CSS variable; inline `{ id: string; score: number }[]` return type → named `SemanticSearchResult` in shared/types.ts.
