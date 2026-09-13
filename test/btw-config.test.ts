import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DEFAULT_BTW_CONFIG, loadBtwConfig, parseModelSpec } from "../extensions/btw/config.ts";

function withTempDirectory(run: (directory: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), "pi-btw-"));
  try {
    run(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function writeConfig(agentDirectory: string, value: unknown): void {
  const directory = join(agentDirectory, "configs");
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "btw.json"), JSON.stringify(value));
}

test("parseModelSpec keeps slashes inside the model ID", () => {
  assert.deepEqual(parseModelSpec("fireworks/accounts/fireworks/models/glm-5p2"), {
    provider: "fireworks",
    id: "accounts/fireworks/models/glm-5p2",
  });
});

test("parseModelSpec rejects incomplete model specs", () => {
  assert.equal(parseModelSpec("glm-latest"), undefined);
  assert.equal(parseModelSpec("/glm-latest"), undefined);
  assert.equal(parseModelSpec("fireworks/"), undefined);
});

test("loadBtwConfig uses defaults when no config exists", () => {
  withTempDirectory((directory) => {
    assert.deepEqual(loadBtwConfig(directory), { config: DEFAULT_BTW_CONFIG, warnings: [] });
  });
});

test("loadBtwConfig loads a configured provider and model", () => {
  withTempDirectory((directory) => {
    writeConfig(directory, { model: "anthropic/claude-sonnet-4-5" });
    assert.deepEqual(loadBtwConfig(directory), {
      config: { model: "anthropic/claude-sonnet-4-5" },
      warnings: [],
    });
  });
});

test("loadBtwConfig warns and falls back for invalid configuration", () => {
  withTempDirectory((directory) => {
    const configDirectory = join(directory, "configs");
    mkdirSync(configDirectory, { recursive: true });
    writeFileSync(join(configDirectory, "btw.json"), "{ nope");
    const invalidJson = loadBtwConfig(directory);
    assert.deepEqual(invalidJson.config, DEFAULT_BTW_CONFIG);
    assert.equal(invalidJson.warnings.length, 1);

    writeConfig(directory, { model: "glm-latest" });
    const invalidModel = loadBtwConfig(directory);
    assert.deepEqual(invalidModel.config, DEFAULT_BTW_CONFIG);
    assert.match(invalidModel.warnings[0] ?? "", /provider\/model-id/);
  });
});
