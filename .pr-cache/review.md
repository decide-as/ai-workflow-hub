### Code Review

**Stage:** MVP | **Scope:** `scripts/finn-job-tracker.py`, `.gitignore`, `logs/.gitignore`

**Verdict:** WORLD-CLASS FOR THIS STAGE
**Ready to advance to Alpha?** NOT READY (no tests, hardcoded home-dir paths, minor uncaught exception path in `store_in_job_tracker`)

**Summary:** Main loop correctly implements scrape → dedup → fetch → score → store → notify. All major failure paths caught and logged individually, with dedup log persisted after each job so a mid-run crash doesn't lose progress. Security clean (no secrets, safe subprocess, parameterized SQL). Functions well-scoped.

**Blocking issues in scope:** None.

**Advancement blockers:**
- No tests for `extract_all_listings` / `extract_title_company_from_text` (most testable functions)
- Hardcoded home-directory paths — non-portable
- Uncaught exception in `store_in_job_tracker` body means a crash there leaves the job unrecorded in dedup log (re-scored next run)

**Out-of-scope observations:**
- launchd plist not committed — installation is a manual step (fine for MVP)
- `url: str = None` should be `Optional[str] = None` for type consistency (cosmetic)
