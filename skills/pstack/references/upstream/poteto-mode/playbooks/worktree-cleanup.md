### Worktree and simulator cleanup

Read the Pi execution contract. Reclaim only resources whose removal the operator has authorized. A cleanliness or disk-space request is not permission to discard stored work.

1. Inventory disk usage and git worktree list output. Use those exact paths rather than guessed directory names. Inspect each candidate's branch, uncommitted changes, untracked files, merge state, and known ownership.
2. Classify safe candidates, uncertain candidates, and active work. A merged branch does not prove an untracked file or dirty worktree is disposable. Report each uncertain case.
3. Show the proposed removals and obtain the required approval. Preserve active branches, unrelated files, and user-retained caches. Use Git's supported worktree removal/prune operations rather than recursive deletion of guessed paths.
4. For simulator or cache cleanup, inventory the actual installed tool and resource state. Confirm which data is reproducible and which is user data before deletion. Use the tool's supported operation within the operator's grant.
5. Verify the removed resources and recovered space. Report preserved uncertain items and blockers. This port does not include the original Cursor transcript-scanning worktree helper.

**Reply:** authorized removals, recovered space, preserved work, verification, and unresolved items.
