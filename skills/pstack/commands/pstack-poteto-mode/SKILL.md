---
name: pstack-poteto-mode
description: poteto's agent style for concise, detailed responses, deliberate subagents, unslopped prose, simple code, and verified work. Use for poteto, /poteto-mode, or requests to work in this style.
disable-model-invocation: true
---

# pstack-poteto-mode

The user explicitly selected the poteto-mode workflow. Read [the pstack entrypoint](../../SKILL.md), then [the poteto-mode instructions](../../references/upstream/poteto-mode/SKILL.md), including their linked execution contract and applicable references. Execute this workflow for the user's request, even when the session's ordinary routing would not select it. This invocation does not change the session level or saved default. Repository scope, approval rules, and any assigned leaf role still apply.
