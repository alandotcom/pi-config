---
name: pstack
description: "Route a pstack request to its workflow or principle. Use when the user asks for pstack, poteto-mode, or a named pstack workflow."
---

# Pstack for Pi

Pstack is a collection of engineering skills. Select a namespaced command such as
`/skill:pstack-architect the cache interface`, `/skill:pstack-correct`, or
`/skill:pstack-poteto-mode build this feature`. The router form
`/skill:pstack architect the cache interface` also works. There is no activation
command, session level, or saved workflow default.

Read [the Pi execution contract](references/pi-runtime.md) before following an
upstream reference. Resolve names such as `architect`, `how`, and `tdd` within
`references/upstream/<name>/SKILL.md`; use those files directly rather than a
similarly named installed skill. Read a linked reference relative to its
containing file. Namespaced command skills point to these same references.

## Select the workflow

An individual command runs its named workflow for the user's request. Follow its
linked skills and principles when their rules change a decision. Read each
applicable principle in full before citing it. The selected workflow determines
the investigation, design, delegation, and verification steps within the user's
scope. Ordinary work follows repository instructions and task-matched skills.

For Poteto Mode, read [its instructions](references/upstream/poteto-mode/SKILL.md)
and the task-matched playbook. Poteto Mode supplies the broader engineering
style and playbook routing through skill instructions in the conversation.
It does not toggle extension state or modify user preferences.

Use `pstack_tasks` for a playbook checklist. `/pstack` displays the complete
checklist on the active session branch. The checklist is independent of workflow
selection and remains available for unfinished work.

## Delegation and ownership

Workflows that delegate require TintinWeb's `Agent` with `general-purpose`
available. Include the complete bundled [worker brief](references/worker-brief.md)
or [reviewer brief](references/reviewer-brief.md), the exact assignment, file
scope, source evidence, and already-completed parent gates. The parent owns
requirements, synthesis, integration, independent review, and acceptance.
Missing tools or failed checks remain open work; report the missing prerequisite.

A delegated leaf performs its bounded assignment directly. It has no nested
delegation permission and never replays parent-level design or review fan-out.
Reading architect in a candidate assignment means applying its criteria to one
design. A read-only assignment stays read-only when a defect is found.

## Authority

A skill selects an engineering process within the user's grant. Preserve
repository scope, branch ownership, mandatory tests and reviews, production
protections, and external-action approval boundaries. A shipping step is a
preparation gate until publication is authorized. Invocation never grants
commits, PRs, deployments, or wider mutation by itself.

## Provenance

Adapted from Lauren Tan's [Cursor pstack](https://github.com/cursor/plugins/tree/e43c7ee26e0038c6c1fa8380dd34ce86ff94cb2a/pstack), version 0.15.9, under MIT. [Attribution and update procedure](../../docs/third-party/pstack.md) record the source, adaptation boundary, and unsupported platform features.
