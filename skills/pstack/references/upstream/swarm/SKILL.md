---
name: swarm
description: "Fan out N parallel workers, drain them, and return one report. Use for /swarm, 'swarm this', or parallel coverage, races, gauntlets, and exploration."
disable-model-invocation: true
---

# Swarm

Read [the Pi execution contract](../../pi-runtime.md) before following this reference. The user's scope and assigned parent or leaf role determine which steps you own.

Fan out N local workers. They may cover separate slices, race the same brief, or mix both. The parent waits, aggregates, and returns one report.

## Start

Use pstack_tasks to open a checklist with one entry per phase before launching anything.

1. Frame
2. Fan out
3. Aggregate
4. Report

## Phase A: Frame

1. State the done predicate and the artifact or report the swarm must return.
2. Choose the shape. Partition into slices, race N workers on identical briefs, or mix both. For a race or mixed shape, declare `first pass`, `rank all`, or `best-of` before spawning.
3. Set N from the user or derive it from the shape. N is total workers, not the active concurrency limit.
4. Select each worker's model under the Pi execution contract. Use the swarm workers role when configured; otherwise inherit the parent. Name comparison arms and their available models before launching.
5. Give each worker its own writable output when it writes. When workers verify or measure commits, each brief names the exact SHAs. A measurement brief also names the method (sample count, what one sample is, order). The worker records both in its result.

## Phase B: Fan out

Spawn workers through Agent with run_in_background: true. Use general-purpose agent with the bundled reviewer brief for read-only slices and general-purpose agent with the bundled worker brief for writing slices. Runs are local; concurrent writers use separate scopes or worktrees. Stage calls within the concurrency budget without dropping required slices. Use SubagentWorkflow only when explicitly authorized.

When a worker needs another source branch, verify the exact source HEAD and prepare an authorized checkout or worktree through the installed tooling before dispatch. Worktree isolation starts from the current committed input; it does not select a remote branch or copy uncommitted changes. Report a missing branch-selection capability before launching rather than passing an unsupported argument.

Every brief stands alone. Include the goal, scope, exact slice or race arm, how to verify, and what to report. Reports use `PASS`, `ISSUES`, or `BLOCKED` with evidence. A worker that can prove a defect reports `ISSUES` and lists every issue it can prove, not only the first.

If a worker drops out, proceed with N-1 and note it.

## Phase C: Aggregate

Read the terminal results. Drop a result that does not record the SHAs and method its brief names, and respawn that worker once. After a second miss, record a gap. A gap does not count as a pass. For coverage, every required slice needs a result. For a race, apply the selection rule declared up front. Use first pass, rank all, or best-of. Do not paste raw worker dumps.

Keep a compact result table, one-line evidenced issues, and explicit gaps or dropouts.

## Phase D: Report

Return one consolidated in-chat report with the table, issue one-liners, gaps or dropouts, and the race rule when used.
