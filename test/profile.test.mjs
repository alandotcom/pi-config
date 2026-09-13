import assert from "node:assert/strict";
import test from "node:test";
import {
  deepMerge,
  isProfileSubset,
  mergeModelConfig,
  mergePackageEntries,
  mergeSettings,
  packageIdentity,
  parseJsonConfig,
} from "../scripts/profile-lib.mjs";

test("deepMerge preserves unrelated nested settings", () => {
  assert.deepEqual(
    deepMerge(
      { terminal: { showTerminalProgress: true, custom: "keep" }, untouched: 1 },
      { terminal: { showTerminalProgress: false } },
    ),
    { terminal: { showTerminalProgress: false, custom: "keep" }, untouched: 1 },
  );
});

test("parseJsonConfig accepts Pi-style comments and trailing commas", () => {
  assert.deepEqual(
    parseJsonConfig(`{
      // Keep comments outside strings.
      "url": "https://example.com/path//value",
      "items": [1, 2,],
      /* block comment */
    }`),
    { url: "https://example.com/path//value", items: [1, 2] },
  );
  assert.throws(() => parseJsonConfig("{invalid"));
});

test("mergeModelConfig preserves unrelated models and updates profile-owned IDs", () => {
  const existing = {
    providers: {
      openrouter: {
        apiKey: "keep",
        models: [
          { id: "custom/model", name: "Custom" },
          { id: "profile/model", name: "Old name" },
        ],
      },
      local: { models: [{ id: "local/model" }] },
    },
  };
  const profile = {
    providers: {
      openrouter: {
        baseUrl: "https://openrouter.ai/api/v1",
        models: [{ id: "profile/model", name: "Current name" }],
      },
    },
  };

  const merged = mergeModelConfig(existing, profile);
  assert.deepEqual(merged.providers.openrouter.models, [
    { id: "custom/model", name: "Custom" },
    { id: "profile/model", name: "Current name" },
  ]);
  assert.equal(merged.providers.openrouter.apiKey, "keep");
  assert.deepEqual(merged.providers.local.models, [{ id: "local/model" }]);
  assert.deepEqual(mergeModelConfig(merged, profile), merged);
});

test("isProfileSubset compares profile-owned nested values", () => {
  assert.equal(isProfileSubset({ one: 1, nested: { two: 2, extra: 3 } }, { nested: { two: 2 } }), true);
  assert.equal(isProfileSubset({ nested: { two: 3 } }, { nested: { two: 2 } }), false);
});

test("packageIdentity ignores npm versions and git refs", () => {
  assert.equal(packageIdentity("npm:@scope/pkg@1.2.3"), "npm:@scope/pkg");
  assert.equal(packageIdentity("npm:pkg@1.2.3"), "npm:pkg");
  assert.equal(packageIdentity("git:github.com/user/repo@v1"), "git:github.com/user/repo");
});

test("mergePackageEntries replaces matching and legacy package sources", () => {
  const merged = mergePackageEntries(
    [
      "npm:keep-me@1.0.0",
      "npm:replace-me@1.0.0",
      "npm:@nicknisi/pi-btw@0.2.2",
      { source: "git:github.com/alandotcom/pi-extensions", extensions: ["extensions/recall.ts"] },
    ],
    ["npm:replace-me@2.0.0", "git:github.com/alandotcom/pi-config"],
  );

  assert.deepEqual(merged, [
    "npm:keep-me@1.0.0",
    "npm:replace-me@2.0.0",
    "git:github.com/alandotcom/pi-config",
  ]);
});

test("mergeSettings keeps local values outside the profile and removes legacy extension paths", () => {
  const merged = mergeSettings(
    {
      lastChangelogVersion: "0.85.1",
      extensions: [
        "/Users/example/projects/pi-extensions/extensions/compact-bash.ts",
        "/Users/example/custom.ts",
      ],
      packages: ["npm:private-package"],
      terminal: { custom: true },
    },
    { theme: "light/dark", terminal: { showTerminalProgress: false } },
    ["git:github.com/alandotcom/pi-config"],
  );

  assert.deepEqual(merged.extensions, ["/Users/example/custom.ts"]);
  assert.deepEqual(merged.packages, ["npm:private-package", "git:github.com/alandotcom/pi-config"]);
  assert.deepEqual(merged.terminal, { custom: true, showTerminalProgress: false });
  assert.equal(merged.lastChangelogVersion, "0.85.1");
});
