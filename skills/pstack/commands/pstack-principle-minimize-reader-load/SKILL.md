---
name: pstack-principle-minimize-reader-load
description: "Apply when reviewing or shaping code that's hard to trace. Count layers between question and answer, and hidden state in the reader's head; collapse one-caller wrappers and shrink mutable scope."
disable-model-invocation: true
---

# pstack-principle-minimize-reader-load

The user explicitly selected the principle-minimize-reader-load workflow. Read [the pstack entrypoint](../../SKILL.md), then [the principle-minimize-reader-load instructions](../../references/upstream/principle-minimize-reader-load/SKILL.md), including their linked execution contract and applicable references. Execute this workflow for the user's request, even when the session's ordinary routing would not select it. This invocation does not change the session level or saved default. Repository scope, approval rules, and any assigned leaf role still apply.
