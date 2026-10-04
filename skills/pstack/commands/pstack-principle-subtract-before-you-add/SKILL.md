---
name: pstack-principle-subtract-before-you-add
description: "Apply when sequencing an addition, refactor, or rewrite. Remove dead code, redundant validators, and stub references first, then build on the simpler base."
disable-model-invocation: true
---

# pstack-principle-subtract-before-you-add

The user explicitly selected the principle-subtract-before-you-add workflow. Read [the pstack entrypoint](../../SKILL.md), then [the principle-subtract-before-you-add instructions](../../references/upstream/principle-subtract-before-you-add/SKILL.md), including their linked execution contract and applicable references. Execute this workflow for the user's request, even when the session's ordinary routing would not select it. This invocation does not change the session level or saved default. Repository scope, approval rules, and any assigned leaf role still apply.
