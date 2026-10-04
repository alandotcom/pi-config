---
name: pstack
description: "Run the Pi-adapted pstack workflow. Use when the active pstack level calls for deliberate investigation, design exploration, delegated implementation, independent review, or when the user asks for pstack."
---

# Pstack for Pi

Use the effective level in the session's `pstack` prompt section. An absent section means ordinary off-mode work unless the user explicitly selected a workflow. Off is the built-in default; saved preferences remain effective. `/poteto-mode` enables full for the current session; `/poteto-mode focused` enables focused. `/pstack full`, `/pstack focused`, and `/pstack off` also change the current session. `/pstack save <level>` changes the user default. `/pstack status` reports the current level and prerequisites; `/pstack` displays the complete checklist. A level controls engineering process; it grants no additional authority.

Read [the Pi execution contract](references/pi-runtime.md) before following an upstream reference. Read the matching playbook and each principle that changes a decision. The adapted [Poteto Mode](references/upstream/poteto-mode/SKILL.md) indexes those principles and playbooks. Resolve names such as `architect`, `how`, and `tdd` within `references/upstream/<name>/SKILL.md`; use these files directly, rather than a similarly named installed skill. Read a linked reference relative to its containing file. Namespaced `pstack-…` command skills expose each workflow in Pi's command picker. Their instructions point to these same references.

## Full

Apply the original task-matched playbook to meaningful work. Casual conversation, a short status reply, and a simple factual lookup do not start a new playbook.

1. Ground the affected system through `how`; use `why` when motivation or ownership matters. Reuse verified grounding already produced in this task.
2. Start `pstack_tasks` with the playbook's steps. Mark an inapplicable step skipped with its reason. Keep the four throughput checkpoint items for multi-step implementation: blocking first steps, independent workstreams, shared mutable state, and smallest safe decomposition.
3. Name the data shape and organizing structure before logic. For code crossing a function boundary, run `architect` with at least two structurally distinct candidates, an independent cross-judge, and a recorded synthesis.
4. Delegate Feature implementation to one `general-purpose` agent with the bundled worker brief with a precise file scope and completion criteria. Use separate worktrees for competing writers. A leaf worker owns its assigned implementation directly; the coordinator owns design and independent review. Mechanical local integration corrections remain the coordinator's responsibility.
5. Review code independently before completion. Use the repository's required review workflow. Use `interrogate` for contested design or an explicit adversarial-review request; additional pstack review does not replace repository-required lanes.
6. Verify behavior at the real boundary. Record failures and missing prerequisites as open work, never as a pass. Keep a decision trail for long, autonomous, or multi-phase work. Name only the principles whose full reference was read and whose rule changed a concrete choice.
7. Prepare commits or PRs only within the user's authorization and the repository's branch and release rules. A playbook's shipping step is a preparation gate when publication is not authorized.

Full requires TintinWeb's `Agent` tool with `general-purpose` available. Worker and reviewer instructions ship as references inside this package and are included in each task prompt. No profile installer or separate agent definitions are required. If delegation is unavailable, name the missing prerequisite and stop that step rather than silently reducing the level.

## Focused

Keep the scope, data shape, ownership, checklist for multi-step work, real behavior verification, and independent code review. Implement locally when one owner is sufficient. Add competing designs, delegated implementation, and multi-model review when a stated risk or explicit user request justifies them. Report the reason for extra exploration. Read the applicable principle when its rule changes a choice. Long or multi-phase work still needs a decision trail.

Focused preserves mandatory repository checks and review lanes. It reduces optional exploration and fan-out; it does not reduce security, correctness, or authorization gates.

## Off

Use the ordinary project workflow without pstack-added process. Existing skills, explicit user requests, security rules, tests, and required reviews still apply. The checklist remains available for unfinished work. Changing levels does not cancel children or release their write scopes. Finish or explicitly hand off work already assigned.

## Leaf assignments

A `general-purpose` agent receives the complete bundled worker or reviewer brief, reads this entrypoint and the relevant reference, then performs the bounded assignment. The leaf receives the parent's effective level and already-completed design gates in its brief. It has no nested delegation permission. It returns evidence and unresolved uncertainty to the parent. A read-only assignment never becomes a Feature task merely because a defect was found.

## Direct reference requests

The user can select a visible command such as `/skill:pstack-architect the cache interface`, `/skill:pstack-interrogate this diff`, or `/skill:pstack-reflect`. Each command runs the named workflow even if its ordinary automatic trigger would not fire or the session is off. This explicit selection does not change the session level or saved default. The original router syntax, such as `/skill:pstack architect the cache interface`, also works. Automatic full/focused routing continues to use the same reference instructions.

## Provenance

Adapted from Lauren Tan's [Cursor pstack](https://github.com/cursor/plugins/tree/9511e60321f7e533a187d62854a3d53a53752874/pstack), version 0.15.7, under MIT. [Attribution and update procedure](../../docs/third-party/pstack.md) record the source, adaptation boundary, and unsupported platform features.
