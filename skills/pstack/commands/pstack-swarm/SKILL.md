---
name: pstack-swarm
description: "Fan out N parallel workers, drain them, and return one report. Use for /swarm, 'swarm this', or parallel coverage, races, gauntlets, and exploration."
disable-model-invocation: true
---

# pstack-swarm

The user explicitly selected the swarm workflow. Read [the pstack entrypoint](../../SKILL.md), then [the swarm instructions](../../references/upstream/swarm/SKILL.md), including their linked execution contract and applicable references. Execute this workflow for the user's request, even when the session's ordinary routing would not select it. This invocation does not change the session level or saved default. Repository scope, approval rules, and any assigned leaf role still apply.
