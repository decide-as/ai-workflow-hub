# Workflow Registry Rules

Every entry in `registry/workflows.yaml` must include all required fields before being committed.

## Required fields

| Field | Type | Notes |
|---|---|---|
| `id` | UUID string | Generate with `python3 -c "import uuid; print(uuid.uuid4())"` |
| `name` | string | Short human-readable name |
| `summary` | string | One-line description shown on the card |
| `description` | string | Full description shown in the modal |
| `tags` | list of strings | At least 2 tags; lowercase, hyphenated |
| `repo_path` | string | Absolute path or relative to app root |
| `color` | hex string | Card accent color, e.g. `"#f97316"` |
| `icon` | string | Lucide icon name registered in `src/renderer/src/lib/icons.tsx` |
| `cluster_id` | string | Must match an entry in the `clusters` list |
| `added` | `"YYYY-MM-DD"` | Date first registered (derive with `date +%Y-%m-%d`) |
| `updated` | `"YYYY-MM-DD"` | Date last modified (derive with `date +%Y-%m-%d`) |
| `status` | `active` \| `inactive` \| `draft` | |
| `trigger_type` | `manual` \| `scheduled` \| `webhook` \| `event` | |
| `complexity` | `simple` \| `moderate` \| `complex` | |
| `version` | `"M.m.p"` | Semver string, start at `"0.1.0"` |
| `owner` | string | Full name and email, e.g. `Christian Braathen — christian@decide.as` |
| `inputs` | list | At least one entry, or an explicit empty list `[]` with a comment if the action provides its own UI |
| `outputs` | list | At least one entry describing what the workflow produces |

## Required `inputs` / `outputs` entry structure

```yaml
inputs:
  - name: snake_case_name
    type: string | number | boolean | file | date
    description: What this input is for
    required: true | false
    example: "example value"

outputs:
  - name: snake_case_name
    type: file | json | text | email | pdf
    description: What this output is
```

## Clusters

Every `cluster_id` used in a workflow must appear in the `clusters` list at the bottom of the file. When adding a workflow to a new cluster, add the cluster entry too.

## `updated` is the version shown in the modal

The modal always displays `updated` as the workflow's version number — "Updated DD Mon YYYY" in the header subtitle. This is the canonical version that users see.

**Always keep `updated` current.** Set it to today's date (run `date +%Y-%m-%d`) any time the workflow's `description`, `action`, `inputs`, `outputs`, `color`, `icon`, or operational fields change. Do not update it for registry-internal changes like tag additions.

## Checklist before committing a new or modified workflow entry

- [ ] All required fields present
- [ ] `cluster_id` exists in the clusters list
- [ ] Icon name is registered in `src/renderer/src/lib/icons.tsx`
- [ ] `added` and `updated` are real dates derived from `date +%Y-%m-%d`
- [ ] `inputs` and `outputs` are both present (even if empty list for inputs on action-driven cards)
- [ ] Version bumped if outputs or behavior changed
