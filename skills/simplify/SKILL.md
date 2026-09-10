---
name: simplify
description: Review changed code for reuse, quality, and efficiency, then fix any issues found. Use when asked to simplify or clean up recent changes.
---

# Simplify: Code Review and Cleanup

Review all changed files for reuse, quality, and efficiency. Fix any issues found.

Adapted from Claude Code's bundled `/simplify` prompt, published at https://ccprompts.info/prompts/service/service-bundled-skill-simplify. Pi adaptations cover agent dispatch, preservation of existing work, and verification. This is a snapshot, not an automatically synced copy.

## Phase 1: Identify Changes

Run `git diff` (or `git diff HEAD` if there are staged changes) to see what changed. Check `git status --short` for untracked files belonging to the task and include their contents in the review. If there are no git changes, review the most recently modified files that the user mentioned or that you edited earlier in this conversation. If no scope can be established, ask the user which files to review.

Respect any additional focus supplied with the invocation. Preserve unrelated user changes.

## Phase 2: Launch Three Review Agents in Parallel

Use Pi's `subagent` tool in parallel mode to launch three read-only reviews with the distinct assignments below. Select available review-capable agent names; the same agent definition may be used for separate tasks. Pass each agent the full diff, relevant untracked contents, repository path, and scope. Ask for actionable findings with file locations and suggested fixes. Agents must not edit files.

While reviews run, inspect the project's verification commands and relevant tests. The primary agent owns integration and fixes. If the subagent tool or suitable agents are unavailable, report the limitation and perform the three review passes locally.

### Agent 1: Code Reuse Review

For each change:

1. **Search for existing utilities and helpers** that could replace newly written code. Look for similar patterns elsewhere in the codebase, especially utility directories, shared modules, and files adjacent to the changed ones.
2. **Flag any new function that duplicates existing functionality.** Suggest the existing function to use instead.
3. **Flag any inline logic that could use an existing utility.** Hand-rolled string manipulation, manual path handling, custom environment checks, and ad-hoc type guards are common candidates.

### Agent 2: Code Quality Review

Review the same changes for hacky patterns:

1. **Redundant state:** state that duplicates existing state, cached values that could be derived, observers/effects that could be direct calls.
2. **Parameter sprawl:** adding new parameters to a function instead of generalizing or restructuring existing ones.
3. **Copy-paste with slight variation:** near-duplicate code blocks that should be unified with a shared abstraction.
4. **Leaky abstractions:** exposing internal details that should be encapsulated, or breaking existing abstraction boundaries.
5. **Stringly-typed code:** using raw strings where constants, enums (string unions), or branded types already exist in the codebase.
6. **Unnecessary JSX nesting:** wrapper Boxes/elements that add no layout value. Check if inner component props (`flexShrink`, `alignItems`, etc.) already provide the needed behavior.
7. **Unnecessary comments:** comments explaining WHAT the code does when well-named identifiers already do that, narrating the change, or referencing the task/caller. Keep non-obvious WHY: hidden constraints, subtle invariants, and workarounds.

### Agent 3: Efficiency Review

Review the same changes for efficiency:

1. **Unnecessary work:** redundant computations, repeated file reads, duplicate network/API calls, N+1 patterns.
2. **Missed concurrency:** independent operations run sequentially when they could run in parallel.
3. **Hot-path bloat:** new blocking work added to startup or per-request/per-render hot paths.
4. **Recurring no-op updates:** state/store updates inside polling loops, intervals, or event handlers that fire unconditionally. Add a change-detection guard so downstream consumers aren't notified when nothing changed. If a wrapper function takes an updater/reducer callback, verify it honors same-reference returns or the applicable "no change" signal; otherwise callers' early-return no-ops are silently defeated.
5. **Unnecessary existence checks:** pre-checking file/resource existence before operating (TOCTOU anti-pattern). Operate directly and handle the error.
6. **Memory:** unbounded data structures, missing cleanup, event listener leaks.
7. **Overly broad operations:** reading entire files when only a portion is needed, loading all items when filtering for one.

## Phase 3: Fix Issues

Wait for all three reviews to complete. Aggregate their findings, verify each against the code, and fix actionable issues directly while preserving behavior. If a finding is a false positive or not worth addressing, note it and move on.

Run relevant tests and checks for the affected code. Inspect the final diff for unintended changes. Briefly summarize what was fixed, verification results or limitations, and the delegation used. If no fixes were needed, confirm the reviewed code was already clean.
