# ADR-003: Enable pstack through an explicit session command

## Status

Superseded by [ADR-004](0004-pstack-skill-routing.md). Originally superseded the
built-in default in [ADR-002](0002-pstack-workflow.md).

## Date

2026-10-04

## Context

Always enabling full pstack adds workflow steps and delegation to sessions where the user expects
the ordinary project workflow. The user wants opt-in activation through `/poteto-mode`, matching
the original entrypoint. The progress footer also shows checklist counts without a direct command
to view task titles.

## Decision

Use off as the built-in default, including configuration files that contain model preferences but
no `defaultLevel`. Preserve existing explicit saved defaults, CLI levels, and session choices.
Keep session > CLI > saved default > built-in default precedence and the existing reset behavior.

Register `/poteto-mode` as a session command that enables full. An optional full, focused, or off
argument sets that level. Reuse `/pstack` level handling so activation follows the same branch
storage and reporting contracts. Activation leaves saved preferences and checklist assignments
unchanged. The namespaced `/skill:pstack-poteto-mode` remains an explicit workflow request and
keeps its existing behavior without changing the session level.

Make bare `/pstack` display the complete active-branch checklist using the same formatter as
`pstack_tasks`. Keep `/pstack status` for configuration details. Add a `tasks: /pstack` footer hint
so the task list has a visible entrypoint without requiring subcommand discovery. Checklist access
remains available while off and does not change workflow level.

## Alternatives considered

- Overwrite existing saved defaults: rejected because updates must preserve explicit user choices
  and extension loading must leave global configuration untouched.
- Treat `/poteto-mode` only as a skill alias: rejected because a persistent session choice needs
  deterministic command handling rather than relying on model interpretation.
- Require the user to ask the model for task titles: rejected because the checklist is already
  stored as session data and can be displayed without a model call.

## Consequences

- Fresh sessions use ordinary project rules until explicitly enabled, unless the user has chosen
  a saved default or CLI level.
- Users with a previous saved full or focused default can restore opt-in behavior with
  `/pstack save off`. Existing sessions retain their session choice until explicitly changed.
- No installer migration or extension-load write is required.
- Off mode retains project-required tests, reviews, safety rules, and authorization boundaries.
