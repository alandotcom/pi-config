---
name: pstack-maintain-verification-skill
description: "Periodic pass that keeps a project's verification skill and feature map honest: parallel source readers per feature, one live session driving every feature, at most one PR of proven corrections. Use for /maintain-verification-skill or \"audit the verify skill\"."
disable-model-invocation: true
---

# pstack-maintain-verification-skill

The user explicitly selected the maintain-verification-skill workflow. Read [the pstack entrypoint](../../SKILL.md), then [the maintain-verification-skill instructions](../../references/upstream/maintain-verification-skill/SKILL.md), including their linked execution contract and applicable references. Execute this workflow for the user's request, even when the session's ordinary routing would not select it. This invocation does not change the session level or saved default. Repository scope, approval rules, and any assigned leaf role still apply.
