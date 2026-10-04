---
name: pstack-principle-guard-the-context-window
description: "Apply when context is filling up: large outputs, long files, repeated reads, fan-out planning. Route bulk to subagents; keep summaries in the main thread, not raw payloads."
disable-model-invocation: true
---

# pstack-principle-guard-the-context-window

The user explicitly selected the principle-guard-the-context-window workflow. Read [the pstack entrypoint](../../SKILL.md), then [the principle-guard-the-context-window instructions](../../references/upstream/principle-guard-the-context-window/SKILL.md), including their linked execution contract and applicable references. Execute this workflow within the user's requested scope. Repository scope, approval rules, and any assigned leaf role still apply.
