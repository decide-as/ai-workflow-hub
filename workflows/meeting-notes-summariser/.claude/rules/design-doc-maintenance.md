# Design Doc Maintenance

Design docs in `docs/designs/` describe the architecture of subsystems. They must stay consistent with the code they describe and with each other.

## When to update a design doc

Update a design doc in the same PR when the change:

- Adds, removes, or renames a component described in the doc
- Changes the data model, control flow, or failure handling strategy
- Adds a new alternative that was considered (even if rejected)
- Invalidates a statement in the Architecture, Component Design, or Control Flow sections

Do NOT update a design doc for:

- Bug fixes that don't change the architecture
- Performance optimizations that don't change the design
- Test additions or refactors
- Documentation-only changes to other files

## How to update

1. Bump the `updated:` field in the YAML frontmatter to today's date (run `date +%Y-%m-%d`)
2. Edit only the sections affected by the change
3. If the change is large enough to invalidate the doc's premise, consider writing a new design doc and marking the old one `status: superseded`

## Staleness check during PRs

When preparing a PR that modifies source modules, check whether any design doc in `docs/designs/` describes the affected subsystem. The mapping:

| Design Doc | Modules / Files It Describes |
|---|---|
| design-2026-03-16-code-practices.md | Overall architecture (summary of all modules) |
| design-2026-03-14-deferred-versioning.md | finalize-release.sh, write-changelog-fragment.sh, collect-changelog-fragments.sh |
| design-2026-03-14-risk-assessment.md | risk_checks.py, risk_filter.py, check-risk-assessment.sh, filter-risks.py |
| design-2026-03-14-skills-architecture.md | .claude/skills/\*, rules_manager.py (copy_skills) |
| design-2026-03-18-diff-review.md | .claude/skills/diff-review/\*, .claude/scripts/pr-comment-agent-diff-review.sh |
| design-2026-03-15-tiered-quality.md | coverage_tiers.py, mutation_tiers.py, test_test_quality.py |
| design-2026-03-15-worktree-isolation.md | guard-master-edits.sh, approve-worktree-commands.sh, setup-worktree-venv.sh |
| design-2026-03-16-prioritize-skill.md | prioritize.py, .claude/skills/prioritize/\* |
| design-2026-03-11-ci-pipeline.md | .github/workflows/test.yml, .github/workflows/mutation.yml, .github/scripts/\*, test.yml.j2 |
| design-2026-03-17-phase-graduated-strictness.md | metadata.py (PHASE_TO_QUALITY_GATE, PHASE_TO_STAGE), risk_checks.py (PHASE_TO_TIER), Makefile.j2, test.yml.j2, pyproject.toml.j2 |
| design-2026-03-18-post-merge-release.md | release.yml, tag-ci.yml, finalize-release.sh, .claude/skills/pr/SKILL.md |
| design-2026-03-18-agent-lineage-system.md | lineage/\*.py (models, bom, drift, capabilities, propagation, diagnostics, impact, compatibility), cli.py (lineage command group) |
| design-2026-03-19-plugin-architecture.md | plugin_loader.py, plugin_api.py, cli/plugins.py, cli/\_\_init\_\_.py (plugin setup) |
| design-2026-03-19-opinionation.md | .claude/rules/opinionation.md, scoring framework, opinionation posture |

If a design doc describes the affected module and the change is architectural, update the doc.

## Authority hierarchy

- **Subsystem design docs** are authoritative for their subsystem's architecture
- **design-2026-03-16-code-practices.md** is a summary — it may lag behind subsystem docs and that is acceptable
- **Code** is the final authority — if a design doc contradicts the code, update the doc

## New design docs

When building a new subsystem (3+ modules, new data flow, new interfaces), create a design doc via the `/prd` skill. Retrospective design docs for existing subsystems use `status: approved` and the date the subsystem was first introduced.
