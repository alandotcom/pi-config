import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import {
  createExternalFork,
  createMultiplexerSessionFork,
} from "../extensions/btw/session-fork.ts";

function assistant(text: string) {
  return {
    role: "assistant" as const,
    content: [{ type: "text" as const, text }],
    api: "anthropic-messages" as const,
    provider: "test",
    model: "test",
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "stop" as const,
    timestamp: Date.now(),
  };
}

function sourceSession(directory: string) {
  const manager = SessionManager.create("/tmp/project", directory);
  manager.appendMessage({ role: "user", content: "First question", timestamp: Date.now() });
  manager.appendMessage(assistant("First answer"));
  const selectedId = manager.appendMessage({
    role: "user",
    content: "Second question\nwith detail",
    timestamp: Date.now(),
  });
  return { manager, selectedId };
}

test("creates an external fork without switching the source manager", () => {
  const directory = mkdtempSync(join(tmpdir(), "pi-config-fork-"));
  try {
    const { manager, selectedId } = sourceSession(directory);
    const sourceFile = manager.getSessionFile();
    const fork = createExternalFork(manager, {
      type: "session_before_fork",
      entryId: selectedId,
      position: "before",
    });

    assert.equal(manager.getSessionFile(), sourceFile);
    assert.equal(fork.editorText, "Second question\nwith detail");
    assert.notEqual(fork.file, sourceFile);

    const lines = readFileSync(fork.file, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    assert.equal(lines[0].parentSession, sourceFile);
    assert.equal(
      lines.some((entry) => entry.message?.content === "Second question\nwith detail"),
      false,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("intercepts Pi fork in Herdr and passes restored editor text to the new tab", async () => {
  const directory = mkdtempSync(join(tmpdir(), "pi-config-fork-"));
  try {
    const { manager, selectedId } = sourceSession(directory);
    const handlers = new Map<string, (...args: any[]) => any>();
    const calls: Array<[string, string[]]> = [];
    const notices: string[] = [];
    const env = { HERDR_ENV: "1", HERDR_WORKSPACE_ID: "w17" };

    createMultiplexerSessionFork({
      env,
      run: async (command, args) => {
        calls.push([command, args]);
        return calls.length === 1
          ? JSON.stringify({
              result: { tab: { tab_id: "w17:t9" }, root_pane: { pane_id: "w17:p12" } },
            })
          : "";
      },
    })({
      on(name: string, handler: (...args: any[]) => any) {
        handlers.set(name, handler);
      },
    } as any);

    const result = await handlers.get("session_before_fork")?.(
      { type: "session_before_fork", entryId: selectedId, position: "before" },
      { sessionManager: manager, ui: { notify: (message: string) => notices.push(message) } },
    );

    assert.deepEqual(result, { cancel: true });
    assert.match(notices[0] ?? "", /Herdr/);
    const createArgs = calls[0]?.[1] ?? [];
    const envIndex = createArgs.indexOf("--env");
    assert.ok(envIndex >= 0);
    assert.equal(
      Buffer.from(createArgs[envIndex + 1]!.split("=")[1]!, "base64url").toString("utf8"),
      "Second question\nwith detail",
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("intercepts Pi fork in tmux", async () => {
  const directory = mkdtempSync(join(tmpdir(), "pi-config-fork-"));
  try {
    const { manager, selectedId } = sourceSession(directory);
    const handlers = new Map<string, (...args: any[]) => any>();
    const calls: Array<[string, string[]]> = [];

    createMultiplexerSessionFork({
      env: { TMUX: "/tmp/tmux" },
      columns: 100,
      run: async (command, args) => {
        calls.push([command, args]);
        return "";
      },
    })({
      on(name: string, handler: (...args: any[]) => any) {
        handlers.set(name, handler);
      },
    } as any);

    const result = await handlers.get("session_before_fork")?.(
      { type: "session_before_fork", entryId: selectedId, position: "before" },
      { sessionManager: manager, ui: { notify: () => {} } },
    );

    assert.deepEqual(result, { cancel: true });
    assert.equal(calls[0]?.[0], "tmux");
    assert.deepEqual(calls[0]?.[1].slice(0, 4), ["split-window", "-v", "-c", "/tmp/project"]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("removes the external fork and falls back when the multiplexer launch fails", async () => {
  const directory = mkdtempSync(join(tmpdir(), "pi-config-fork-"));
  try {
    const { manager, selectedId } = sourceSession(directory);
    const handlers = new Map<string, (...args: any[]) => any>();
    const notices: string[] = [];
    const originalFiles = readdirSync(directory);

    createMultiplexerSessionFork({
      env: { TMUX: "/tmp/tmux" },
      run: async () => {
        throw new Error("tmux failed");
      },
    })({
      on(name: string, handler: (...args: any[]) => any) {
        handlers.set(name, handler);
      },
    } as any);

    const result = await handlers.get("session_before_fork")?.(
      { type: "session_before_fork", entryId: selectedId, position: "before" },
      { sessionManager: manager, ui: { notify: (message: string) => notices.push(message) } },
    );

    assert.equal(result, undefined);
    assert.deepEqual(readdirSync(directory), originalFiles);
    assert.match(notices[0] ?? "", /normal fork/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("restores the selected message in the forked process editor", () => {
  const handlers = new Map<string, (...args: any[]) => any>();
  const editorText: string[] = [];
  const env: NodeJS.ProcessEnv = {
    PI_MULTIPLEXER_FORK_EDITOR_TEXT: Buffer.from("Edit this prompt").toString("base64url"),
  };

  createMultiplexerSessionFork({ env })({
    on(name: string, handler: (...args: any[]) => any) {
      handlers.set(name, handler);
    },
  } as any);

  handlers.get("session_start")?.(
    { type: "session_start", reason: "startup" },
    { ui: { setEditorText: (text: string) => editorText.push(text) } },
  );

  assert.deepEqual(editorText, ["Edit this prompt"]);
  assert.equal(env.PI_MULTIPLEXER_FORK_EDITOR_TEXT, undefined);
});

test("leaves Pi's normal fork unchanged outside a multiplexer", async () => {
  const handlers = new Map<string, (...args: any[]) => any>();
  createMultiplexerSessionFork({ env: {} })({
    on(name: string, handler: (...args: any[]) => any) {
      handlers.set(name, handler);
    },
  } as any);

  const result = await handlers.get("session_before_fork")?.(
    { type: "session_before_fork", entryId: "unused", position: "before" },
    {},
  );
  assert.equal(result, undefined);
});
