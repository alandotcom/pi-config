# ADR-002: Adapt pstack with adjustable Pi workflow intensity

## Status

Accepted. The built-in default is superseded by [ADR-003](0003-pstack-opt-in.md).

## Date

2026-10-04

## Context

Cursor's pstack provides deliberate grounding, competing designs, delegated implementation,
independent cross-judging, and evidence-based verification. Its cloud agents, model names,
transcript layout, and orchestration helpers do not match this Pi profile. The profile already uses
TintinWeb delegation, pinned specialists, and local-first defaults.

## Decision

Maintain an attributed in-repository adaptation of pstack as the explicit exception to ADR-001's
external-only third-party skill policy. Record its audited upstream commit, full license, adaptation
boundary, and update procedure in [the provenance document](../third-party/pstack.md).

Advertise the pstack router and namespaced explicit command skills for all adapted workflows and
principles. Thin command instructions point to the nested upstream-derived references, preserving
one behavior owner. The pstack prefix avoids collisions with installed recall, tdd, and other skills.
Both the package manifest and extension resource discovery expose the command directory so a
pstack-only test invocation remains discoverable. A native extension
adds a small structured prompt section, user commands, and session checklist. TintinWeb remains the
only delegation engine. No shell hook, automatic dependency installation, or global configuration
mutation runs on extension load.

Full is the default. Focused retains scoped work, independent code review, and real verification,
with optional exploration chosen for explicit risks. Off removes pstack-added process while retaining
repository requirements. Levels never grant authority or waive branch, production, test, or review
protections. Session choice overrides CLI and saved default; reset follows the saved default.

Bundle worker and reviewer briefs inside the pstack skill. Dispatch both through TintinWeb's
existing general-purpose agent, including the complete role instructions in each task prompt.
No separate agent definitions or profile installer are required. Preserve existing specialist pins.
The coordinator owns design fan-out, synthesis, integration, external writes, and independent
acceptance. Missing delegation remains a reported gap, never a silent downgrade or substitute engine.

## Alternatives considered

- Install the casualjim port: rejected because its delegation engine and shell-hook behavior conflict
  with this profile.
- Install unmodified Cursor pstack: rejected because platform-specific instructions imply unavailable
  capabilities and conflicting agent ownership.
- Build a second delegation engine: rejected because TintinWeb already owns execution and state.
- Vendor all third-party skills: rejected. The approved exception is bounded to this adaptation.

## Consequences

- Upstream updates require comparison and reapplication of the Pi execution contract.
- A standard Pi package provides all pstack instructions. Full delegation also requires TintinWeb,
  which remains an independently installed Pi package.
- The runtime reports level and prerequisites; skills express workflow policy rather than enforcing
  a hard security sandbox.
- Local installation can point to this checkout through the explicit installer's --local-package
  option. Testing that path does not authorize changing a user's live installation.
