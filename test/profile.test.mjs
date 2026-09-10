import assert from "node:assert/strict";
import test from "node:test";
import {
  deepMerge,
  mergePackageEntries,
  mergeSettings,
  packageIdentity,
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
