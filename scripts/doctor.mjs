#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isProfileSubset, packageIdentity, readJson } from "./profile-lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const agentDir = path.resolve(process.env.PI_CODING_AGENT_DIR || path.join(os.homedir(), ".pi", "agent"));
const checks = [];

function check(label, condition, detail) {
  checks.push({ label, ok: Boolean(condition), detail });
}

function safeJson(file) {
  try {
    return readJson(file);
  } catch {
    return undefined;
  }
}

function checkThermosLink(label, target, expectedSuffix, kind) {
  let valid = false;
  try {
    const link = fs.lstatSync(target);
    const source = fs.realpathSync(target);
    const stat = fs.statSync(source);
    valid = link.isSymbolicLink()
      && source.endsWith(path.normalize(expectedSuffix))
      && (kind === "directory" ? stat.isDirectory() : stat.isFile());
  } catch {
    valid = false;
  }
  check(label, valid, `expected a working Thermos ${kind} symlink`);
}

const settings = safeJson(path.join(agentDir, "settings.json"));
const profileSettings = readJson(path.join(root, "profile", "settings.json"));
check("profile settings", isProfileSubset(settings, profileSettings), "profile-owned settings differ");

const desiredPackages = readJson(path.join(root, "profile", "packages.json")).packages;
const installedIds = new Set((settings?.packages ?? []).map(packageIdentity));
for (const source of desiredPackages) {
  check(`package ${source}`, installedIds.has(packageIdentity(source)), "missing from settings.json");
}

const models = safeJson(path.join(agentDir, "models.json"));
const profileModels = readJson(path.join(root, "profile", "models.json"));
const expectedProvider = { ...profileModels.providers.openrouter, models: [] };
const actualProvider = { ...models?.providers?.openrouter, models: [] };
check("OpenRouter provider settings", isProfileSubset(actualProvider, expectedProvider), "provider settings differ");
for (const model of profileModels.providers.openrouter.models) {
  const actual = models?.providers?.openrouter?.models?.find((candidate) => candidate.id === model.id);
  check(`model ${model.id}`, isProfileSubset(actual, model), "model is missing or differs");
}

const subagents = safeJson(path.join(agentDir, "subagents.json"));
const profileSubagents = readJson(path.join(root, "profile", "subagents.json"));
check("subagent settings", isProfileSubset(subagents, profileSubagents), "profile-owned subagent settings differ");

const agentsPath = path.join(agentDir, "AGENTS.md");
const expectedAgents = fs.readFileSync(path.join(root, "profile", "AGENTS.md"), "utf8");
let actualAgents;
try {
  actualAgents = fs.readFileSync(agentsPath, "utf8");
} catch {
  actualAgents = undefined;
}
check("global instructions", actualAgents === expectedAgents, "AGENTS.md is missing or differs");

const skills = readJson(path.join(root, "profile", "skills.json")).sources.flatMap((entry) => entry.skills);
for (const skill of skills) {
  const found = fs.existsSync(path.join(agentDir, "skills", skill))
    || fs.existsSync(path.join(os.homedir(), ".agents", "skills", skill));
  check(`skill ${skill}`, found, "not found in a global skill directory");
}

const thermos = readJson(path.join(root, "profile", "thermos.json"));
for (const skill of thermos.skills) {
  checkThermosLink(
    `Thermos skill ${skill}`,
    path.join(agentDir, "skills", skill),
    path.join("skills", skill),
    "directory",
  );
}
for (const agent of thermos.agents) {
  checkThermosLink(
    `Thermos agent ${agent}`,
    path.join(agentDir, "agents", `${agent}.md`),
    path.join("pi", "agents", `${agent}.md`),
    "file",
  );
}

for (const result of checks) {
  console.log(`${result.ok ? "PASS" : "FAIL"} ${result.label}${result.ok ? "" : `: ${result.detail}`}`);
}

const failures = checks.filter((result) => !result.ok);
console.log(`\n${checks.length - failures.length}/${checks.length} checks passed.`);
if (failures.length > 0) process.exitCode = 1;
