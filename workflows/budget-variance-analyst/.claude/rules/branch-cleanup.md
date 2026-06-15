# Branch Cleanup Rules

## After a PR merge

1. Remove worktree permissions: `bash .claude/scripts/cleanup-worktree-permissions.sh ../<repo>-<branch-name>`.
2. Delete both the **local** branch and the **remote** branch (`git push origin --delete <branch>`). Remote branches are restorable via GitHub's "Restore branch" button on the merged PR page.

## When explicitly asked to clean up branches

1. Delete local branches the user explicitly mentions.
2. Also delete any other local branches already merged via a PR.
3. Delete the corresponding remote branches for all of the above: `git push origin --delete <branch>`.
4. Never delete unmerged branches.

## Protected branches

Never delete these branches, even during cleanup:

- `master` / `main`
- `develop` (standard and full tiers)
- `staging` (full tier)
- `release/*` branches with unreleased patches

## Release branch cleanup

Release branches (`release/X.Y`) should be deleted when:

- The release is fully end-of-life (no more patches expected).
- A newer release branch supersedes it and backports are no longer needed.
- The user explicitly requests it.

Before deleting a release branch, confirm with the user — release branches cannot be trivially recreated.
