---
name: setup-pstack
description: Configure available Pi models for pstack roles.
disable-model-invocation: true
---

# Setup pstack

Read [the Pi execution contract](../../pi-runtime.md). Configure model choices separately from workflow intensity. Full can run on inexpensive models; focused can use the strongest available model.

1. Discover the host's enabled and authenticated `provider/modelId` choices. Use the registry or `pi --list-models` for catalogue evidence and verify authentication without printing credentials. A listed model is not proof of authentication. Accept `inherit-parent` and `auto` as inheritance choices.
2. Read `<agent-dir>/configs/pstack.json` if it exists. Preserve its defaultLevel and unrelated keys. Malformed JSON is a blocker; never overwrite it to recover silently.
3. Ask which roles or reasoning budgets the user wants changed. Scalar roles include `feature, refactoring`, `bug-fix`, `perf-issue`, `hillclimb`, `judgment and prose`, `hardest tasks`, `how explorer`, `how explainer`, `why investigators`, `why synthesizer`, `reflect tooling`, `reflect judgment, divergent, synthesizer`, and `swarm workers`. Panel roles are `architect runners`, `arena runners`, `arena cross-judge pool`, and `interrogate reviewers`.
4. Record scalar choices as a model string and panel choices as arrays under `models`. Optional `thinking` is a supported Pi thinking level, independent of the model ID. Every panel seat counts even when it inherits the parent. Full requires at least two distinct designs; panel configuration cannot waive that gate.
5. Show the proposed configuration and obtain authorization for the preference change. Back up an existing file, preserve unrelated JSON, and write the agreed choices. Unconfigured scalar roles inherit the parent. Unconfigured panels use three distinct available models when possible. Never copy Cursor model defaults or invent fallback slugs.
6. Report the saved path and which roles changed. Keep existing Explore, Advisor, Research, and review frontmatter model pins. Pstack uses the bundled role briefs with general-purpose rather than installing pinned agents. Respect any user-defined general-purpose override; report a model pin that prevents the requested per-call choice.

Example shape, with inheritance rather than provider-specific defaults:

```json
{
  "defaultLevel": "full",
  "models": {
    "feature, refactoring": "inherit-parent",
    "architect runners": ["inherit-parent", "inherit-parent"],
    "interrogate reviewers": ["inherit-parent", "inherit-parent", "inherit-parent"]
  },
  "thinking": "high"
}
```

The model map is read by the agent when dispatching, not enforced by a second runtime router. Report that distinction. `/pstack save <level>` changes the saved intensity without replacing this model map.
