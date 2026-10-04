---
name: pstack-principle-make-operations-idempotent
description: "Apply when designing commands, lifecycle steps, or processing loops that run amid crashes, restarts, and retries. Converge to the same end state regardless of partial prior runs."
disable-model-invocation: true
---

# pstack-principle-make-operations-idempotent

The user explicitly selected the principle-make-operations-idempotent workflow. Read [the pstack entrypoint](../../SKILL.md), then [the principle-make-operations-idempotent instructions](../../references/upstream/principle-make-operations-idempotent/SKILL.md), including their linked execution contract and applicable references. Execute this workflow for the user's request, even when the session's ordinary routing would not select it. This invocation does not change the session level or saved default. Repository scope, approval rules, and any assigned leaf role still apply.
