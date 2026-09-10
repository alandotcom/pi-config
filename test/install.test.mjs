import assert from "node:assert/strict";
import {
  chmodSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { parseArgs } from "../scripts/install.mjs";

test("parseArgs supports safe installation controls", () => {
  assert.deepEqual(parseArgs(["--dry-run", "--yes", "--skip-skills", "--skip-thermos"]), {
    dryRun: true,
    yes: true,
    skipSkills: true,
    skipThermos: true,
    thermosRoot: process.env.PI_CONFIG_THERMOS_ROOT,
  });
});

test("dry run reports actions without writing the target directory", () => {
  const home = mkdtempSync(path.join(tmpdir(), "pi-config-test-"));
  const result = spawnSync(
    process.execPath,
    ["scripts/install.mjs", "--dry-run", "--skip-skills", "--skip-thermos"],
    {
      cwd: path.resolve(import.meta.dirname, ".."),
      env: { ...process.env, HOME: home, PI_CODING_AGENT_DIR: path.join(home, ".pi", "agent") },
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Dry run complete; no files were changed\./);
  assert.deepEqual(readdirSync(home), []);
});

test("installer merges profile files, backs up existing values, and links Thermos", () => {
  const projectRoot = path.resolve(import.meta.dirname, "..");
  const home = mkdtempSync(path.join(tmpdir(), "pi-config-install-"));
  const agentDir = path.join(home, ".pi", "agent");
  const fakeBin = path.join(home, "bin");
  const thermosRoot = path.join(home, "thermos");
  mkdirSync(agentDir, { recursive: true });
  mkdirSync(fakeBin);

  writeFileSync(
    path.join(agentDir, "settings.json"),
    JSON.stringify({
      lastChangelogVersion: "keep",
      packages: ["npm:private-package", "git:github.com/alandotcom/pi-extensions"],
      extensions: ["/Users/example/projects/pi-extensions/extensions/recall.ts"],
    }),
  );
  writeFileSync(path.join(agentDir, "models.json"), JSON.stringify({ providers: { local: { models: [] } } }));
  writeFileSync(path.join(agentDir, "subagents.json"), JSON.stringify({ customSetting: true }));
  writeFileSync(path.join(agentDir, "AGENTS.md"), "old instructions\n");

  const fakePi = path.join(fakeBin, "pi");
  writeFileSync(fakePi, "#!/bin/sh\nexit 0\n");
  chmodSync(fakePi, 0o755);

  for (const skill of ["thermos", "thermo-nuclear-review", "thermo-nuclear-code-quality-review"]) {
    mkdirSync(path.join(thermosRoot, "skills", skill), { recursive: true });
    writeFileSync(path.join(thermosRoot, "skills", skill, "SKILL.md"), `${skill}\n`);
  }
  for (const agent of ["thermo-nuclear-review-subagent", "thermo-nuclear-code-quality-review-subagent"]) {
    mkdirSync(path.join(thermosRoot, "pi", "agents"), { recursive: true });
    writeFileSync(path.join(thermosRoot, "pi", "agents", `${agent}.md`), `${agent}\n`);
  }

  const result = spawnSync(
    process.execPath,
    ["scripts/install.mjs", "--yes", "--skip-skills", "--thermos-root", thermosRoot],
    {
      cwd: projectRoot,
      env: {
        ...process.env,
        HOME: home,
        PI_CODING_AGENT_DIR: agentDir,
        PATH: `${fakeBin}:${process.env.PATH}`,
      },
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 0, result.stderr);
  const settings = JSON.parse(readFileSync(path.join(agentDir, "settings.json"), "utf8"));
  assert.equal(settings.lastChangelogVersion, "keep");
  assert.equal(settings.extensions, undefined);
  assert.ok(settings.packages.includes("npm:private-package"));
  assert.ok(settings.packages.includes("git:github.com/alandotcom/pi-config"));
  assert.ok(!settings.packages.includes("git:github.com/alandotcom/pi-extensions"));

  const models = JSON.parse(readFileSync(path.join(agentDir, "models.json"), "utf8"));
  assert.ok(models.providers.local);
  assert.ok(models.providers.openrouter);
  const subagents = JSON.parse(readFileSync(path.join(agentDir, "subagents.json"), "utf8"));
  assert.equal(subagents.customSetting, true);
  assert.equal(subagents.maxConcurrent, 3);
  assert.equal(readFileSync(path.join(agentDir, "AGENTS.md"), "utf8"), readFileSync(path.join(projectRoot, "profile", "AGENTS.md"), "utf8"));

  const agentLink = path.join(agentDir, "agents", "thermo-nuclear-review-subagent.md");
  assert.equal(lstatSync(agentLink).isSymbolicLink(), true);
  assert.equal(readlinkSync(agentLink), path.join(thermosRoot, "pi", "agents", "thermo-nuclear-review-subagent.md"));

  const backups = readdirSync(path.join(agentDir, "backups"));
  assert.equal(backups.length, 1);
  assert.equal(readFileSync(path.join(agentDir, "backups", backups[0], "AGENTS.md"), "utf8"), "old instructions\n");
});
