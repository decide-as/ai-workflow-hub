# Electron App Versioning

The installable app version in `package.json` must always match the canonical project version, with a build suffix appended on non-release branches.

## Canonical version source

The canonical version is the latest git tag (e.g. `v0.24.0`). Derive it at runtime:

```bash
git describe --tags --abbrev=0 | sed 's/^v//'
```

Never read the version from `package.json` itself — that file is the target, not the source.

## Rules

### On `main` (after release automation runs)

`package.json` version = latest git tag, no suffix.

Example: tag `v0.24.0` → `"version": "0.24.0"`

The post-merge `release.yml` workflow is responsible for keeping `package.json` in sync when it bumps the version. Add a step there if it does not already update `package.json`.

### On a feature branch

`package.json` version = latest git tag + `-dev.<commit-count>` suffix.

The commit count is the number of commits on the branch since it diverged from `main`:

```bash
BASE=$(git describe --tags --abbrev=0)
BASE_VERSION=$(echo $BASE | sed 's/^v//')
COMMIT_COUNT=$(git rev-list --count HEAD ^$(git merge-base HEAD main))
echo "${BASE_VERSION}-dev.${COMMIT_COUNT}"
```

Example: base tag `v0.24.0`, 3 commits on branch → `"version": "0.24.0-dev.3"`

This produces a DMG named `Workflow Hub-0.24.0-dev.3-arm64.dmg`, which is unambiguous and sortable.

## When to sync `package.json`

Update `package.json` version:

- **Before running `npm run dist`** — always derive and write the correct version first.
- **As part of release automation** — `release.yml` / `finalize-release.sh` must update `package.json` alongside `project-meta.yaml` and `CHANGELOG.md`.

## Helper command

To sync `package.json` to the correct version for the current branch before building:

```bash
BASE_VERSION=$(git describe --tags --abbrev=0 | sed 's/^v//')
BRANCH=$(git branch --show-current)
if [ "$BRANCH" = "main" ]; then
  VERSION="$BASE_VERSION"
else
  COUNT=$(git rev-list --count HEAD ^$(git merge-base HEAD main))
  VERSION="${BASE_VERSION}-dev.${COUNT}"
fi
npm pkg set version="$VERSION"
echo "Set package.json version to $VERSION"
```

Run this before `npm run dist`. Do not commit the result on feature branches — it is a local build artifact. On `main`, commit it as part of the release automation.

## Why not use `build.artifactName` instead?

Overriding the artifact filename via `electron-builder` config is a workaround, not a fix. The version field in `package.json` is what Electron embeds in the running app (visible in About dialog, `app.getVersion()`, crash reports). The filename is a consequence — fix the source.
