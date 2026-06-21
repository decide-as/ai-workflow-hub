---
id: prd-2026-06-21-workflow-availability
title: Per-Machine Workflow Availability & Org Permissions
owner: Christian Braathen
created: 2026-06-21
updated: 2026-06-21
status: draft
priority: P1
related_docs:
  - docs/designs/design-2026-06-21-workflow-availability-phase1.md
  - docs/designs/design-2026-06-21-workflow-availability-phase2.md
---

# Per-Machine Workflow Availability & Org Permissions

## Problem

Every workflow in the registry is globally visible on every machine the app runs on. There is no way to restrict which workflows appear on a given computer, nor any model for controlling access when the app is used across a team. This means scheduled/always-on workflows clutter laptops, and the app has no foundation for multi-user deployment.

## Context

The registry is a single shared `workflows.yaml` consumed identically on all machines. `WorkflowStatus` (`active | inactive | draft`) is global — setting a workflow to `inactive` hides it everywhere. Electron's `userData` directory (`~/Library/Application Support/Workflow Hub/`) exists and is the natural home for per-machine state. There is currently no user identity, role, or policy model in the app.

## Goals

- Let each machine independently control which workflows are visible and runnable.
- Lay a forward-compatible foundation that an org-wide permission layer can extend.
- Keep the global registry untouched — availability is a local overlay, not a registry field.

## Non-Goals

- Syncing machine configs between computers.
- Authentication or identity management (phase 2).
- Hiding workflows from the registry file itself.

## Scope

### In Scope (Phase 1)

- A local machine config file listing workflow IDs and their enabled/disabled state.
- A machine nickname field shown in Settings.
- A Settings modal for toggling workflow availability per machine.
- Registry loading merges the global registry with the local machine config — disabled workflows are omitted from the renderer.
- Phase 2 type stubs in `shared/types.ts` (no runtime impact).

### Out of Scope

- Remote management of machine configs.
- User login, SSO, or identity provider integration.
- Fine-grained action-level permissions within phase 1.

## Success Criteria

1. User can open Settings and toggle any workflow on/off; the card grid updates immediately.
2. A workflow disabled on machine A still appears on machine B.
3. Machine config persists across app restarts.
4. Machine nickname is shown in Settings.
5. New workflows added to the registry appear on all machines by default (opt-out model).
6. Phase 2 type stubs compile cleanly with no runtime impact.

## Users and Stakeholders

- **Christian**: 2+ machines; wants scheduled workflows only on Mac Mini.
- **Future org members**: will need role-based access to workflow clusters.

## Requirements

### Functional

- System must read `userData/machine-config.json` at startup.
- System must create it with all workflows enabled if it does not exist (opt-out default).
- System must merge the machine config with the registry before serving the renderer.
- System must expose IPC handlers for get/set of machine config.
- System must watch the machine config file and push changes to the renderer.
- Settings modal must list all registered workflows with a toggle per workflow.
- Settings modal must allow setting a machine nickname.
- Disabling a workflow must remove its card without page reload.

### Non-Functional

- Machine config read/write under 50 ms.
- Filtered registry has the same Workflow shape — transparent to existing renderer code.

## Affected Modules

| Module | Impact |
|---|---|
| `shared/types.ts` | New `MachineConfig`, `MachineWorkflowEntry`, phase-2 stubs |
| `src/main/machine-config.ts` | New — read/write/watch machine config JSON |
| `src/main/registry.ts` | Merge with machine config before returning |
| `src/main/index.ts` | New IPC handlers + machine config watcher |
| `src/renderer/src/App.tsx` | Settings modal open/close state |
| `src/renderer/src/components/SettingsModal.tsx` | New — per-workflow toggles + nickname |

## Risks

- Opt-out default needs to flip to opt-in for org deployment (phase 2).
- Phase 2 types must remain inert at runtime in phase 1.

## Open Questions

- **Q:** Should org permissions require a server or a shared config file?
  **Recommendation:** Shared config file first. A server can be added when audit logs or real-time revocation are needed.

## Prioritization

**Profile:** solo_dev

| Bucket | Score |
|--------|-------|
| Value | 68 |
| Risk | 82 |
| Constraints | 74 |
| Energy | 61 |
| **Total** | **~71** |

**Interpretation:** High personal value with a clear two-machine use case today and a credible org-scale path. Risk is low — local JSON overlay is a well-understood Electron pattern.

**Top concern:** Energy bucket — the Settings UI and live-update wiring is the bulk of the effort and most likely source of scope creep.
