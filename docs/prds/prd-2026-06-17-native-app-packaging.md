---
id: prd-2026-06-17-native-app-packaging
title: Native macOS App Packaging via electron-builder
owner: Christian Braathen
created: 2026-06-17
updated: 2026-06-17
status: implemented
priority: P0
related_docs: []
---

# Native macOS App Packaging

## Problem

Workflow Hub can only run while a terminal is open. When the terminal session
closes, the app dies. It cannot be launched from Spotlight, Raycast, Alfred, or
the Dock, and cannot survive a reboot. For a productivity tool meant to stay
out of the way and always be available, this fundamentally breaks the use case.

## Context

The project already uses `electron-vite` for TypeScript compilation and
hot-reloading in dev. The compiled output lands in `out/`. What's missing is the
second step: packaging that `out/` directory into a self-contained macOS `.app`
bundle via `electron-builder`, then placing it in `/Applications`. This is
standard practice for Electron apps targeting personal macOS use.

## Goals

- Workflow Hub can be launched from Spotlight, Raycast, or the Dock like any
  native macOS app
- The app persists across terminal closures and reboots
- `make dist` produces a distributable `.app` and `.dmg` with no manual steps
  beyond dragging into `/Applications`
- The app has a proper icon (not the default Electron icon)

## Non-Goals

- Code signing and Apple notarization (not needed for personal use)
- Distribution to other users / Mac App Store
- Auto-update (Squirrel, electron-updater)
- Windows or Linux packaging
- CI/CD integration for releases — dist is a local manual step

## Scope

### In Scope

- `electron-builder` devDependency and `build` config block in `package.json`
- A `dist` npm script: `electron-vite build && CSC_IDENTITY_AUTO_DISCOVERY=false electron-builder --mac`
- `make dist` Makefile target wrapping the dist script
- macOS-specific app metadata: `appId`, `productName`, icon, targets (`dmg`, `zip`)
- App icon: `resources/icon.icns` plus source `resources/icon.png` (1024×1024)
- `.gitignore` update: add `dist/`

### Out of Scope

- Code signing, notarization, hardened runtime
- Windows/Linux targets
- Auto-update mechanism
- Login Items toggle (defer to follow-up — add to `/Applications` manually then
  use System Settings → General → Login Items)

## Success Criteria

1. `make dist` completes without errors and produces `dist/mac-arm64/` (or
   `dist/mac/` on Intel) containing `Workflow Hub.app` and `Workflow Hub.dmg`
2. The app launches from `/Applications/Workflow Hub.app` without a terminal
   open, showing the full UI
3. App icon is visible in Finder, Dock, and Spotlight (not the default Electron
   icon)
4. `npm run dev` continues to work unchanged for development

## Users and Stakeholders

Christian Braathen — sole user. Runs it daily as a workflow launcher on macOS.

## Requirements

### Functional

- System must compile TypeScript via `electron-vite build` before packaging
- System must package the compiled `out/` directory via `electron-builder --mac`
- System must target macOS `dmg` and `zip` output formats
- System must disable code-signing auto-discovery so unsigned personal builds
  succeed without a developer certificate
- System must include a proper app icon (`.icns`) in the built bundle
- System must set a stable `appId` of `as.decide.workflow-hub`

### Non-Functional

- `make dist` should complete in under 3 minutes on an M-series Mac
- The packaged `.app` must not bundle devDependencies

## Affected Modules

| Module | Impact |
|---|---|
| `package.json` | Add `electron-builder` devDep, `build` config, `dist` script |
| `Makefile` | Add `dist` target |
| `resources/icon.icns` | New — macOS app icon |
| `resources/icon.png` | New — 1024×1024 source icon |
| `.gitignore` | Add `dist/` |

## Dependencies

- `electron-builder` npm package (devDependency, v25+)
- macOS `sips` + `iconutil` CLI tools (built into macOS) for `.icns` generation
- Existing `electron-vite build` output in `out/` as the packaging source

## Risks

- `electron-vite` + `electron-builder` integration requires the `out/` path to
  be correctly picked up by electron-builder's `files` config
- Unsigned apps trigger a Gatekeeper prompt on first launch — right-click → Open
  is the workaround and is acceptable for personal use
- Icon generation requires a 1024×1024 PNG source; a placeholder is fine if no
  brand asset exists yet

## Assumptions

- Target platform is macOS Apple Silicon (arm64); Intel (x64) is secondary
- No Apple Developer certificate is available or needed
- The user is comfortable right-clicking to open an unsigned app once on first
  install

## Open Questions

None — scope is clear.
