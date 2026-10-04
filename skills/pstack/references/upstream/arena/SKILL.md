---
name: arena
description: "Spawn N parallel candidates at the same task, pick a base, graft the strongest parts of the losers into it. Use for /arena, 'arena this', 'throw it in the arena', or when one attempt at a non-trivial artifact would lock in the wrong shape."
disable-model-invocation: true
---

# Arena

Read [the Pi execution contract](../../pi-runtime.md) before following this reference. The user's scope and assigned parent or leaf role determine which steps you own.

Fan out N parallel attempts at the same task. Read every candidate end to end. Pick the strongest as the base. Graft the best ideas from the others into it. Verify the synthesized result.

## Start

Use pstack_tasks to open a checklist with one entry per phase before launching anything.

1. Frame
2. Fan out
3. Cross-judge
4. Pick
5. Graft
6. Verify

## Phase A: Frame

The N candidates will receive the same prompt, so the prompt is the contract.

1. State the artifact each candidate is producing.
2. Derive the rubric. State what success looks like for *this* task, then turn it into 3-6 concrete gradeable criteria. The rubric is the picker's tool in Phase D. Candidates only see the task.
3. Pick at least two structurally distinct candidate directions. Select the configured arena runners, or three available models when possible, under the Pi execution contract. Use general-purpose agent with the bundled reviewer brief for read-only designs and general-purpose agent with the bundled worker brief for implementation experiments. Missing model diversity must be reported, never disguised as independent models.
4. Read-only design candidates return their complete artifact and rationale through Agent results. The parent may persist those results in an authorized artifact. Assign separate output paths or isolated worktrees only to writable implementation experiments, per the **separate-before-serializing-shared-state** principle skill.

## Phase B: Fan out

Spawn independent candidates in one message with `run_in_background: true`, staging seats within the host concurrency budget. Each receives the task, shared grounding, distinct direction, and instructions to return the complete artifact and rationale. Only writable experiments receive an output path.

Each rationale names the alternatives the candidate considered and what it rejected.

A failed seat is a reported gap. Replace or correct the failed seat before continuing when fewer than two structurally distinct designs remain. The workflow requires two distinct designs and an independent cross-judge; a dropout cannot waive either gate.

## Phase C: Cross-judge

After all candidates finish, launch one read-only general-purpose agent with the bundled reviewer brief cross-judge. Use the configured cross-judge pool or an available model different from the parent when possible. The judge sees the rubric and completed candidates, scores each criterion, and recommends a base. The parent reads all candidates independently while the judge runs. Don't spawn the judge while candidates are still writing.

## Phase D: Pick a base

Read every candidate end to end before picking.

Score each candidate against the rubric criterion by criterion, not on holistic feel. Compare against the cross-judge. Agreement on the base confirms the pick. Disagreement means one of you is biased or the rubric was ambiguous. Read both rationales before deciding.

Pick the base on which candidate a future maintainer can extend most easily without breaking invariants. Prefer the cleaner boundary or smaller API when two feel tied, per the Laziness Protocol.

Record the pick and the reason in a short synthesis note alongside the base artifact, including the cross-judge's verdict.

## Phase E: Graft

Walk each losing candidate once more and identify what is worth porting into the base. The signal is usually one or two things per candidate, not most of it.

Fold each graft in by hand, per the **redesign-from-first-principles** principle skill. Don't paste mechanically. The result has to remain coherent under one mental model.

Record what was grafted, from which candidate, and what was rejected and why.

When N candidates converge on the same shape, that is a strong agreement signal. Note the convergence in the record and ship the consensus shape. No graft is needed. When N candidates wildly diverge, Phase A was under-specified. Reframe and re-run rather than averaging the divergence.

## Phase F: Verify

The synthesized artifact has to hold up under the same scrutiny as any other output, per the **prove-it-works** principle skill.

If verification surfaces a problem the arena did not catch, either Phase A was wrong (re-frame and re-run) or one candidate caught it and you missed the graft (go back to Phase E). Don't paper over.

## Outputs

One synthesized artifact. One short synthesis note alongside, naming the base, the grafts (with source candidate), the rejections, the dropouts if any, and the verification result.
