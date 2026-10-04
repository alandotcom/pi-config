# Working in this repository

`pi-config` is a shareable Pi package and an optional full agent profile. The native package ships
`recall`, `ask_async`, the pstack workflow controller, and the local skills. The explicit installer applies the global
instructions, settings, models, external skills, packages, and Thermos integration under `profile/`.

## Distribution boundaries

A normal `pi install` must remain narrow. Do not add lifecycle scripts that modify a user's global
configuration. Changes outside native Pi package resources belong in `scripts/install.mjs`, where
they are visible, confirmed, and backed up.

Never commit authentication, sessions, trust decisions, generated model catalogs, package caches,
binaries, backups, machine-specific paths, or other runtime state. Profile files must work for a
user whose home directory and checkout locations differ from the maintainer's.

Third-party skills and Thermos remain external dependencies. Record their sources and selected
resources in profile manifests instead of copying their implementation into this repository.
Pstack is the approved exception: maintain its attributed Pi adaptation under `skills/pstack`,
record the audited upstream commit and license, and review each upstream update before replacing
adapted content. Namespaced command skills under `skills/pstack/commands` point to the adapted
references. Expose these through the package manifest and extension resource discovery so both
package installation and pstack-only test sessions retain direct invocation.

The profile installer must preserve unrelated settings, back up every existing file or link it
replaces, support `--dry-run`, and fail rather than overwrite malformed JSON.

## Extension invariants

`recall` searches only the current thread: the current session and the chain of sessions from which
it was forked or cloned. Never widen the search to unrelated sessions. Its complete result remains
bounded at 6,000 characters.

`ask_async` returns as soon as the question is displayed. Awaiting the answer would defeat the tool's
purpose. In headless modes it must return a plain message rather than wait for unavailable UI.

Each declared extension has an explicit entrypoint. Keep helpers behind an entrypoint rather than
listing a directory whose files Pi might interpret as independent extensions.

Pstack adds only its own prompt section, commands, and session checklist. TintinWeb remains the
only delegation engine. Off is the built-in default; `/poteto-mode` enables full for the session,
and `/poteto-mode focused` enables focused. Explicit saved defaults remain effective. Levels
change process, never authority. State follows the active session branch. Saved preferences retain
unrelated keys and get a backup before replacement. Extension loading never writes global state.
Pstack worker and reviewer instructions are bundled task briefs sent to TintinWeb's general-purpose
agent. Pstack requires no separately installed agent definitions. Other agent overrides remain
optional profile resources installed only through the explicit installer.

## Verification

Run after each meaningful change:

```sh
npm test
```

Before release, also verify the package contents and the non-mutating installation path:

```sh
node scripts/install.mjs --dry-run
npm pack --dry-run
```

Use `npm run doctor` only when checking a machine on which the full profile is expected to be
installed.

## Documentation

Update `README.md` when installation behavior, package resources, profile manifests, or external
dependencies change. Record expensive-to-reverse distribution decisions under `docs/decisions/`.
Comments should explain constraints and intent rather than restating code.
