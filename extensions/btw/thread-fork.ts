import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Message } from "@earendil-works/pi-ai";
import {
  CURRENT_SESSION_VERSION,
  SessionManager,
  type SessionEntry,
} from "@earendil-works/pi-coding-agent";

export interface Turn {
  question: string;
  answer: string;
}

export function firstLine(text: string, max = 120): string {
  const line = text.split("\n")[0] ?? "";
  return line.length > max ? line.slice(0, max - 3) + "..." : line;
}

function appendThread(
  sessionManager: SessionManager,
  turns: Turn[],
  makeAssistant: (text: string) => Message,
): void {
  for (const turn of turns) {
    sessionManager.appendMessage({
      role: "user",
      content: [{ type: "text", text: turn.question }],
      timestamp: Date.now(),
    });
    sessionManager.appendMessage(makeAssistant(turn.answer));
  }
  sessionManager.appendSessionInfo(`btw: ${firstLine(turns[0]!.question, 50)}`);
}

/**
 * Write the current branch plus the btw thread to a new session file without
 * changing the live session manager.
 */
export function forkSessionWithThread(
  sessionManager: {
    getBranch(): SessionEntry[];
    getCwd(): string;
    getEntries(): SessionEntry[];
    getLeafId(): string | null;
    getSessionDir(): string;
    getSessionFile(): string | undefined;
  },
  turns: Turn[],
  makeAssistant: (text: string) => Message,
): string {
  const branch = sessionManager.getBranch();
  const sourceFile = sessionManager.getSessionFile();
  const leafId = sessionManager.getLeafId();

  if (sourceFile && !existsSync(sourceFile)) {
    throw new Error("The current session file no longer exists");
  }

  if (sourceFile && leafId) {
    const fork = SessionManager.open(sourceFile, sessionManager.getSessionDir());
    const file = fork.createBranchedSession(leafId);
    if (!file) throw new Error("Failed to create forked session");
    appendThread(fork, turns, makeAssistant);
    return file;
  }

  const usedIds = new Set(branch.map((entry) => entry.id));
  const generateId = (): string => {
    let id: string;
    do {
      id = randomBytes(4).toString("hex");
    } while (usedIds.has(id));
    usedIds.add(id);
    return id;
  };

  // In-memory sessions have no source file for SessionManager.open(). Re-chain
  // their active path and preserve compaction boundaries across removed labels.
  const entries: Record<string, unknown>[] = [];
  const replacementByLabelId = new Map<string, string>();
  const pendingLabelIds: string[] = [];
  let parentId: string | null = null;
  for (const entry of branch) {
    if (entry.type === "label") {
      pendingLabelIds.push(entry.id);
      continue;
    }
    for (const labelId of pendingLabelIds) replacementByLabelId.set(labelId, entry.id);
    pendingLabelIds.length = 0;
    entries.push(
      entry.type === "compaction"
        ? {
            ...entry,
            parentId,
            firstKeptEntryId:
              replacementByLabelId.get(entry.firstKeptEntryId) ?? entry.firstKeptEntryId,
          }
        : { ...entry, parentId },
    );
    parentId = entry.id;
  }

  const pathEntryIds = new Set(
    branch.filter((entry) => entry.type !== "label").map((entry) => entry.id),
  );
  const labels = new Map<string, { label: string; timestamp: string }>();
  for (const entry of sessionManager.getEntries()) {
    if (entry.type !== "label" || !pathEntryIds.has(entry.targetId)) continue;
    if (entry.label) labels.set(entry.targetId, { label: entry.label, timestamp: entry.timestamp });
    else labels.delete(entry.targetId);
  }
  for (const [targetId, { label, timestamp }] of labels) {
    const id = generateId();
    entries.push({ type: "label", id, parentId, timestamp, targetId, label });
    parentId = id;
  }

  const now = new Date();
  const iso = now.toISOString();
  const header = {
    type: "session",
    version: CURRENT_SESSION_VERSION,
    id: randomUUID(),
    timestamp: iso,
    cwd: sessionManager.getCwd(),
    parentSession: sourceFile,
  };

  for (const turn of turns) {
    const userId = generateId();
    entries.push({
      type: "message",
      id: userId,
      parentId,
      timestamp: iso,
      message: {
        role: "user",
        content: [{ type: "text", text: turn.question }],
        timestamp: now.getTime(),
      },
    });
    parentId = userId;
    const assistantId = generateId();
    entries.push({
      type: "message",
      id: assistantId,
      parentId,
      timestamp: iso,
      message: makeAssistant(turn.answer),
    });
    parentId = assistantId;
  }

  entries.push({
    type: "session_info",
    id: generateId(),
    parentId,
    timestamp: iso,
    name: `btw: ${firstLine(turns[0]!.question, 50)}`,
  });

  const file = join(
    sessionManager.getSessionDir(),
    `${iso.replace(/[:.]/g, "-")}_${header.id}.jsonl`,
  );
  writeFileSync(file, [header, ...entries].map((entry) => JSON.stringify(entry)).join("\n") + "\n");
  return file;
}
