import { execFile } from "node:child_process";

export type CommandRunner = (command: string, args: string[]) => Promise<string>;

export interface ForkLauncherOptions {
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  columns?: number;
  run?: CommandRunner;
  copyToClipboard?: (text: string) => Promise<boolean>;
}

export interface MultiplexerLauncherOptions {
  env?: NodeJS.ProcessEnv;
  columns?: number;
  run?: CommandRunner;
  childEnv?: Record<string, string>;
}

function runCommand(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { encoding: "utf8" }, (error, stdout) => {
      if (error) reject(error);
      else resolve(stdout);
    });
  });
}

function copyToClipboard(text: string): Promise<boolean> {
  if (process.platform !== "darwin") return Promise.resolve(false);
  return new Promise((resolve) => {
    const child = execFile("pbcopy", (error) => resolve(!error));
    child.stdin?.end(text);
  });
}

export function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

function createdTab(output: string): { tabId: string; paneId: string } {
  const parsed: unknown = JSON.parse(output);
  if (!parsed || typeof parsed !== "object") throw new Error("invalid Herdr response");

  const result = (parsed as Record<string, unknown>).result;
  if (!result || typeof result !== "object") throw new Error("invalid Herdr response");

  const tab = (result as Record<string, unknown>).tab;
  const rootPane = (result as Record<string, unknown>).root_pane;
  if (!tab || typeof tab !== "object" || !rootPane || typeof rootPane !== "object") {
    throw new Error("invalid Herdr response");
  }

  const tabId = (tab as Record<string, unknown>).tab_id;
  const paneId = (rootPane as Record<string, unknown>).pane_id;
  if (typeof tabId !== "string" || !tabId || typeof paneId !== "string" || !paneId) {
    throw new Error("invalid Herdr response");
  }
  return { tabId, paneId };
}

async function openHerdrTab(
  sessionFile: string,
  cwd: string,
  label: string,
  env: NodeJS.ProcessEnv,
  run: CommandRunner,
  childEnv: Record<string, string>,
): Promise<void> {
  const workspaceId = env.HERDR_WORKSPACE_ID;
  if (!workspaceId) throw new Error("Herdr workspace context is unavailable");

  const args = ["tab", "create", "--workspace", workspaceId, "--cwd", cwd, "--label", label];
  for (const [key, value] of Object.entries(childEnv)) args.push("--env", `${key}=${value}`);
  args.push("--focus");

  const output = await run("herdr", args);
  const { tabId, paneId } = createdTab(output);
  try {
    await run("herdr", ["pane", "run", paneId, `exec pi --session ${shellQuote(sessionFile)}`]);
  } catch (error) {
    await run("herdr", ["tab", "close", tabId]).catch(() => {});
    throw error;
  }
}

export async function openInMultiplexer(
  sessionFile: string,
  cwd: string,
  label: string,
  options: MultiplexerLauncherOptions = {},
): Promise<"herdr" | "tmux" | undefined> {
  const env = options.env ?? process.env;
  const columns = options.columns ?? process.stdout.columns ?? 0;
  const run = options.run ?? runCommand;
  const childEnv = options.childEnv ?? {};

  if (env.HERDR_ENV === "1") {
    await openHerdrTab(sessionFile, cwd, label, env, run, childEnv);
    return "herdr";
  }

  if (env.TMUX) {
    const override = env.PI_BTW_SPLIT;
    const direction =
      override === "h" || override === "v" ? `-${override}` : columns >= 160 ? "-h" : "-v";
    const command =
      Object.entries(childEnv).length > 0
        ? ["env", ...Object.entries(childEnv).map(([key, value]) => `${key}=${value}`)]
        : [];
    await run("tmux", [
      "split-window",
      direction,
      "-c",
      cwd,
      ...command,
      "pi",
      "--session",
      sessionFile,
    ]);
    return "tmux";
  }

  return undefined;
}

/** Open a /btw fork without replacing the current Pi process. */
export async function openFork(
  sessionFile: string,
  cwd: string,
  label = "btw fork",
  options: ForkLauncherOptions = {},
): Promise<string> {
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const columns = options.columns ?? process.stdout.columns ?? 0;
  const run = options.run ?? runCommand;
  const copy = options.copyToClipboard ?? copyToClipboard;
  const command = `exec pi --session ${shellQuote(sessionFile)}`;

  try {
    const surface = await openInMultiplexer(sessionFile, cwd, label, { env, columns, run });
    if (surface === "herdr") return "btw fork opened in a new Herdr tab";
    if (surface === "tmux") return "btw fork opened in a tmux split";
  } catch {
    if (env.HERDR_ENV === "1") {
      const copied = await copy(command);
      return copied
        ? `btw fork ready after Herdr launch failed (command copied): ${command}`
        : `btw fork ready after Herdr launch failed: ${command}`;
    }
    // Preserve the existing tmux fallback to Ghostty/clipboard.
  }

  if (platform === "darwin") {
    try {
      await run("open", [
        "-na",
        "Ghostty",
        "--args",
        `--working-directory=${cwd}`,
        "-e",
        "/bin/zsh",
        "-ilc",
        command,
      ]);
      return "btw fork opened in a new Ghostty window";
    } catch {
      // Ghostty is unavailable. Fall through to clipboard.
    }
  }

  const fallbackCommand = `pi --session ${shellQuote(sessionFile)}`;
  const copied = await copy(fallbackCommand);
  return copied
    ? `btw fork ready (command copied): ${fallbackCommand}`
    : `btw fork ready: ${fallbackCommand}`;
}
