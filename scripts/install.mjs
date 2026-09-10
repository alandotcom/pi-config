#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mergeModelConfig, mergeSettings, readJson, writeJson } from "./profile-lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function parseArgs(argv) {
  const options = {
    dryRun: false,
    yes: false,
    skipSkills: false,
    skipThermos: false,
    thermosRoot: process.env.PI_CONFIG_THERMOS_ROOT,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--yes" || arg === "-y") options.yes = true;
    else if (arg === "--skip-skills") options.skipSkills = true;
    else if (arg === "--skip-thermos") options.skipThermos = true;
    else if (arg === "--thermos-root") options.thermosRoot = argv[++index];
    else if (arg === "--help" || arg === "-h") options.help = true;
    else throw new Error(`Unknown option: ${arg}`);
  }

  if (options.thermosRoot) options.thermosRoot = path.resolve(options.thermosRoot);
  return options;
}

function usage() {
  console.log(`Usage: node scripts/install.mjs [options]

Installs the full shared Pi profile. Existing configuration files are backed up
before they are merged or replaced.

Options:
  --dry-run              Print the plan without changing anything
  -y, --yes              Skip the confirmation prompt
  --skip-skills          Do not install the curated third-party skills
  --skip-thermos         Do not install or link the Thermos plugin
  --thermos-root <path>  Use an existing Thermos checkout
  -h, --help             Show this help`);
}

