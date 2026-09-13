import assert from "node:assert/strict";
import test from "node:test";
import { openFork, openInMultiplexer, type CommandRunner } from "../extensions/btw/launcher.ts";

function recorder(outputs: string[] = []): {
  calls: Array<[string, string[]]>;
  run: CommandRunner;
} {
  const calls: Array<[string, string[]]> = [];
  return {
    calls,
    run: async (command, args) => {
      calls.push([command, args]);
      return outputs.shift() ?? "";
    },
  };
}

const herdrCreateResponse = JSON.stringify({
  result: {
    tab: { tab_id: "w17:t9" },
    root_pane: { pane_id: "w17:p12" },
  },
});

test("opens a fork in a focused Herdr tab", async () => {
  const { calls, run } = recorder([herdrCreateResponse, ""]);
  const surface = await openInMultiplexer("/tmp/session file.jsonl", "/tmp/project", "fork: test", {
    env: { HERDR_ENV: "1", HERDR_WORKSPACE_ID: "w17" },
    run,
    childEnv: { PI_MULTIPLEXER_FORK_EDITOR_TEXT: "encoded" },
  });

  assert.equal(surface, "herdr");
  assert.deepEqual(calls, [
    [
      "herdr",
      [
        "tab",
        "create",
        "--workspace",
        "w17",
        "--cwd",
        "/tmp/project",
        "--label",
        "fork: test",
        "--env",
        "PI_MULTIPLEXER_FORK_EDITOR_TEXT=encoded",
        "--focus",
      ],
    ],
    ["herdr", ["pane", "run", "w17:p12", "exec pi --session '/tmp/session file.jsonl'"]],
  ]);
});

test("opens a fork in a tmux split when Herdr is absent", async () => {
  const { calls, run } = recorder();
  const surface = await openInMultiplexer("/tmp/session.jsonl", "/tmp/project", "unused", {
    env: { TMUX: "/tmp/tmux" },
    columns: 180,
    run,
    childEnv: { PI_MULTIPLEXER_FORK_EDITOR_TEXT: "encoded" },
  });

  assert.equal(surface, "tmux");
  assert.deepEqual(calls, [
    [
      "tmux",
      [
        "split-window",
        "-h",
        "-c",
        "/tmp/project",
        "env",
        "PI_MULTIPLEXER_FORK_EDITOR_TEXT=encoded",
        "pi",
        "--session",
        "/tmp/session.jsonl",
      ],
    ],
  ]);
});

test("does not open Ghostty when a Herdr launch fails", async () => {
  const calls: Array<[string, string[]]> = [];
  const result = await openFork("/tmp/session.jsonl", "/tmp/project", "btw fork", {
    env: { HERDR_ENV: "1", HERDR_WORKSPACE_ID: "w17" },
    platform: "darwin",
    run: async (command, args) => {
      calls.push([command, args]);
      throw new Error("Herdr unavailable");
    },
    copyToClipboard: async () => false,
  });

  assert.match(result, /Herdr|multiplexer/);
  assert.deepEqual(
    calls.map(([command]) => command),
    ["herdr"],
  );
});
