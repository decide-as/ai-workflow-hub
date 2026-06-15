# Release Engineering

## The two traps

Most teams fall into one of two traps. They over-engineer releases — three-page runbooks, manual sign-offs, a dedicated "release manager" — and end up shipping once a month out of sheer dread. Or they under-engineer them — `git tag v1.2.3 && git push --tags` run from someone's laptop — and end up with version mismatches, empty changelogs, and the dreaded "wait, what's actually in production?" conversation. Both paths lead to the same place: nobody wants to release on a Friday, and eventually nobody wants to release at all.

The goal is a release pipeline that is boring. Merge triggers it. It does the right thing. You go home.

## The versioning decision that actually matters

Semantic versioning sounds simple — MAJOR.MINOR.PATCH — until you're staring at a diff wondering whether removing an optional parameter's default value is a breaking change. Here's the decision framework:

- **MAJOR** — a consumer's existing code will break without changes. Removed endpoints, renamed public functions, changed return types, schema migrations that aren't backward-compatible. If someone has to edit their code after upgrading, it's major.
- **MINOR** — new capabilities that don't break existing usage. New functions, new optional parameters with defaults, additive schema fields. The key test: can every existing caller upgrade without changing a single line?
- **PATCH** — bug fixes, documentation, dependency updates, performance improvements with no API surface change.

During pre-1.0 development, minor is your primary increment. Major bumps before 1.0 are a social signal ("we rewrote everything"), not a semver requirement.

The mistake teams make: treating "I feel like this is a big change" as the criterion. Size doesn't determine the bump. A one-line change that removes a public function is major. A 2,000-line new feature is minor.

## Single source of truth for version

The version must live in exactly one place. Everything else reads from it:

- **Python**: `pyproject.toml` `[project] version`. Access at runtime via `importlib.metadata.version("pkg")`.
- **Node**: `package.json` `version`.
- **Metadata**: `project-meta.yaml` version must be synchronized automatically, never updated by hand.

If two files can independently declare the version, they will eventually disagree. The release pipeline — not a human — should update derived locations. If you find yourself manually editing version strings in multiple files, your tooling has a bug.

## Fragment-based changelogs

Editing `CHANGELOG.md` directly on feature branches is a merge-conflict factory. Three branches touch the "Unreleased" section, and every one of them conflicts with the others despite being logically independent.

The fix is fragment files:

1. Each PR creates a file in `changelog.d/` (e.g., `changelog.d/add-template-validation.md`) with its changes under standard subsections: Added, Changed, Fixed, etc.
2. Include a `bump:` frontmatter field signaling the expected version increment:

    ```yaml
    ---
    bump: minor
    ---
    ### Added
    - Template validation with JSON Schema enforcement
    ```

3. On release, a script collects all fragments, groups entries by subsection, prepends the assembled section to `CHANGELOG.md` with the new version and date, and deletes the fragment files.
4. The release pipeline computes the next version by taking the highest `bump:` value across all fragments.

Fragments never conflict because each PR owns its own file. The changelog is assembled at release time, not edited in flight.

## Release pipeline design

A release pipeline must have four properties. Miss any one and you'll regret it:

1. **Triggered by merge** — not by a human clicking a button, running a script on their laptop, or remembering to tag. Merging to the release branch is the trigger. Period.
2. **Idempotent** — re-running the pipeline on the same state either produces the same result or exits cleanly. This means you can retry failed releases without creating duplicate tags or ghost versions.
3. **Atomic** — version bump, changelog assembly, commit, tag, and GitHub release happen as one unit. If the tag creation fails, the version bump is rolled back. No half-released states.
4. **Auditable** — every release has a commit (the REL commit), a tag, and a GitHub release with generated notes. Six months from now, you can trace exactly what shipped in v1.4.2 without reading git log.

The pipeline flow:

```text
Merge to main
  → Check for changelog fragments (exit early if none)
  → Compute next version from fragment bump: fields
  → Collect and assemble changelog
  → Update version in canonical source
  → Synchronize derived version files
  → Commit as REL commit
  → Create git tag
  → Create GitHub release with changelog as body
```

### Guarding against empty releases

If no changelog fragments exist, the pipeline must exit with success and do nothing. This is not an edge case — it's the normal state after a REL commit triggers the CI pipeline again. Without this guard, you get an infinite loop: merge → release → REL commit → merge → release → REL commit.

The check is simple: count fragment files. Zero fragments means zero work.

## Release branch management

Match your release strategy to your project's complexity:

- **Simple projects** — release from `master`. No release branches. Tags mark releases.
- **Standard projects** — accumulate features on `develop`, promote to `master` via PR, release from `master`. The promotion PR triggers the release pipeline.
- **Full projects** — `develop` → `staging` → `master`. Staging validates before release.

Cut a `release/X.Y` branch only when you need to backport patches to an older major/minor version. This is rare for most projects and should be the exception, not the default. Delete release branches when the version reaches end-of-life — stale branches are a maintenance liability.

## Pre-release versions

For beta testing or release candidates before a stable release:

- Use semver pre-release suffixes: `1.0.0-beta.1`, `1.0.0-rc.1`
- Pre-release versions sort before their release counterpart: `1.0.0-beta.1 < 1.0.0`
- Publish pre-releases to test registries or with pre-release flags (`pip install --pre`, npm `--tag beta`)
- Increment the pre-release number, not the version, between candidates: `1.0.0-rc.1` → `1.0.0-rc.2` → `1.0.0`

## Anti-patterns

**The "release czar"** — one person who knows the release process and everyone else just asks them. When they're on vacation, releases stop. The pipeline should be the czar.

**Version bumping in PRs** — feature PRs should never touch the version string. The release pipeline decides the version based on accumulated changes. PRs that bump versions cause conflicts and force serialized merging.

**Changelog-as-afterthought** — writing the changelog from git log at release time produces useless entries like "fix tests" and "address review comments." Each PR writes its own changelog fragment while the context is fresh.

**Manual tagging** — `git tag` from a developer's machine means the tag might not match any CI-tested commit. Tags should only be created by the release pipeline from a commit that passed CI.
