# Working in this repository

`pi-config` is a shareable Pi package and an optional full agent profile. The native package ships
`recall`, `ask_async`, and the local `simplify` skill. The explicit installer applies the global
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

The profile installer must preserve unrelated settings, back up every existing file or link it
replaces, support `--dry-run`, and fail rather than overwrite malformed JSON.

## Extension invariants

`recall` searches only the current thread: the current session and the chain of sessions from which
it was forked or cloned. Never widen the search to unrelated sessions. Its complete result remains
bounded at 6,000 characters.

`ask_async` returns as soon as the question is displayed. Awaiting the answer would defeat the tool's
purpose. In headless modes it must return a plain message rather than wait for unavailable UI.

Each extension is self-contained. Pi loads every TypeScript or JavaScript file below the declared
extension directory, so do not place a shared helper there unless it is also a valid extension.

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
