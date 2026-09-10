# ADR-001: Distribute native resources and the full profile separately

## Status

Accepted

## Date

2026-09-10

## Context

Pi packages can install extensions, skills, prompt templates, and themes. This project also shares an
opinionated `AGENTS.md`, model definitions, application settings, third-party packages, external
skills, and the Thermos plugin. Pi does not treat those files as package resources.

Putting machine state under version control would expose credentials and conversation history.
Silently changing global configuration from an npm lifecycle script would also make a normal package
installation unexpectedly invasive.

## Decision

The repository supports two explicit installation modes:

1. `pi install git:github.com/alandotcom/pi-config` installs only resources declared by the Pi package
   manifest.
2. `node scripts/install.mjs` installs the full profile after confirmation. The installer backs up
   existing configuration, merges JSON settings, installs declared dependencies, and links Thermos
   resources from their own repository.

Third-party skills and Thermos remain external dependencies. Their source is recorded in manifests;
their code is not copied into this repository.

## Alternatives considered

### Store the whole Pi agent directory

Rejected because the directory contains authentication, sessions, caches, trust decisions, installed
packages, and other machine-local state.

### Use an npm postinstall script

Rejected because installing an extension package should not silently replace global instructions or
settings.

### Keep a separate personal configuration repository

Rejected for now because the intended artifact is a shareable agent profile. The native package and
full profile can coexist in one repository without mixing runtime state into source control.

## Consequences

- A standard Pi install remains narrow and predictable.
- Reproducing the complete agent requires the explicit installer.
- Profile settings must remain portable and must not contain credentials or absolute home paths.
- External dependencies can update independently and retain their own licenses.
