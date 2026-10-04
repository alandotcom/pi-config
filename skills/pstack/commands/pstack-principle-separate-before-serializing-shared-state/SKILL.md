---
name: pstack-principle-separate-before-serializing-shared-state
description: "Apply when concurrent actors might write to the same file, branch, key, or state object. Eliminate the sharing first; serialize structurally only when one shared writer is a real invariant."
disable-model-invocation: true
---

# pstack-principle-separate-before-serializing-shared-state

The user explicitly selected the principle-separate-before-serializing-shared-state workflow. Read [the pstack entrypoint](../../SKILL.md), then [the principle-separate-before-serializing-shared-state instructions](../../references/upstream/principle-separate-before-serializing-shared-state/SKILL.md), including their linked execution contract and applicable references. Execute this workflow within the user's requested scope. Repository scope, approval rules, and any assigned leaf role still apply.
