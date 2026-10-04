---
name: pstack-blast-radius
description: "Find what a change could break somewhere else before it ships, beyond the diff, and prove the one fact it's safe because of by running real code instead of writing it up. Use for 'blast radius of X', 'what could this break', or reviewing a small diff you don't trust."
disable-model-invocation: true
---

# pstack-blast-radius

The user explicitly selected the blast-radius workflow. Read [the pstack entrypoint](../../SKILL.md), then [the blast-radius instructions](../../references/upstream/blast-radius/SKILL.md), including their linked execution contract and applicable references. Execute this workflow within the user's requested scope. Repository scope, approval rules, and any assigned leaf role still apply.
