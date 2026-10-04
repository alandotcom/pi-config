# ADR-004: Select pstack workflows through skills

## Status

Accepted. Supersedes the workflow levels and activation commands in
[ADR-002](0002-pstack-workflow.md) and [ADR-003](0003-pstack-opt-in.md).

## Date

2026-10-04

## Context

The Pi port introduced full, focused, and off session levels alongside the original
skill workflows. An explicit skill ran while the controller was off, and two
Poteto Mode commands had different persistence behavior. The user wants the
original skill-driven model without an additional activation setting.

## Decision

Select workflows through the pstack router or namespaced skills. Poteto Mode
provides its engineering style and playbook routing as skill instructions in the
conversation. Individual skills run their named workflow within the user's scope.
Pi's normal context handling determines how long those instructions remain in
context; the extension stores no activation state and adds no routing policy.

Remove the `/poteto-mode` extension command, `/pstack` mode subcommands,
`--pstack-level`, saved workflow-default handling, and assignment-level markers.
Retain `/pstack` solely for checklist display and `pstack_tasks` for branch-local
checklist replacement. Keep resource discovery and all 49 namespaced skills.
Bundled task briefs establish leaf ownership and completed parent gates directly.
TintinWeb remains the only delegation engine.

Ignore legacy workflow preferences and session entries without rewriting them.
Preserve checklist entries and optional model preferences. Before the next model
request, remove only the retired controller's tagged mode policy from structured
or inherited append/custom prompts. Retain unrelated prompt sections and source
history. This migration cleanup never adds a new workflow prompt.

Update the optional profile instructions through the explicit installer. A normal
package load cannot replace a user's global `AGENTS.md`. Users with older profile
instructions can run the installer to remove the stale activation guidance.

## Alternatives considered

- Keep `/poteto-mode` as the sole activation command: rejected because it retains
  the redundant persistent mode layer alongside skill invocation.
- Enable all individual skills for automatic model selection: not required for
  this change. The router and linked references already provide skill routing;
  preserve existing explicit command flags.
- Delete legacy user preferences and session entries: rejected because they can
  contain model choices or unrelated data and need no destructive migration.
- Remove the checklist extension entirely: rejected because checklist storage,
  display, and command discovery remain useful independent of workflow selection.

## Consequences

- There is one invocation model for Poteto Mode and individual pstack workflows.
- Session resume cannot reactivate a workflow through old mode data.
- Skill instructions still require real delegation, verification, and repository
  review gates when the selected workflow calls for them.
- Workflow selection never grants branch changes, publication, deployments, or
  broader data mutation.
