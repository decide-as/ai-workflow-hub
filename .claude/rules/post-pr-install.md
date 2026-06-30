# Post-PR Install

After a PR is merged to `main` and CI is confirmed green, run:

```bash
make install-app
```

This builds the Electron app (`npm run dist`) and copies the resulting `.app`
bundle from `dist/mac-arm64/` to `/Applications/`, replacing the previous
installed version.

## When to run

- Immediately after `make install-app` is the last step of every `/pr` workflow
  that targets `main`.
- Also run manually any time you want to test the installed build after merging.

## What it does

1. `npm run dist` — builds and packages the app into `dist/mac-arm64/Workflow Hub.app`.
2. `cp -r` — overwrites `/Applications/Workflow Hub.app` with the new build.
3. Prints the installed version string to confirm success.

## If the build fails

Fix the build error before reporting the PR complete. A merged PR without a
working installed build is incomplete.
