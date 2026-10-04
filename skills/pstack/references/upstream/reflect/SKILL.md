---
name: reflect
description: Spawn three parallel review subagents over the active transcript, surface learnings, and route each to a concrete edit on an existing skill. Use when the user says reflect.
disable-model-invocation: true
---

# Reflect

Read [the Pi execution contract](../../pi-runtime.md) before following this reference. The user's scope and assigned parent or leaf role determine which steps you own.

Mine the current conversation for durable learnings, then route them into skill edits.

## When to invoke

Invoke when the user says "reflect" or "/reflect". Skip when the conversation is trivial, off-topic, or already covered by an existing skill the parent followed correctly. One-offs are not learnings.

## Process

### 1. Locate the active transcript

Pin this thread's known session file and authorized subagent output paths before fan-out. Use native recall first. Other transcripts require explicit user scope and accessible paths; do not scan unrelated sessions.
 Verify the supplied path belongs to this run through its session metadata. If no known path is available, pass a tight digest with selected recalled excerpts. Do not infer a transcript layout from another harness.

### 2. Spawn three reviewers in parallel

One message, three background Agent calls using general-purpose agent with the bundled reviewer brief. Assign tooling, judgment, and divergent lenses. Keep normal extensions for source lookups and require read-only work.

Select available models through the Pi execution contract. Read the matching role in the optional user configuration; an unconfigured role inherits the parent. Keep read-only research and synthesis on general-purpose agent with the bundled reviewer brief. Report unavailable choices instead of guessing another model.

| Lens | Role line | Default `model` | Prompt template |
|---|---|---|---|
| Judgment | `reflect judgment, divergent, synthesizer` | `inherit-parent` | `references/judgment-reviewer.md` |
| Tooling | `reflect tooling` | `inherit-parent` | `references/tooling-reviewer.md` |
| Divergent | `reflect judgment, divergent, synthesizer` | `inherit-parent` | `references/divergent-reviewer.md` |

Pass each template verbatim, substituting the transcript path or digest where marked. Reviewers return findings in the `Agent` response body.

### 3. Synthesize

One background general-purpose agent with the bundled reviewer brief synthesizes the completed evidence. Use the configured synthesis model or inherit the parent. Keep the assignment read-only and permit normal source lookup tools. Use `references/synthesizer.md` verbatim, with each reviewer's full output inlined where marked. The synthesizer returns a structured Accepted / Rejected / Backlog list.

### 4. Structural enforcement check

Sanity-check the synthesizer's Accepted list. For any item that would be enforced more reliably by a lint rule, script, metadata flag, or runtime check, move it from Accepted to Backlog. See the **encode-lessons-in-structure** principle skill.

### 5. Apply

Before applying any Accepted edit, present the synthesizer's full Accepted/Rejected/Backlog output to the user and wait for explicit approval. The user picks which subset to apply and may redirect routings. Skill changes affect every future agent in the org. Do not auto-apply.

File Backlog items only when the user authorizes those tracker writes. Otherwise return the proposed backlog alongside the Accepted list.

For each approved Accepted item, follow the Routing field exactly:

- Trivial existing-skill edit (a one-line bullet, a tightened sentence, a stale fact corrected): parent does directly.
- Substantive existing-skill edit (a new section, a new pattern table, more than ~10 lines): use the installed `writing-for-agents` skill and run its draft / test / iterate loop.
- `tune description: <skill path>` (the skill exists but didn't trigger when it should have): use the installed skill authoring guide and validate the trigger description.
- `new skill via create-skill: <kebab-name>`: use the installed skill authoring guide. Follow the repository's approved skill layout.

If your environment ships a SKILL.md validator, run it on every touched skill before declaring done. Skip this step if it doesn't.

### 6. Summarize for the user

Short list, no preamble:

- Edits applied: `<skill path>`. What changed, one line each.
- New skills created: `<skill path>`. One line each (rare).
- Backlog filed to the devex tracker: `<issue title>` (`<tags>`). One line each.
- Dropped: one line per rejected finding + reason from the synthesizer.
