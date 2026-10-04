# Pstack attribution and update procedure

## Source

This package contains a Pi adaptation of Lauren Tan's pstack from
[Cursor's plugins repository](https://github.com/cursor/plugins/tree/e43c7ee26e0038c6c1fa8380dd34ce86ff94cb2a/pstack).
The audited source is version **0.15.9**, commit
`e43c7ee26e0038c6c1fa8380dd34ce86ff94cb2a`.

Pstack is licensed under MIT. The complete upstream license is retained in
[`pstack-LICENSE`](pstack-LICENSE). The adaptation is maintained by pi-config.
Upstream text remains upstream-derived even when transport names or paragraphs
have been changed. This is an adaptation, not an official Cursor package or an
unmodified upstream snapshot.

## Adaptation boundary

The original engineering principles, grounding, candidate comparison, independent
cross-judging, playbook checklists, and real-artifact verification remain the basis
of the skills. The `skills/pstack/SKILL.md` entrypoint routes workflow requests and
owns the shared Pi contract. Namespaced explicit command skills under
`skills/pstack/commands` point to each nested reference. Users can discover and
invoke them directly without shadowing installed tdd, recall, or teach skills.

The port translates Cursor Task dispatch into TintinWeb Agent calls using its
general-purpose agent. Bundled worker and reviewer task briefs retain repository
instructions and require leaf execution. No separate agent files are installed. The parent owns synthesis, integration, external writes, and independent
review. Existing specialist model choices are preserved. The native extension
provides resource discovery and branch-local checklist state. Bare `/pstack`
displays the checklist. Poteto Mode and individual workflows are selected through
skills; there is no extension activation command or workflow-level state.

Platform-heavy references are adapted at their owners:

- Model setup uses verified available Pi models and an optional user role map.
- Recall and reflection use the current thread and explicitly authorized paths.
- PR and shipping steps follow repository authority and installed forge tools.
- Comment review uses the read-only reviewer without the original theatrical agent.
- Plan and PR checks use real installed commands rather than absent bundled tools.
- Orchestration and autopilot state their local lifetime limits. They provide no
  Cursor cloud runner, automatic restart recovery, or implicit scheduling.
- `make-bot-ui` is omitted because it depends on Cursor's product integration.
- The portable decision-log shell helper is included. Cursor's Bun-based watcher,
  plan checker, orchestration store, dependency bootstrap, lockfile, and script
  test suite are omitted. They are not loaded or installed automatically.

Poteto Mode retains mandatory delegated Feature implementation and at least two
structurally distinct designs for boundary-crossing code. Pi cannot reproduce
Cursor's cloud runtime through prose. Reduced model diversity and unavailable
runtime capabilities must be reported explicitly. Workflow selection does not grant broader
permissions or override production, branch, test, or review safeguards.

## 0.15.9 update

Reviewed the [two-commit delta from 0.15.7](https://github.com/cursor/plugins/compare/9511e60321f7e533a187d62854a3d53a53752874...e43c7ee26e0038c6c1fa8380dd34ce86ff94cb2a).
Architect now screens designs for agents with a partial view of the repository,
including split ownership, multiple paths for one task, importable internals, and
hand-synced lists. Perf issue uses the seven ordered performance mantras;
hillclimb borrows their order while retaining its own stopping rules. The
benchmark checklist points to that guidance. Correct and the seven-question
benchmark checklist were already included in the 0.15.7 adaptation.

Retained the Pi execution contract, parent-model inheritance, leaf ownership, and
existing command discovery. The upstream manifest version is
recorded here rather than shipping Cursor's manifest. The hillclimb link to the
Perf issue playbook resolves relative to its containing file. The MIT license is
unchanged; no new platform capability or external dependency was added.

## Skill-driven workflow selection

Removed the Pi-only full/focused/off controller and duplicate activation command
as recorded in [ADR-004](../decisions/0004-pstack-skill-routing.md). The extension
ignores old `defaultLevel` preferences and mode session entries, preserves them
without writes, and removes the retired controller's tagged prompt on resume.
Optional model preferences remain available to the setup skill. Bundled task
briefs establish leaf ownership without a level marker. The original 0.15.9
workflow and principle instructions remain available through the same 49 commands.

## Updating

1. Check out the desired upstream commit outside this repository. Read its plugin
   version, license, manifest, skill inventory, and changed files.
2. Compare that commit against the recorded revision. Classify each change as a
   portable principle, workflow behavior, platform integration, or support tool.
   Review the whole changed reference and its links before selecting it.
3. Apply portable changes to the corresponding nested reference. Reapply the Pi
   execution contract at platform-sensitive owners. Keep authority, history scope,
   leaf ownership, model availability, and unsupported runtime claims explicit.
   Never replace the adaptation with a bulk upstream copy.
4. Update this document's revision and version. Preserve the complete license and
   record new omitted or materially changed capabilities.
5. Check local reference links and discover skills through Pi's public resource
   loader. Check the pstack router, simplify, and all namespaced pstack commands.
   Verify both whole-package and pstack-only extension loading, including command discovery.
6. Run `npm test`, the non-mutating local installer path, and package dry-run.
   Run a throwaway SDK command/state smoke and independently review the integrated
   checklist extension, migration prompts, bundled task briefs, and dependency closure.
7. Try one bounded selected workflow with real host tools. Record the
   actual evidence. A compile, a self-report, or an invented platform capability
   does not demonstrate faithful behavior.

Updates are reviewed source changes. Normal package loading never fetches or
rewrites upstream skills, user instructions, models, or agent definitions.
