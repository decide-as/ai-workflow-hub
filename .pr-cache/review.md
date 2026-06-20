### Code Review

**Stage:** MVP | **Scope:** This PR (registry/workflows.yaml + src/renderer/src/lib/icons.tsx)

**Verdict for current stage:** WORLD-CLASS FOR THIS STAGE

**Ready to advance?** NOT READY FOR NEXT STAGE (scope of this PR is complete; broader app advancement unrelated to this change)

---

#### Summary

Two-file additive change: new workflow registry entry and a one-line icon import. Both follow established patterns exactly. No logic introduced — pure data and registration.

#### Correctness

- [x] All required registry fields present per `workflow-registry.md`
- [x] UUID is valid and unique
- [x] `icon: Briefcase` registered in `icons.tsx` import and `ICON_MAP` before being referenced in the registry
- [x] `cluster_id: career` matches the `career` cluster entry added in the same commit
- [x] `local-dependency` tag applied to all 5 workflows with absolute `repo_path` values (upon ×2, linkedin_posts, code_practices, scrapers) plus the new workflow — consistent and complete
- [x] `added` and `updated` both set to `2026-06-20` (today)
- [x] 64 existing tests pass; no regressions

#### Security

- [x] No secrets or credentials
- [x] `repo_path` is a hardcoded constant — no user input involved

#### Maintainability

- [x] Follows existing workflow entry structure exactly
- [x] Icon registration follows the established two-line pattern (import + ICON_MAP entry)
- [x] `local-dependency` tag is discoverable via standard tag filtering — no new infrastructure needed

#### Documentation

- [x] `workflow-hub-data/job-strategy/README.md` explains data routing and cross-device clone instructions

#### Blocking issues in scope
None.

#### Advancement blockers
Not relevant to this PR — advancement decision is project-wide.

#### Out-of-scope issues noticed
None of significance.
