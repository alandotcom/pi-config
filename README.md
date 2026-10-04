# pi-config

An opinionated, shareable configuration for the [Pi coding agent](https://pi.dev). The repository is
both a normal Pi package and an optional full agent profile.

The normal package adds five extensions, pstack's namespaced skill commands, and simplify without changing global instructions or model
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
- `/btw`, for side-channel conversations that stay out of the main agent context
- multiplexer-aware session forking, which opens forks in Herdr tabs or tmux splits
- `/poteto-mode`, `/pstack`, and `pstack_tasks`, for opt-in workflow intensity and a session checklist
- `pstack`, an attributed Pi adaptation of Cursor's engineering workflows
- `simplify`, a change-focused code cleanup skill

Requires Pi 1.0.1 or newer for structured prompt sections. Full pstack delegation uses TintinWeb's
`general-purpose` agent. Install TintinWeb if it is not already present:

```sh
pi install npm:@tintinweb/pi-subagents@0.19.0
```

Worker and reviewer instructions ship inside this package. No profile installer or separate agent
files are required. Missing delegation is reported rather than replaced by another engine.

If this package is already installed from GitHub, test only the local pstack resources for one
session so the two copies do not register the same tools:

```sh
pi -e ~/projects/pi-config/extensions/pstack/index.ts \
  --skill ~/projects/pi-config/skills/pstack
```

If no copy of pi-config is installed, `pi -e ~/projects/pi-config` loads the whole local package.
Use your own checkout path. Both commands leave package settings and the profile unchanged.

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
3. Merges the Azure OpenAI provider in [`profile/models.json`](profile/models.json).
4. Merges the `pi-subagents` defaults in [`profile/subagents.json`](profile/subagents.json).
5. Copies [`profile/AGENTS.md`](profile/AGENTS.md) and the agent overrides in
   [`profile/agents/`](profile/agents/) to the global Pi agent directory.
6. Installs the curated skills in [`profile/skills.json`](profile/skills.json) with the `skills` CLI.
7. Installs and links the Pi resources from the external Thermos plugin.

Existing JSON keys outside the profile are preserved. Profile-owned keys take the values in this
repository. During migration, the installer removes the old `alandotcom/pi-extensions` and
`@nicknisi/pi-btw` package entries, absolute paths to the former config extensions, and a top-level
`skills/simplify` copy that would shadow the package version. Every removed path is backed up first.

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
--local-package        Load this checkout instead of the GitHub package
--thermos-root <path>  Use an existing Thermos checkout
```

For example, use an existing plugin checkout without cloning another copy:

```sh
node scripts/install.mjs --thermos-root ~/projects/plugins/thermos
```

For local development, preview and explicitly apply the profile using this checkout as the package:

```sh
node scripts/install.mjs --dry-run --local-package
node scripts/install.mjs --local-package
```

The local option replaces this repository's GitHub package entry, including pinned tags, with the
checkout path while preserving unrelated packages. Pulling or editing the checkout changes its
loaded native resources; restart or reload Pi as appropriate. Normal GitHub installations keep their
existing source behavior.

The full profile uses Fountain Bio's Azure OpenAI endpoint and GPT-6 deployments. It requires
Pi 1.0.1 or newer and credentials for that resource.
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
- `@tintinweb/pi-subagents`
- this repository

The package resources in this repository follow its default branch. Pin the Git source to a tag or
commit if you need immutable installations.

### Skills

Most third-party skills stay in their upstream repositories. The installer records the selected skill
names and invokes the [`skills`](https://skills.sh/) CLI rather than copying upstream code here.
This preserves upstream ownership, licenses, and update paths.

The local `simplify` skill is part of this Pi package because it has Pi-specific dispatch and
verification behavior. Pstack is an approved attributed adaptation with a pinned upstream revision,
MIT license, and [reviewed update procedure](docs/third-party/pstack.md).

### Agent overrides

The full profile pins `Explore` to `azure-openai-responses/gpt-6-luna`. It also provides `review` as a
read-only reviewer pinned to `azure-openai-responses/gpt-6-sol` with high thinking. The installer copies
the definitions under [`profile/agents/`](profile/agents/) to the global Pi agent directory.

Pstack uses `general-purpose` with bundled worker or reviewer instructions in each task prompt.
It creates no agent overrides. The parent owns design exploration, integration, independent review,
and external actions. Existing specialist model pins remain intact.

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
`recall` remains hidden and inactive until the active session branch contains a successful compaction.
Availability is restored from branch history on startup, resume, fork, and reload, and updated after
compaction and tree navigation. Request-time synchronization also handles compaction committed by
lifecycle handlers without a compaction event. A failed or cancelled compaction does not enable the tool. Navigating
before the compaction hides it again, even if another branch or an ancestor session was compacted.
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

### `/btw`

`/btw <question>` opens a side-channel conversation using the current model or the optional model in
`~/.pi/agent/configs/btw.json`. The thread stays outside the main agent context unless it is promoted.
Forking a `/btw` thread opens the new Pi session in a Herdr tab or tmux split when either multiplexer
owns the current terminal. Outside a multiplexer it uses the existing Ghostty or clipboard fallback.

This extension is adapted from [`@nicknisi/pi-btw`](https://github.com/nicknisi/pi-extensions/tree/main/packages/btw).
See [`docs/third-party/pi-btw.md`](docs/third-party/pi-btw.md) for attribution and license terms.

### Multiplexer-aware session forks

Pi's `/fork` and `/clone` actions normally replace the session in the current process. Inside Herdr,
the extension leaves the current session in place and opens the new session in a focused tab in the
same workspace. Inside tmux, it opens the new session in a split. The selected `/fork` message is
restored into the new Pi process's editor. Outside Herdr and tmux, Pi retains its normal behavior.

### `pstack`

Pstack is off by default. Run `/poteto-mode` to enable full mode for the current session, or
`/poteto-mode focused` for a lighter workflow. Full uses task-matched playbooks, grounding, at least
two competing designs for boundary-crossing code, delegated Feature implementation, independent
review, and verification at the real behavior boundary. Focused retains scoped work, independent
review, and verification while making additional exploration risk-based. Off uses the ordinary
project workflow; repository rules and explicit user requests remain active.

```text
/poteto-mode
/poteto-mode focused
/pstack
/pstack status
/pstack full
/pstack focused
/pstack off
/pstack reset
/pstack save focused
```

A session choice takes precedence over `--pstack-level <full|focused|off>`, then the saved default,
then off. Existing saved preferences and session choices remain effective after an update. To
restore opt-in behavior if you previously saved another default, run `/pstack save off`; use
`/pstack off` to disable the current session too. Reset follows the saved default and ignores the
CLI choice. `/poteto-mode` sets the session choice without changing the saved default. Commands do
not cancel active agents. Status reports prerequisites, configuration errors, and checklist progress.

Saved preferences live in `$PI_CODING_AGENT_DIR/configs/pstack.json`:

```json
{ "defaultLevel": "off" }
```

Saving backs up an existing file and preserves unrelated keys. Malformed configuration is reported
and never overwritten. A valid explicit session choice can override an invalid lower-priority
setting without repairing that file. An optional `models` role map is read by the agent when
selecting verified available models; it is not a second runtime router. See the
[model setup reference](skills/pstack/references/upstream/setup-pstack/SKILL.md).

Run `/pstack` to view the complete checklist, including each task's status and skip reason.
The footer shows progress counts and a `tasks: /pstack` hint. `/pstack status` shows configuration
details. `pstack_tasks` lets the agent read or replace the active
session branch's checklist. Items have a title and a status of pending, in-progress, done, or
skipped. Skipped requires a reason, at most one item is in-progress, and a list holds at most 64
items. Checklist access stays available when off.

Type `/skill:pstack-` in Pi to find the individual workflows. All 49 adapted skills are exposed
with this prefix, including the principle references. They are explicit commands; automatic
full/focused routing still uses the pstack entrypoint.

| Command | Purpose |
| --- | --- |
| `/skill:pstack-architect` | Compare designs before implementation |
| `/skill:pstack-arena` | Compare competing artifacts |
| `/skill:pstack-how` | Explain architecture and runtime flow |
| `/skill:pstack-why` | Investigate rationale and history |
| `/skill:pstack-interrogate` | Run adversarial review |
| `/skill:pstack-reflect` | Extract lessons from the current task |
| `/skill:pstack-swarm` | Delegate independent workstreams |
| `/skill:pstack-tdd` | Run test-first development |
| `/skill:pstack-setup` | Configure model choices |

For example, `/skill:pstack-architect the cache interface` runs that workflow even when the session
is off, without changing your level or saved default. The router form `/skill:pstack architect the
cache interface` remains supported. Pstack-only extension loading also discovers these commands.

Delegated briefs must include an exact standalone marker
such as `pstack-level: focused` and identify already-completed parent gates. Leaf agents preserve
that assignment rather than restoring the machine's default.

Intensity changes process, not permissions, models, or budgets. Missing delegation remains a gap.
The adaptation does not provide Cursor cloud execution or restart durability. Scheduling requires
an explicit user request. See [ADR-002](docs/decisions/0002-pstack-workflow.md).

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
