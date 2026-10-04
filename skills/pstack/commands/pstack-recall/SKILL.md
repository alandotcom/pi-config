---
name: pstack-recall
description: Rebuild the current thread's working context and verify its artifacts.
disable-model-invocation: true
---

# pstack-recall

The user explicitly selected the recall workflow. Read [the pstack entrypoint](../../SKILL.md), then [the recall instructions](../../references/upstream/recall/SKILL.md), including their linked execution contract and applicable references. Execute this workflow for the user's request, even when the session's ordinary routing would not select it. This invocation does not change the session level or saved default. Repository scope, approval rules, and any assigned leaf role still apply.
