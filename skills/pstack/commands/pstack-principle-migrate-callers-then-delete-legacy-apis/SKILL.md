---
name: pstack-principle-migrate-callers-then-delete-legacy-apis
description: "Apply when introducing a new internal API while old callers still exist. Migrate callers and delete the old API in the same wave instead of preserving compatibility layers."
disable-model-invocation: true
---

# pstack-principle-migrate-callers-then-delete-legacy-apis

The user explicitly selected the principle-migrate-callers-then-delete-legacy-apis workflow. Read [the pstack entrypoint](../../SKILL.md), then [the principle-migrate-callers-then-delete-legacy-apis instructions](../../references/upstream/principle-migrate-callers-then-delete-legacy-apis/SKILL.md), including their linked execution contract and applicable references. Execute this workflow for the user's request, even when the session's ordinary routing would not select it. This invocation does not change the session level or saved default. Repository scope, approval rules, and any assigned leaf role still apply.
