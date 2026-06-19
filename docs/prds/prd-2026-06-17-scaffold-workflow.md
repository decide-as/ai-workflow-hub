---
id: prd-2026-06-17-scaffold-workflow
title: Scaffold Workflow — Remote Repo Clone, Branch Pick, Claude-Driven Scaffolding
owner: Christian Braathen
created: 2026-06-17
updated: 2026-06-17
status: draft
priority: P1
branch: 2026-06-17/feat/scaffold-workflow
related_docs: []
---

# Scaffold Workflow Action

## Problem

Workflow Hub can open an existing local repo in Claude or run a bundled script,
but it has no way to drive work that lives in a *separate, remote repo* — one it
doesn't own. The specific pain: scaffolding a new project via `code_practices`
requires cloning the right branch manually, writing a YAML answers file by hand,
and running the CLI — steps that should be a single click from the UI.

## Context

`code_practices` (`/Users/christianbraathen/Repositories/code_practices`) has a
CLI command `cp create --from-answers <yaml>` that scaffolds a complete project
from a minimal YAML instead of an interactive questionnaire. Workflow Hub currently
supports two action types: `claude` (opens terminal in a local repo) and `run`
(executes a bundled script). Neither can clone an external repo, select a branch,
or pass user intent to a Claude session.

## Goals

- Allow a workflow card to reference an external git repo (local path or remote URL)
  instead of a bundled path.
- Let the user pick which branch to work from, with choices populated live from
  the repo.
- Let the user type a plain-language description of what they want to build,
  directly in the workflow modal.
- Open a Claude terminal session in the cloned repo, pre-seeded with a prompt
  that instructs Claude to generate the `answers.yaml` and run `cp create
  --from-answers answers.yaml` on the user's behalf.
- Log all scaffold (and other) workflow invocations to `workflow-hub-data`.

## Non-Goals

- Supporting arbitrary CI/CD pipelines or multi-step orchestration beyond clone →
  branch → open-claude.
- Managing the lifecycle of cloned repos (updates, deletion, version pinning).
- Supporting non-git sources.
- Building a general remote-execution layer.

## Scope

### In Scope

- New `action: scaffold` workflow type with a `scaffold_config` block.
- Branch picker: list branches from a local repo (or remote via `git ls-remote`).
- Description textarea in the workflow modal for `scaffold` actions.
- Clone/pull the repo to `~/.workflow-hub/cache/<workflow-id>/` on first use.
- Compose initial Claude prompt from description and `initial_prompt_template`.
- Open Claude in the cloned+checked-out repo via the existing osascript path.
- Activity log: write a JSONL entry to `workflow-hub-data/activity-log/YYYY-MM.jsonl`
  on every scaffold (and eventually all workflow opens).
- New IPC channels: `LIST_BRANCHES`, `SCAFFOLD_WORKFLOW`, `WRITE_ACTIVITY_LOG`.
- Working `code_practices` scaffold workflow card in `registry/workflows.yaml`.

### Out of Scope

- Automatic cache invalidation or repo updates after initial clone.
- Authentication for private remote repos.
- Progress UI for the clone step beyond a loading indicator.
- Editing the registry YAML from within Electron UI.

## Success Criteria

1. A workflow card with `action: scaffold` shows a "Scaffold" button instead of
   "Open in Claude".
2. Clicking "Scaffold" reveals a branch picker (populated from the configured repo)
   and a description textarea.
3. The hub clones (or fast-forwards) the repo to a local cache, checks out the
   selected branch, and opens a Claude terminal session pre-seeded with the prompt.
4. A JSONL activity log entry is written to `workflow-hub-data/activity-log/`
   on each scaffold invocation.
5. A working `code_practices` scaffold workflow card exists in `registry/workflows.yaml`.
6. No existing `claude` or `run` workflows are broken.

## Affected Modules

| Module | Impact |
|---|---|
| `shared/types.ts` | Add `ScaffoldConfig`, `BranchListResult`, update `WorkflowAction` |
| `shared/ipc-channels.ts` | Add `LIST_BRANCHES`, `SCAFFOLD_WORKFLOW`, `WRITE_ACTIVITY_LOG` |
| `src/main/index.ts` | Register three new IPC handlers |
| `src/main/scaffolder.ts` | New — clone, fetch, checkout, compose prompt, call openInTerminal |
| `src/main/terminal.ts` | Extend openInTerminal to accept optional initialPrompt |
| `src/main/logger.ts` | New — write activity log entries to workflow-hub-data |
| `src/preload/index.ts` | Expose new IPC calls to renderer |
| `src/renderer/src/components/WorkflowModal.tsx` | Add scaffold UI branch |
| `src/renderer/src/App.tsx` | Wire up new IPC calls and modal state |
| `registry/workflows.yaml` | Add code_practices scaffold workflow entry |

## Open Questions

- **Q:** Should branch listing always re-run `git ls-remote` on each modal open,
  or cache the branch list for a short TTL?
  **Recommendation:** Re-run each time. Branch lists are small and fast for local
  repos; stale branch data causes user confusion.

- **Q:** Should the cloned repo be placed in `~/.workflow-hub/cache/<workflow-id>/`
  (persistent, re-used) or a temp dir?
  **Recommendation:** Persistent cache — the scaffold command needs the full repo
  present while Claude is running the CLI.
