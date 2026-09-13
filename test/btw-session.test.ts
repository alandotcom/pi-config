import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { Message } from "@earendil-works/pi-ai";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { forkSessionWithThread } from "../extensions/btw/thread-fork.ts";

function assistant(text: string): Message {
  return {
    role: "assistant",
    content: [{ type: "text", text }],
    api: "anthropic-messages",
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
    stopReason: "stop",
    timestamp: Date.now(),
  };
}

test("btw forks preserve labels and valid compacted context boundaries", () => {
  const directory = mkdtempSync(join(tmpdir(), "pi-btw-session-"));
  try {
    const source = SessionManager.create("/tmp/project", directory);
    const firstUserId = source.appendMessage({
      role: "user",
      content: "First question",
      timestamp: Date.now(),
    });
    source.appendMessage(assistant("First answer"));
    const labelId = source.appendLabelChange(firstUserId, "important");
    const retainedUserId = source.appendMessage({
      role: "user",
      content: "Retained question",
      timestamp: Date.now(),
    });
    source.appendMessage(assistant("Retained answer"));
    source.appendCompaction("Earlier summary", labelId, 100);

    const forkFile = forkSessionWithThread(
      source,
      [{ question: "Side question", answer: "Side answer" }],
      assistant,
    );
    const entries = readFileSync(forkFile, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    const compaction = entries.find((entry) => entry.type === "compaction");

    assert.equal(compaction.firstKeptEntryId, retainedUserId);
    assert.ok(entries.some((entry) => entry.type === "label" && entry.targetId === firstUserId));
    assert.ok(
      entries.some(
        (entry) =>
          entry.type === "message" &&
          entry.message.role === "user" &&
          entry.message.content[0]?.text === "Side question",
      ),
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
