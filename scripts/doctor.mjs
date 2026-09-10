#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { packageIdentity, readJson } from "./profile-lib.mjs";

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

const settings = safeJson(path.join(agentDir, "settings.json"));
const desiredPackages = readJson(path.join(root, "profile", "packages.json")).packages;
const installedIds = new Set((settings?.packages ?? []).map(packageIdentity));
for (const source of desiredPackages) {
  check(`package ${source}`, installedIds.has(packageIdentity(source)), "missing from settings.json");
}

const models = safeJson(path.join(agentDir, "models.json"));
for (const model of readJson(path.join(root, "profile", "models.json")).providers.openrouter.models) {
  const available = models?.providers?.openrouter?.models?.some((candidate) => candidate.id === model.id);
  check(`model ${model.id}`, available, "missing from models.json");
}

const subagents = safeJson(path.join(agentDir, "subagents.json"));
check("subagent settings", Boolean(subagents), "subagents.json is missing or invalid");
check("global instructions", fs.existsSync(path.join(agentDir, "AGENTS.md")), "AGENTS.md is missing");

const skills = readJson(path.join(root, "profile", "skills.json")).sources.flatMap((entry) => entry.skills);
for (const skill of skills) {
  const found = fs.existsSync(path.join(agentDir, "skills", skill)) || fs.existsSync(path.join(os.homedir(), ".agents", "skills", skill));
  check(`skill ${skill}`, found, "not found in a global skill directory");
}

const thermos = readJson(path.join(root, "profile", "thermos.json"));
for (const skill of thermos.skills) {
  check(`Thermos skill ${skill}`, fs.existsSync(path.join(agentDir, "skills", skill)), "missing");
}
for (const agent of thermos.agents) {
  check(`Thermos agent ${agent}`, fs.existsSync(path.join(agentDir, "agents", `${agent}.md`)), "missing");
}

for (const result of checks) {
  console.log(`${result.ok ? "PASS" : "FAIL"} ${result.label}${result.ok ? "" : `: ${result.detail}`}`);
}

const failures = checks.filter((result) => !result.ok);
console.log(`\n${checks.length - failures.length}/${checks.length} checks passed.`);
if (failures.length > 0) process.exitCode = 1;
