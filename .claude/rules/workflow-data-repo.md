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

## Routing output for scaffold/external-repo workflows

When a workflow uses `action: scaffold` (or otherwise opens Claude in an
external repo), route the external tool's output directly to `workflow-hub-data/<slug>/data/`
using the tool's output directory flag. This keeps all workflow data in one place
without symlinks:

```bash
# Preferred: pass --output-dir directly to the tool
scrapers "<url>" --output-dir /Users/christianbraathen/Repositories/workflow-hub-data/<slug>/data

# Fallback (if the tool has no output-dir flag): symlink the output dir
ln -s /path/to/external-repo/outputs \
      /Users/christianbraathen/Repositories/workflow-hub-data/<slug>/data/outputs
```

Embed the `--output-dir` path in the workflow's `initial_prompt_template` so
Claude runs the tool with the correct destination automatically. Document the
routing approach in the folder's `README.md`.

## Checklist when registering a new workflow

- [ ] `workflow-hub-data/<slug>/` folder exists and is committed
- [ ] `workflow-hub-data/<slug>/data/.gitkeep` is present (or real subdirs if layout is known)
- [ ] `workflow-hub-data/<slug>/README.md` describes what data is stored and where
- [ ] For scaffold/external workflows: `--output-dir` routing embedded in `initial_prompt_template`, or symlink added as fallback
- [ ] `workflow-hub-data` commit is referenced in the PR description