function run(command, args, dryRun) {
  console.log(`$ ${[command, ...args].map(shellQuote).join(" ")}`);
  if (dryRun) return;
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with status ${result.status}`);
}

function shellQuote(value) {
  return /^[A-Za-z0-9_./:@=-]+$/.test(value) ? value : `'${value.replaceAll("'", "'\\''")}'`;
}

function pathExists(target) {
  try {
    fs.lstatSync(target);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function backupPath(target, agentDir, backupDir, dryRun) {
  if (!pathExists(target)) return;
  const relative = path.relative(agentDir, target);
  const destination = path.join(backupDir, relative);
  console.log(`backup ${target} -> ${destination}`);
  if (dryRun) return;
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(target, destination, {
    recursive: true,
    dereference: false,
    verbatimSymlinks: true,
  });
}

function removeShadowedResource(target, agentDir, backupDir, dryRun) {
  if (!pathExists(target)) return;
  backupPath(target, agentDir, backupDir, dryRun);
  console.log(`remove ${target} (provided by the installed package)`);
  if (!dryRun) fs.rmSync(target, { recursive: true, force: true });
}

function replaceWithFile(source, target, agentDir, backupDir, dryRun) {
  backupPath(target, agentDir, backupDir, dryRun);
  console.log(`copy ${source} -> ${target}`);
  if (dryRun) return;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.rmSync(target, { recursive: true, force: true });
  fs.copyFileSync(source, target);
  fs.chmodSync(target, 0o600);
}

function replaceWithLink(source, target, agentDir, backupDir, dryRun) {
  if (pathExists(target)) {
    try {
      if (fs.realpathSync(target) === fs.realpathSync(source)) {
        console.log(`keep ${target} -> ${source}`);
        return;
      }
    } catch {
      // Replace broken or unreadable paths after backing them up.
    }
  }

  backupPath(target, agentDir, backupDir, dryRun);
  console.log(`link ${target} -> ${source}`);
  if (dryRun) return;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.rmSync(target, { recursive: true, force: true });
  const linkType = fs.statSync(source).isDirectory() ? "junction" : "file";
  fs.symlinkSync(source, target, linkType);
}

function readExistingJson(file) {
  if (!pathExists(file)) return {};
  try {
    return readJson(file);
  } catch (error) {
    throw new Error(`Refusing to replace invalid JSON at ${file}: ${error.message}`);
  }
}

function mergeProfileFile(profileFile, target, agentDir, backupDir, dryRun, merge = mergeObjects) {
  const existing = readExistingJson(target);
  const profile = readJson(profileFile);
  const merged = merge(existing, profile);
  backupPath(target, agentDir, backupDir, dryRun);
  console.log(`merge ${profileFile} -> ${target}`);
  if (!dryRun) writeJson(target, merged);
}

function mergeObjects(base, overlay) {
  if (base === null || typeof base !== "object" || Array.isArray(base)) return structuredClone(overlay);
  if (overlay === null || typeof overlay !== "object" || Array.isArray(overlay)) return structuredClone(overlay);
  const merged = structuredClone(base);
  for (const [key, value] of Object.entries(overlay)) {
    merged[key] = mergeObjects(merged[key], value);
  }
  return merged;
}

function thermosSources(thermosRoot, manifest) {
  return [
    ...manifest.skills.map((name) => ({
      source: path.join(thermosRoot, "skills", name),
      kind: "directory",
      targetParts: ["skills", name],
    })),
    ...manifest.agents.map((name) => ({
      source: path.join(thermosRoot, "pi", "agents", `${name}.md`),
      kind: "file",
      targetParts: ["agents", `${name}.md`],
    })),
  ];
}

function validateThermosRoot(thermosRoot, manifest) {
  for (const resource of thermosSources(thermosRoot, manifest)) {
    const stat = fs.statSync(resource.source, { throwIfNoEntry: false });
    const valid = resource.kind === "directory" ? stat?.isDirectory() : stat?.isFile();
    if (!valid) throw new Error(`Thermos ${resource.kind} not found: ${resource.source}`);
  }
}

function prepareThermos(options, manifest) {
  const dataHome = process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share");
  const checkout = path.join(dataHome, "pi-config", "plugins");
  let thermosRoot = options.thermosRoot;

  if (!thermosRoot) {
    if (!pathExists(checkout)) {
      run("git", ["clone", "--depth", "1", "--filter=blob:none", "--sparse", manifest.repository, checkout], options.dryRun);
      run("git", ["-C", checkout, "sparse-checkout", "set", manifest.directory], options.dryRun);
    }
    thermosRoot = path.join(checkout, manifest.directory);
  }

  if (!options.dryRun || pathExists(thermosRoot)) validateThermosRoot(thermosRoot, manifest);
  return thermosRoot;
}

function linkThermos(options, manifest, thermosRoot, agentDir, backupDir) {
  for (const resource of thermosSources(thermosRoot, manifest)) {
    replaceWithLink(
      resource.source,
      path.join(agentDir, ...resource.targetParts),
      agentDir,
      backupDir,
      options.dryRun,
    );
  }
}

async function confirmInstall(options, agentDir) {
  if (options.yes || options.dryRun) return true;
  const terminal = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await terminal.question(`Install the shared Pi profile into ${agentDir}? [y/N] `);
    return /^y(?:es)?$/i.test(answer.trim());
  } finally {
    terminal.close();
  }
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    usage();
    return;
  }

  const agentDir = path.resolve(process.env.PI_CODING_AGENT_DIR || path.join(os.homedir(), ".pi", "agent"));
  const stamp = new Date().toISOString().replaceAll(":", "-");
  const backupDir = path.join(agentDir, "backups", `pi-config-${stamp}`);
  const settingsPath = path.join(agentDir, "settings.json");
  const modelsPath = path.join(agentDir, "models.json");
  const subagentsPath = path.join(agentDir, "subagents.json");
  const agentsPath = path.join(agentDir, "AGENTS.md");

  const packages = readJson(path.join(root, "profile", "packages.json")).packages;
  const skillManifest = readJson(path.join(root, "profile", "skills.json"));
  const thermosManifest = readJson(path.join(root, "profile", "thermos.json"));
  readJson(path.join(root, "profile", "settings.json"));
  readJson(path.join(root, "profile", "models.json"));
  readJson(path.join(root, "profile", "subagents.json"));
  if (!Array.isArray(packages) || !Array.isArray(skillManifest.sources)) {
    throw new Error("Invalid package or skill profile manifest.");
  }
  if (!Array.isArray(thermosManifest.skills) || !Array.isArray(thermosManifest.agents)) {
    throw new Error("Invalid Thermos profile manifest.");
  }

  // Validate existing configuration before confirmation or external commands.
  readExistingJson(settingsPath);
  readExistingJson(modelsPath);
  readExistingJson(subagentsPath);
  if (!options.skipThermos && options.thermosRoot) {
    validateThermosRoot(options.thermosRoot, thermosManifest);
  }

  console.log(`${options.dryRun ? "Dry run for" : "Installing"} Pi profile in ${agentDir}`);
  if (!(await confirmInstall(options, agentDir))) {
    console.log("Cancelled.");
    return;
  }

  const thermosRoot = options.skipThermos ? undefined : prepareThermos(options, thermosManifest);
  backupPath(settingsPath, agentDir, backupDir, options.dryRun);

  for (const source of packages) run("pi", ["install", source], options.dryRun);

  removeShadowedResource(
    path.join(agentDir, "skills", "simplify"),
    agentDir,
    backupDir,
    options.dryRun,
  );

  const existingSettings = readExistingJson(settingsPath);
  const profileSettings = readJson(path.join(root, "profile", "settings.json"));
  const mergedSettings = mergeSettings(existingSettings, profileSettings, packages);
  console.log(`merge ${path.join(root, "profile", "settings.json")} -> ${settingsPath}`);
  if (!options.dryRun) writeJson(settingsPath, mergedSettings);

  mergeProfileFile(
    path.join(root, "profile", "models.json"),
    modelsPath,
    agentDir,
    backupDir,
    options.dryRun,
    mergeModelConfig,
  );
  mergeProfileFile(path.join(root, "profile", "subagents.json"), subagentsPath, agentDir, backupDir, options.dryRun);
  replaceWithFile(path.join(root, "profile", "AGENTS.md"), agentsPath, agentDir, backupDir, options.dryRun);

  if (!options.skipSkills) {
    for (const entry of skillManifest.sources) {
      run(
        "npx",
        ["--yes", "skills", "add", entry.source, "--global", "--agent", "pi", "--skill", ...entry.skills, "--yes"],
        options.dryRun,
      );
    }
  }

  if (!options.skipThermos) {
    linkThermos(options, thermosManifest, thermosRoot, agentDir, backupDir);
  }

  console.log(options.dryRun ? "Dry run complete; no files were changed." : `Profile installed. Backups: ${backupDir}`);
  console.log("Run `pi /login` to configure provider credentials, then restart Pi.");
}

export function isDirectExecution(argvPath, moduleUrl) {
  if (!argvPath) return false;
  try {
    return fs.realpathSync(path.resolve(argvPath)) === fs.realpathSync(fileURLToPath(moduleUrl));
  } catch {
    return false;
  }
}

if (isDirectExecution(process.argv[1], import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
