---
name: pstack-correct
description: "Find the mistakes agents keep repeating in this repo and make each one impossible. Try architecture first, then types, then a lint whose error names the fix, then a test, and write docs last. Prove each check fails on a real past mistake. Repeat this each time the operator corrects you. Use for /correct."
disable-model-invocation: true
---

# pstack-correct

The user explicitly selected the correct workflow. Read [the pstack entrypoint](../../SKILL.md), then [the correct instructions](../../references/upstream/correct/SKILL.md), including their linked execution contract and applicable references. Execute this workflow within the user's requested scope. Repository scope, approval rules, and any assigned leaf role still apply.
