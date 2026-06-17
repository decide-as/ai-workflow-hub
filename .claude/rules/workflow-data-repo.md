# Workflow Data Repository

All workflow runtime data lives in the `workflow-hub-data` repo at
`/Users/christianbraathen/Repositories/workflow-hub-data/`.

## Rule: every workflow needs a data folder

Every entry in `registry/workflows.yaml` must have a corresponding top-level
folder in `workflow-hub-data/` named after the workflow's slug (the kebab-case
form of its name). This applies even if the workflow produces no persistent
data — the folder acts as the canonical data home and must exist.

The folder must be created and committed to `workflow-hub-data` in the same
PR that registers the workflow.

## Deriving the slug

Use the workflow `name` field, lowercased and hyphenated:
- "Web Scraper" → `web-scraper`
- "Travel Reimbursement" → `travel-reimbursement`

## Folder structure

```
workflow-hub-data/
  <slug>/
    README.md          # what this workflow produces and where it writes
    data/              # runtime outputs (trips, batches, scrape results, etc.)
      .gitkeep         # keeps the folder in git when empty
```

Add a `profile.json`, `accounts.json`, or other config file alongside `data/`
only when the workflow needs persistent user-specific config.

## Data routing

All workflow outputs — reports, downloads, scraped content, ledger entries,
generated files — must be written to or symlinked from the workflow's `data/`
folder in `workflow-hub-data`. Do not leave outputs in:

- Temporary cache dirs (`~/.workflow-hub/cache/`)
- The primary `workflow-hub` repo
- The external repo being opened (unless that repo itself is the canonical store
  and its `outputs/` is symlinked from here)

## Symlinking for scaffold/external-repo workflows

When a workflow uses `action: scaffold` (or otherwise opens Claude in an
external repo), outputs land inside that repo's working directory. Symlink the
relevant output directory back into `workflow-hub-data/<slug>/data/` so all
workflow data is accessible from one place:

```bash
# Example: web-scraper → scrapers repo outputs
ln -s /path/to/external-repo/outputs \
      /Users/christianbraathen/Repositories/workflow-hub-data/<slug>/data/outputs
```

Add the symlink to `workflow-hub-data` (not to the primary repo). Record the
symlink target in the folder's `README.md`.

## Checklist when registering a new workflow

- [ ] `workflow-hub-data/<slug>/` folder exists and is committed
- [ ] `workflow-hub-data/<slug>/data/.gitkeep` is present
- [ ] `workflow-hub-data/<slug>/README.md` describes what data is stored and where
- [ ] For scaffold/external workflows: symlink from `data/` to the external output dir
- [ ] `workflow-hub-data` commit is referenced in the PR description
