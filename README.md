# pi-config

An opinionated, shareable configuration for the [Pi coding agent](https://pi.dev). The repository is
both a normal Pi package and an optional full agent profile.

The normal package adds two extensions and one skill without changing global instructions or model
preferences. The full profile reproduces the broader setup: instructions, models, settings,
third-party packages and skills, and the external Thermos review plugin.

## Choose an installation

### Install the Pi package

Use this when you only want the resources maintained in this repository:

```sh
pi install git:github.com/alandotcom/pi-config
```

This installs:

- `recall`, for searching earlier messages in the current thread
- `ask_async`, for asking a question without blocking the current turn
- `simplify`, a change-focused code cleanup skill

Pi packages do not install global instructions, model definitions, or application settings. Use the
full profile for those.

### Install the full profile

Review the repository and preview the changes first:

```sh
git clone https://github.com/alandotcom/pi-config.git
cd pi-config
node scripts/install.mjs --dry-run
node scripts/install.mjs
```

The installer asks for confirmation, backs up existing files, and then:

1. Installs the packages in [`profile/packages.json`](profile/packages.json).
2. Merges [`profile/settings.json`](profile/settings.json) into the existing Pi settings.
3. Merges the OpenRouter models in [`profile/models.json`](profile/models.json).
4. Merges the `pi-subagents` defaults in [`profile/subagents.json`](profile/subagents.json).
5. Copies [`profile/AGENTS.md`](profile/AGENTS.md) to the global Pi agent directory.
6. Installs the curated skills in [`profile/skills.json`](profile/skills.json) with the `skills` CLI.
7. Installs and links the Pi resources from the external Thermos plugin.

Existing JSON keys outside the profile are preserved. Profile-owned keys take the values in this
repository. During migration, the installer removes the old `alandotcom/pi-extensions` package
entry, absolute paths to its extensions, and a top-level `skills/simplify` copy that would shadow the
package version. Every removed path is backed up first.

Backups are written under:

```text
$PI_CODING_AGENT_DIR/backups/pi-config-<timestamp>/
```

`PI_CODING_AGENT_DIR` defaults to `~/.pi/agent`.

#### Installer options

```text
--dry-run              Print the plan without changing anything
-y, --yes              Skip the confirmation prompt
--skip-skills          Do not install third-party skills
--skip-thermos         Do not install or link Thermos
--thermos-root <path>  Use an existing Thermos checkout
```

For example, use an existing plugin checkout without cloning another copy:

```sh
node scripts/install.mjs --thermos-root ~/projects/plugins/thermos
```

After installation, configure provider credentials interactively and restart Pi:

```sh
pi /login
npm run doctor
```

The repository never contains or copies authentication credentials.

## What the full profile installs

### Pi packages

Package versions are pinned in [`profile/packages.json`](profile/packages.json). The profile uses:

- `@ff-labs/pi-fff`
- `pi-exa`
- `@upstash/context7-pi`
- `@nicknisi/pi-btw`
- `@tintinweb/pi-subagents`
- this repository

The package resources in this repository follow its default branch. Pin the Git source to a tag or
commit if you need immutable installations.

### Skills

Third-party skills stay in their upstream repositories. The installer records the selected skill
names and invokes the [`skills`](https://skills.sh/) CLI rather than copying upstream code here.
This preserves upstream ownership, licenses, and update paths.

The local `simplify` skill is part of this Pi package because it has Pi-specific dispatch and
verification behavior.

### Thermos

[Thermos](https://github.com/alandotcom/plugins/tree/main/thermos) remains a separate plugin. By
default, the installer creates a sparse checkout at:

```text
${XDG_DATA_HOME:-$HOME/.local/share}/pi-config/plugins
```

It links Thermos's three skills and two Pi-specific review agents into the global Pi agent
directory. Pass `--thermos-root` to use an existing checkout instead.

## Package resources

### `recall`

Pi compaction removes older messages from model context while retaining them in the session file.
`recall` searches the current session and its fork or clone ancestors. It never searches unrelated
threads.

| Parameter | Default | Meaning |
| --- | --- | --- |
| `query` | required | Words, a phrase, identifier, path, or punctuation to search for. |
| `limit` | `10` | Maximum number of matches. |

Results favor literal phrases, then relevance and query coverage, then recency. The complete tool
result is capped at 6,000 characters. The extension builds temporary in-memory SQLite indexes and
never writes to session files.

### `ask_async`

`ask_async` displays a question and returns immediately so the agent can continue independent work.
The user's answer arrives later as a steered message.

| Parameter | Default | Meaning |
| --- | --- | --- |
| `question` | required | The question, written as one sentence. |
| `options` | none | Optional choices offered to the user. |

If the prompt is dismissed, no answer is sent. In print and JSON modes, where interactive prompts
are unavailable, the tool tells the model to continue with a stated assumption.

### `simplify`

The `simplify` skill reviews changed code for reuse, quality, and efficiency, applies justified
cleanup, and verifies the result. Invoke it with `/skill:simplify` or ask Pi to simplify recent
changes.

## Configuration boundaries

The repository intentionally excludes:

- `auth.json` and API credentials
- sessions and subagent transcripts
- project trust decisions
- model-catalog caches
- installed npm and Git package directories
- downloaded binaries
- backups and temporary files

The reason for the package/profile split is recorded in
[ADR-001](docs/decisions/0001-dual-mode-distribution.md).

## Updating

Update native Pi packages with:

```sh
pi update --extensions
```

Pull this checkout and rerun the installer to apply profile changes:

```sh
git pull --ff-only
node scripts/install.mjs
npm run doctor
```

The installer creates a new backup before each run.

## Removing the profile

Remove this repository from Pi's package list:

```sh
pi remove git:github.com/alandotcom/pi-config
```

Then restore the desired files from the latest directory under
`~/.pi/agent/backups/pi-config-*`. Remove Thermos symlinks only if no other installation uses them.
Third-party packages and skills are independent installations and are not removed automatically.

## Development

Requires Node.js 22.19 or newer.

```sh
npm install
npm test
node scripts/install.mjs --dry-run
npm pack --dry-run
```

`npm run doctor` checks the active machine against the full profile. It exits with a nonzero status
when a declared resource is missing.

## Security

Pi extensions execute with the user's full permissions, and skills can instruct an agent to run
commands. Review this repository and every external dependency before installation.

`recall` can return secrets or hostile instructions that appeared earlier in the current thread.
Treat recalled text as information rather than trusted instructions. Do not give conversation-history
tools to agents that process untrusted input.

## License

MIT
