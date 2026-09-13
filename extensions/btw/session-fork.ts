import { existsSync, rmSync, writeFileSync } from "node:fs";
import type { UserMessage } from "@earendil-works/pi-ai";
import {
  SessionManager,
  type ExtensionAPI,
  type SessionBeforeForkEvent,
  type SessionEntry,
} from "@earendil-works/pi-coding-agent";
import { openInMultiplexer, type CommandRunner } from "./launcher.ts";

const EDITOR_TEXT_ENV = "PI_MULTIPLEXER_FORK_EDITOR_TEXT";

interface ForkSource {
  getCwd(): string;
  getEntry(id: string): SessionEntry | undefined;
  getSessionDir(): string;
  getSessionFile(): string | undefined;
  getSessionName(): string | undefined;
}

interface ForkResult {
  file: string;
  editorText?: string;
}

interface SessionForkOptions {
  env?: NodeJS.ProcessEnv;
  columns?: number;
  run?: CommandRunner;
}

function messageText(message: UserMessage): string {
  if (typeof message.content === "string") return message.content;
  return message.content
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}

function writePendingSession(manager: SessionManager, file: string): void {
  if (existsSync(file)) return;
  const header = manager.getHeader();
  if (!header) throw new Error("Forked session has no header");
  writeFileSync(
    file,
    [header, ...manager.getEntries()].map((entry) => JSON.stringify(entry)).join("\n") + "\n",
  );
}

export function createExternalFork(source: ForkSource, event: SessionBeforeForkEvent): ForkResult {
  const sourceFile = source.getSessionFile();
  if (!sourceFile || !existsSync(sourceFile)) {
    throw new Error("The current session has not been saved yet");
  }

  const selected = source.getEntry(event.entryId);
  if (!selected) throw new Error("Invalid entry ID for forking");

  let targetLeafId: string | null;
  let editorText: string | undefined;
  if (event.position === "at") {
    targetLeafId = selected.id;
  } else {
    if (selected.type !== "message" || selected.message.role !== "user") {
      throw new Error("Invalid entry ID for forking");
    }
    targetLeafId = selected.parentId;
    editorText = messageText(selected.message);
  }

  let fork: SessionManager;
  let file: string | undefined;
  if (targetLeafId) {
    fork = SessionManager.open(sourceFile, source.getSessionDir());
    file = fork.createBranchedSession(targetLeafId);
  } else {
    fork = SessionManager.create(source.getCwd(), source.getSessionDir());
    file = fork.newSession({ parentSession: sourceFile });
  }
  if (!file) throw new Error("Failed to create forked session");
  writePendingSession(fork, file);
  return editorText === undefined ? { file } : { file, editorText };
}

function tabLabel(source: ForkSource, event: SessionBeforeForkEvent, editorText?: string): string {
  const prefix = event.position === "at" ? "clone" : "fork";
  const description = editorText?.split("\n")[0]?.trim() || source.getSessionName() || "Pi session";
  return `${prefix}: ${description.length > 40 ? `${description.slice(0, 37)}...` : description}`;
}

export function createMultiplexerSessionFork(options: SessionForkOptions = {}) {
  return function multiplexerSessionFork(pi: ExtensionAPI): void {
    const env = options.env ?? process.env;

    pi.on("session_start", (_event, ctx) => {
      const encoded = env[EDITOR_TEXT_ENV];
      if (!encoded) return;
      delete env[EDITOR_TEXT_ENV];
      ctx.ui.setEditorText(Buffer.from(encoded, "base64url").toString("utf8"));
    });

    pi.on("session_before_fork", async (event, ctx) => {
      if (env.HERDR_ENV !== "1" && !env.TMUX) return;

      let fork: ForkResult | undefined;
      let surface: "herdr" | "tmux" | undefined;
      try {
        fork = createExternalFork(ctx.sessionManager, event);
        const childEnv = fork.editorText
          ? { [EDITOR_TEXT_ENV]: Buffer.from(fork.editorText).toString("base64url") }
          : undefined;
        surface = await openInMultiplexer(
          fork.file,
          ctx.sessionManager.getCwd(),
          tabLabel(ctx.sessionManager, event, fork.editorText),
          {
            env,
            ...(options.columns !== undefined && { columns: options.columns }),
            ...(options.run !== undefined && { run: options.run }),
            ...(childEnv !== undefined && { childEnv }),
          },
        );
      } catch (error) {
        if (fork?.file) rmSync(fork.file, { force: true });
        ctx.ui.notify(
          `Could not open the fork in the current multiplexer; using Pi's normal fork: ${error instanceof Error ? error.message : String(error)}`,
          "warning",
        );
        return;
      }

      if (!surface) {
        if (fork?.file) rmSync(fork.file, { force: true });
        return;
      }
      ctx.ui.notify(
        surface === "herdr" ? "Fork opened in a new Herdr tab" : "Fork opened in a new tmux split",
        "info",
      );
      return { cancel: true };
    });
  };
}

export default createMultiplexerSessionFork();
